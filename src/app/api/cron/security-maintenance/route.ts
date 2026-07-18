import { NextResponse } from 'next/server';
import { applyRateLimit, getClientIdentifier, rateLimitExceededResponse } from '@/lib/rate-limit';
import { logCronEvent, logSecurityEvent } from '@/lib/logger';
import { validateCronSecret } from '@/lib/security/ip-whitelist';
import { runSecurityMaintenance } from '@/lib/security/maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    return { ok: false as const, response: NextResponse.json({ error: 'Service misconfigured' }, { status: 503 }) };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    logSecurityEvent({
      event: 'invalid_cron_secret',
      ip: identifier,
      path,
    });
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
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
  try {
    logCronEvent({ job: 'security-maintenance', status: 'started' });
    const result = await runSecurityMaintenance();
    const duration = Date.now() - startTime;
    logCronEvent({
      job: 'security-maintenance',
      status: 'completed',
      duration,
      processed: result.lockoutsDeleted + result.webhookEventsDeleted,
    });
    return NextResponse.json({ success: true, ...result, path, timestamp: new Date().toISOString() });
  } catch (error) {
    const duration = Date.now() - startTime;
    logCronEvent({
      job: 'security-maintenance',
      status: 'failed',
      duration,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return NextResponse.json(
      { error: 'Failed to execute security maintenance', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const auth = await authorizeCron(request, '/api/cron/security-maintenance');
  if (!auth.ok) return auth.response;
  return run('/api/cron/security-maintenance');
}

export async function POST(request: Request) {
  const auth = await authorizeCron(request, '/api/cron/security-maintenance (POST)');
  if (!auth.ok) return auth.response;
  return run('/api/cron/security-maintenance (POST)');
}
