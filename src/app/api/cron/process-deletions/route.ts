import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull, lt, lte } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { accountDeletionRequests } from '@/db/schema';
import { applyRateLimit, getClientIdentifier, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logCronEvent, logSecurityEvent, logger } from '@/lib/logger';
import { validateCronSecret } from '@/lib/security/ip-whitelist';
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
    row: ClaimedRow,
    reason: string,
): Promise<void> {
    try {
        await getDb()
            .update(accountDeletionRequests)
            .set({ executedAt: null, attempts: row.attempts + 1 })
            .where(eq(accountDeletionRequests.id, row.id));
        logger.warn(
            { requestId: row.id, attempts: row.attempts + 1, reason },
            'process-deletions: claim released for retry'
        );
    } catch (error) {
        // Worst case the row stays "executed" like the old behavior — log
        // loudly so it surfaces in Sentry instead of vanishing silently.
        logger.error(
            { err: error instanceof Error ? error.message : String(error), requestId: row.id, reason },
            'process-deletions: failed to release claim for retry'
        );
    }
}

/**
 * Storage cleanup. Objects live at <userId>/<tenantId>/<paymentId>.<ext>.
 * The Supabase Storage client was removed in F6; `deleteUserReceiptObjects`
 * routes to Railway Buckets and reports an error for any other provider.
 */
async function deleteUserStorage(userId: string): Promise<boolean> {
    const result = await deleteUserReceiptObjects(null, userId);
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
    const db = getDb();
    const now = new Date();

    try {
        logCronEvent({ job: 'process-deletions', status: 'started' });

        // Atomic claim: only rows still active are returned. The UPDATE sets
        // executed_at provisionally so a concurrent cancelAccountDeletion will
        // fail the WHERE canceled_at IS NULL filter against it, closing the
        // race window between SELECT and auth.admin.deleteUser. On FAILURE the
        // claim is rolled back (executed_at → NULL, attempts+1) so the row is
        // retried on later runs — up to MAX_ATTEMPTS, after which it stays
        // visible (executed_at NULL) for manual follow-up (audit 2026-07).
        const claimable = db
            .select({ id: accountDeletionRequests.id })
            .from(accountDeletionRequests)
            .where(
                and(
                    lte(accountDeletionRequests.executesAt, now),
                    isNull(accountDeletionRequests.canceledAt),
                    isNull(accountDeletionRequests.executedAt),
                    lt(accountDeletionRequests.attempts, MAX_ATTEMPTS)
                )
            )
            .limit(BATCH_LIMIT);

        let claimed: ClaimedRow[];
        try {
            const rows = await db
                .update(accountDeletionRequests)
                .set({ executedAt: now })
                .where(inArray(accountDeletionRequests.id, claimable))
                .returning({
                    id: accountDeletionRequests.id,
                    userId: accountDeletionRequests.userId,
                    attempts: accountDeletionRequests.attempts,
                });
            claimed = rows.map((row) => ({
                id: row.id,
                user_id: row.userId,
                attempts: row.attempts,
            }));
        } catch (claimError) {
            const err = claimError instanceof Error ? claimError : new Error(String(claimError));
            logger.error({ err: err.message }, 'process-deletions: claim failed');
            logCronEvent({
                job: 'process-deletions',
                status: 'failed',
                duration: Date.now() - startTime,
                error: err,
            });
            return NextResponse.json({ error: 'Claim failed' }, { status: 500 });
        }

        if (claimed.length === 0) {
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
                const storageOk = await deleteUserStorage(row.user_id);
                if (!storageOk) {
                    failed++;
                    await releaseClaim(row, 'storage cleanup failed');
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
                        await releaseClaim(row, 'auth delete failed');
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
                await releaseClaim(row, 'unexpected exception');
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
