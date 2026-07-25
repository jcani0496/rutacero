import { NextResponse } from 'next/server';
import { applyRateLimit, getClientIdentifier, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logCronEvent, logSecurityEvent, logger } from '@/lib/logger';
import { validateCronSecret } from '@/lib/security/ip-whitelist';
import { createAdminClient } from '@/lib/supabase/server';
import { deleteUserReceiptObjects } from '@/lib/storage/receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_LIMIT = 50;
/** Failed rows are retried on later runs until this cap, then left visible
 *  (executed_at NULL) for manual follow-up. */
const MAX_ATTEMPTS = 5;

type ClaimedRow = { id: string; user_id: string; attempts: number };

/**
 * Rolls a provisional claim back so the row is retried on a later run.
 * attempts+1 keeps permanently-failing rows from looping forever (the claim
 * filters attempts < MAX_ATTEMPTS).
 */
async function releaseClaim(
    admin: ReturnType<typeof createAdminClient>,
    row: ClaimedRow,
    reason: string,
): Promise<void> {
    const { error } = await admin
        .from('account_deletion_requests')
        .update({ executed_at: null, attempts: row.attempts + 1 })
        .eq('id', row.id);
    if (error) {
        // Worst case the row stays "executed" like the old behavior — log
        // loudly so it surfaces in Sentry instead of vanishing silently.
        logger.error(
            { err: error.message, requestId: row.id, reason },
            'process-deletions: failed to release claim for retry'
        );
    } else {
        logger.warn(
            { requestId: row.id, attempts: row.attempts + 1, reason },
            'process-deletions: claim released for retry'
        );
    }
}

/**
 * Dual-path storage cleanup (STORAGE_PROVIDER=supabase|railway).
 * Objects live at <userId>/<tenantId>/<paymentId>.<ext>.
 */
async function deleteUserStorage(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
): Promise<boolean> {
    const result = await deleteUserReceiptObjects(admin, userId);
    if (!result.ok) {
        logger.error(
            { err: result.error, userId },
            'process-deletions: storage cleanup failed'
        );
        return false;
    }
    if (result.removed > 0) {
        logger.info(
            { userId, removed: result.removed },
            'process-deletions: storage objects removed'
        );
    }
    return true;
}

async function authorizeCron(request: Request, path: string) {
    const identifier = getClientIdentifier(request);
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    try {
        validateCronSecret(cronSecret);
    } catch (error) {
        logSecurityEvent({
            event: 'cron_secret_not_configured',
            ip: identifier,
            path,
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
        });
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Service misconfigured' }, { status: 503 }),
        };
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        logSecurityEvent({
            event: 'invalid_cron_secret',
            ip: identifier,
            path,
        });
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const rate = await applyRateLimit(identifier, 'api');
    if (!rate.success) {
        logSecurityEvent({
            event: 'rate_limit_exceeded',
            ip: identifier,
            path,
        });
        return { ok: false as const, response: rateLimitExceededResponse() };
    }

    return { ok: true as const };
}

async function run(path: string) {
    const startTime = Date.now();
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    try {
        logCronEvent({ job: 'process-deletions', status: 'started' });

        // Atomic claim: only rows still active are returned. The UPDATE sets
        // executed_at provisionally so a concurrent cancelAccountDeletion will
        // fail the WHERE canceled_at IS NULL filter against it, closing the
        // race window between SELECT and auth.admin.deleteUser. On FAILURE the
        // claim is rolled back (executed_at → NULL, attempts+1) so the row is
        // retried on later runs — up to MAX_ATTEMPTS, after which it stays
        // visible (executed_at NULL) for manual follow-up (audit 2026-07).
        const { data: claimed, error: claimError } = await admin
            .from('account_deletion_requests')
            .update({ executed_at: nowIso })
            .lte('executes_at', nowIso)
            .is('canceled_at', null)
            .is('executed_at', null)
            .lt('attempts', MAX_ATTEMPTS)
            .select('id, user_id, attempts')
            .limit(BATCH_LIMIT);

        if (claimError) {
            logger.error(
                { err: claimError.message, code: claimError.code },
                'process-deletions: claim failed'
            );
            logCronEvent({
                job: 'process-deletions',
                status: 'failed',
                duration: Date.now() - startTime,
                error: new Error(claimError.message),
            });
            return NextResponse.json({ error: 'Claim failed' }, { status: 500 });
        }

        if (!claimed || claimed.length === 0) {
            logCronEvent({
                job: 'process-deletions',
                status: 'completed',
                duration: Date.now() - startTime,
                processed: 0,
                failed: 0,
            });
            return NextResponse.json({
                success: true,
                processed: 0,
                failed: 0,
                path,
                timestamp: new Date().toISOString(),
            });
        }

        let deleted = 0;
        let failed = 0;

        for (const row of claimed) {
            try {
                // Storage FIRST: the FK cascade rooted at auth.users wipes DB
                // rows but NEVER touches Storage objects — bank receipts under
                // payment-receipts/<user_id>/ survived deletion indefinitely
                // (audit 2026-07, ARCO/GDPR right-to-erasure). If Storage
                // cleanup fails we re-queue instead of deleting the auth user,
                // so PII is never orphaned with its owning rows gone.
                const storageOk = await deleteUserStorage(admin, row.user_id);
                if (!storageOk) {
                    failed++;
                    await releaseClaim(admin, row, 'storage cleanup failed');
                    continue;
                }

                // Cascade is handled by the FK ON DELETE CASCADE chain rooted at
                // the identity user (auth.users today; public.users under better-auth).
                try {
                    const { deleteIdentityUser } = await import('@/lib/auth/identity');
                    await deleteIdentityUser(row.user_id);
                } catch (deleteError) {
                    const message =
                        deleteError instanceof Error ? deleteError.message : String(deleteError);
                    if (!/not\s*found/i.test(message)) {
                        failed++;
                        logger.error(
                            {
                                err: message,
                                userId: row.user_id,
                                requestId: row.id,
                            },
                            'process-deletions: auth delete failed'
                        );
                        await releaseClaim(admin, row, 'auth delete failed');
                        continue;
                    }
                }

                deleted++;
            } catch (e) {
                failed++;
                logger.error(
                    {
                        err: e instanceof Error ? e.message : String(e),
                        userId: row.user_id,
                        requestId: row.id,
                    },
                    'process-deletions: cascade failed'
                );
                await releaseClaim(admin, row, 'unexpected exception');
            }
        }

        logCronEvent({
            job: 'process-deletions',
            status: 'completed',
            duration: Date.now() - startTime,
            processed: deleted,
            failed,
        });

        return NextResponse.json({
            success: true,
            processed: deleted,
            failed,
            path,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logCronEvent({
            job: 'process-deletions',
            status: 'failed',
            duration: Date.now() - startTime,
            error: error instanceof Error ? error : new Error(String(error)),
        });
        return NextResponse.json(
            {
                error: 'Failed to process deletions',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    const auth = await authorizeCron(request, '/api/cron/process-deletions');
    if (!auth.ok) return auth.response;
    return run('/api/cron/process-deletions');
}

export async function POST(request: Request) {
    const auth = await authorizeCron(request, '/api/cron/process-deletions (POST)');
    if (!auth.ok) return auth.response;
    return run('/api/cron/process-deletions (POST)');
}
