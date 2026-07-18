import { NextResponse } from 'next/server';
import { processLifecycleCampaigns } from '@/lib/lifecycle';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logCronEvent, logSecurityEvent } from '@/lib/logger';
import { validateCronSecret } from '@/lib/security/ip-whitelist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authorizeCronRequest(request: Request, path: string) {
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
                env: process.env.NODE_ENV,
            },
        });

        return {
            identifier,
            response: NextResponse.json({ error: 'Service misconfigured' }, { status: 503 }),
        };
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        logSecurityEvent({
            event: 'invalid_cron_secret',
            ip: identifier,
            path,
            details: {
                hasAuthHeader: !!authHeader,
            },
        });

        return {
            identifier,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }


    const { success } = await applyRateLimit(identifier, 'api');
    if (!success) {
        logSecurityEvent({
            event: 'rate_limit_exceeded',
            ip: identifier,
            path,
        });

        return {
            identifier,
            response: rateLimitExceededResponse(),
        };
    }

    return { identifier, response: null };
}

async function handleLifecycleCron(job: string) {
    const startTime = Date.now();

    try {
        logCronEvent({
            job,
            status: 'started',
        });

        const result = await processLifecycleCampaigns();
        const duration = Date.now() - startTime;

        logCronEvent({
            job,
            status: 'completed',
            duration,
            processed: result.touchpointsCreated,
        });

        return NextResponse.json({
            success: true,
            message: 'Lifecycle cadence processed',
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const duration = Date.now() - startTime;

        logCronEvent({
            job,
            status: 'failed',
            duration,
            error: error instanceof Error ? error : new Error(String(error)),
        });

        return NextResponse.json(
            {
                error: 'Failed to process lifecycle cadence',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    const auth = await authorizeCronRequest(request, '/api/cron/lifecycle');
    if (auth.response) {
        return auth.response;
    }

    return handleLifecycleCron('lifecycle-cadence');
}

export async function POST(request: Request) {
    const auth = await authorizeCronRequest(request, '/api/cron/lifecycle (POST)');
    if (auth.response) {
        return auth.response;
    }

    return handleLifecycleCron('lifecycle-cadence-manual');
}
