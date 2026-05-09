import { NextResponse } from 'next/server';
import { applyRateLimit, getClientIdentifier, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logCronEvent, logSecurityEvent, logger } from '@/lib/logger';
import { validateCronSecret, isVercelCronIP } from '@/lib/security/ip-whitelist';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_LIMIT = 50;

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

    if (process.env.NODE_ENV === 'production' && !isVercelCronIP(identifier)) {
        logSecurityEvent({
            event: 'cron_access_from_invalid_ip',
            ip: identifier,
            path,
        });
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Forbidden - Invalid IP' }, { status: 403 }),
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

        const { data: matured, error: queryError } = await admin
            .from('account_deletion_requests')
            .select('id, user_id')
            .lte('executes_at', nowIso)
            .is('canceled_at', null)
            .is('executed_at', null)
            .limit(BATCH_LIMIT);

        if (queryError) {
            logger.error(
                { err: queryError.message, code: queryError.code },
                'process-deletions: query failed'
            );
            logCronEvent({
                job: 'process-deletions',
                status: 'failed',
                duration: Date.now() - startTime,
                error: new Error(queryError.message),
            });
            return NextResponse.json({ error: 'Query failed' }, { status: 500 });
        }

        if (!matured || matured.length === 0) {
            logCronEvent({
                job: 'process-deletions',
                status: 'completed',
                duration: Date.now() - startTime,
                processed: 0,
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

        for (const row of matured) {
            try {
                // Cascade is handled by the FK ON DELETE CASCADE chain rooted at
                // auth.users (verified for: user_profiles, debts, payments, plans,
                // tenants.created_by_user_id, tenant_memberships). Deleting the
                // auth user removes everything downstream.
                const { error: deleteError } =
                    await admin.auth.admin.deleteUser(row.user_id);

                if (deleteError) {
                    // If the auth user no longer exists, treat as already-deleted.
                    const message = deleteError.message || '';
                    if (!/not\s*found/i.test(message)) {
                        throw new Error(message);
                    }
                }

                const { error: markError } = await admin
                    .from('account_deletion_requests')
                    .update({ executed_at: new Date().toISOString() })
                    .eq('id', row.id);

                if (markError) {
                    logger.error(
                        { err: markError.message, requestId: row.id },
                        'process-deletions: mark executed failed'
                    );
                    // The auth user is gone (or never existed); the row will be
                    // picked up again next run unless ON DELETE CASCADE removes it.
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
            }
        }

        logCronEvent({
            job: 'process-deletions',
            status: 'completed',
            duration: Date.now() - startTime,
            processed: deleted,
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
