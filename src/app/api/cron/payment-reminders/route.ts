import { NextResponse } from 'next/server';
import { processPaymentReminders } from '@/lib/actions/email-reminders';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logCronEvent, logSecurityEvent } from '@/lib/logger';
import { validateCronSecret, isVercelCronIP } from '@/lib/security/ip-whitelist';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/payment-reminders
 *
 * This endpoint is meant to be called by a cron job (Vercel Cron or external).
 * It processes all upcoming payment reminders and sends emails.
 *
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/payment-reminders",
 *     "schedule": "0 8 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const identifier = getClientIdentifier(request);

    // Get auth header and secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Validate secret is configured and strong (fail-secure)
    try {
        validateCronSecret(cronSecret);
    } catch (error) {
        logSecurityEvent({
            event: 'cron_secret_not_configured',
            ip: identifier,
            path: '/api/cron/payment-reminders',
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
                env: process.env.NODE_ENV,
            },
        });
        return NextResponse.json(
            { error: 'Service misconfigured' },
            { status: 503 }
        );
    }

    // Validate bearer token
    if (authHeader !== `Bearer ${cronSecret}`) {
        logSecurityEvent({
            event: 'invalid_cron_secret',
            ip: identifier,
            path: '/api/cron/payment-reminders',
            details: {
                hasAuthHeader: !!authHeader,
            },
        });
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    // Optional: IP whitelisting for extra security
    if (process.env.NODE_ENV === 'production' && !isVercelCronIP(identifier)) {
        logSecurityEvent({
            event: 'cron_access_from_invalid_ip',
            ip: identifier,
            path: '/api/cron/payment-reminders',
        });
        return NextResponse.json(
            { error: 'Forbidden - Invalid IP' },
            { status: 403 }
        );
    }

    // Apply rate limiting (generous for cron jobs)
    const { success } = await applyRateLimit(identifier, 'api');

    if (!success) {
        logSecurityEvent({
            event: 'rate_limit_exceeded',
            ip: identifier,
            path: '/api/cron/payment-reminders',
        });
        return rateLimitExceededResponse();
    }

    try {
        logCronEvent({
            job: 'payment-reminders',
            status: 'started',
        });

        const result = await processPaymentReminders();

        const duration = Date.now() - startTime;

        logCronEvent({
            job: 'payment-reminders',
            status: 'completed',
            duration,
            processed: result.sent || 0,
        });

        return NextResponse.json({
            success: true,
            message: 'Payment reminders processed',
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const duration = Date.now() - startTime;

        logCronEvent({
            job: 'payment-reminders',
            status: 'failed',
            duration,
            error: error instanceof Error ? error : new Error(String(error)),
        });

        return NextResponse.json(
            {
                error: 'Failed to process payment reminders',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/cron/payment-reminders
 *
 * Manual trigger for testing
 */
export async function POST(request: Request) {
    const startTime = Date.now();
    const identifier = getClientIdentifier(request);

    // Get auth header and secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Validate secret is configured and strong (fail-secure)
    try {
        validateCronSecret(cronSecret);
    } catch (error) {
        logSecurityEvent({
            event: 'cron_secret_not_configured',
            ip: identifier,
            path: '/api/cron/payment-reminders (POST)',
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
        });
        return NextResponse.json(
            { error: 'Service misconfigured' },
            { status: 503 }
        );
    }

    // Validate bearer token
    if (authHeader !== `Bearer ${cronSecret}`) {
        logSecurityEvent({
            event: 'invalid_cron_secret',
            ip: identifier,
            path: '/api/cron/payment-reminders (POST)',
        });
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        logCronEvent({
            job: 'payment-reminders-manual',
            status: 'started',
        });

        const result = await processPaymentReminders();

        const duration = Date.now() - startTime;

        logCronEvent({
            job: 'payment-reminders-manual',
            status: 'completed',
            duration,
            processed: result.sent || 0,
        });

        return NextResponse.json({
            success: true,
            message: 'Payment reminders triggered manually',
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const duration = Date.now() - startTime;

        logCronEvent({
            job: 'payment-reminders-manual',
            status: 'failed',
            duration,
            error: error instanceof Error ? error : new Error(String(error)),
        });

        return NextResponse.json(
            {
                error: 'Failed to process payment reminders',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
