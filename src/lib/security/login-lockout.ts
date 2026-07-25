import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@/db/client';

export type LoginChannel = 'user' | 'admin';

type LockoutRow = {
  channel: LoginChannel;
  principal: string;
  failed_attempts: number;
  lock_level: number;
  locked_until: string | null;
  last_failed_at: string | null;
};

const FAILURE_RESET_WINDOW_MS =
  Number(process.env.LOGIN_LOCKOUT_RESET_HOURS ?? 24) * 60 * 60 * 1000;

const LOCKOUT_STEPS = [
  { failures: 3, lockMs: 60 * 1000, level: 1 }, // 1 min
  { failures: 5, lockMs: 5 * 60 * 1000, level: 2 }, // 5 min
  { failures: 7, lockMs: 15 * 60 * 1000, level: 3 }, // 15 min
  { failures: 10, lockMs: 60 * 60 * 1000, level: 4 }, // 1 hour
  { failures: 14, lockMs: 24 * 60 * 60 * 1000, level: 5 }, // 24 hours
];

function normalizePrincipal(value: string) {
  return value.trim().toLowerCase();
}

function getLockStep(failedAttempts: number) {
  for (let i = LOCKOUT_STEPS.length - 1; i >= 0; i--) {
    if (failedAttempts >= LOCKOUT_STEPS[i].failures) {
      return LOCKOUT_STEPS[i];
    }
  }
  return null;
}

async function getLockoutRow(channel: LoginChannel, principal: string): Promise<LockoutRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.authLoginLockouts)
    .where(
      and(
        eq(schema.authLoginLockouts.channel, channel),
        eq(schema.authLoginLockouts.principal, principal),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    channel: row.channel as LoginChannel,
    principal: row.principal,
    failed_attempts: row.failedAttempts,
    lock_level: row.lockLevel,
    locked_until: row.lockedUntil?.toISOString() ?? null,
    last_failed_at: row.lastFailedAt?.toISOString() ?? null,
  };
}

async function upsertLockoutRow(input: {
  channel: LoginChannel;
  principal: string;
  failedAttempts: number;
  lockLevel: number;
  lockedUntil: string | null;
  lastFailedAt: string | null;
  ip?: string | null;
}) {
  const db = getDb();
  const now = new Date();
  await db
    .insert(schema.authLoginLockouts)
    .values({
      channel: input.channel,
      principal: input.principal,
      failedAttempts: input.failedAttempts,
      lockLevel: input.lockLevel,
      lockedUntil: input.lockedUntil ? new Date(input.lockedUntil) : null,
      lastFailedAt: input.lastFailedAt ? new Date(input.lastFailedAt) : null,
      lastIp: input.ip ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.authLoginLockouts.channel, schema.authLoginLockouts.principal],
      set: {
        failedAttempts: input.failedAttempts,
        lockLevel: input.lockLevel,
        lockedUntil: input.lockedUntil ? new Date(input.lockedUntil) : null,
        lastFailedAt: input.lastFailedAt ? new Date(input.lastFailedAt) : null,
        lastIp: input.ip ?? null,
        updatedAt: now,
      },
    });
}

export function getRetryAfterSeconds(lockedUntil: string | null): number {
  if (!lockedUntil) return 0;
  const ms = new Date(lockedUntil).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 1000);
}

export function formatRetryTime(seconds: number): string {
  if (seconds <= 0) return 'unos segundos';
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minuto${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hora${hours === 1 ? '' : 's'}`;
}

export async function checkLoginLockout(channel: LoginChannel, principalInput: string) {
  const principal = normalizePrincipal(principalInput);
  const now = Date.now();
  const row = await getLockoutRow(channel, principal);

  if (!row) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const lastFailedAtMs = row.last_failed_at ? new Date(row.last_failed_at).getTime() : 0;
  const shouldResetCounter = lastFailedAtMs > 0 && now - lastFailedAtMs > FAILURE_RESET_WINDOW_MS;

  if (shouldResetCounter && row.failed_attempts > 0) {
    await upsertLockoutRow({
      channel,
      principal,
      failedAttempts: 0,
      lockLevel: 0,
      lockedUntil: null,
      lastFailedAt: null,
    });
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = getRetryAfterSeconds(row.locked_until);
  if (retryAfterSeconds > 0) {
    return { blocked: true, retryAfterSeconds };
  }

  if (row.locked_until) {
    await upsertLockoutRow({
      channel,
      principal,
      failedAttempts: row.failed_attempts,
      lockLevel: row.lock_level,
      lockedUntil: null,
      lastFailedAt: row.last_failed_at,
    });
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export async function registerLoginFailure(
  channel: LoginChannel,
  principalInput: string,
  ip?: string
) {
  const principal = normalizePrincipal(principalInput);
  const row = await getLockoutRow(channel, principal);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const lastFailedAtMs = row?.last_failed_at ? new Date(row.last_failed_at).getTime() : 0;
  const shouldResetCounter = lastFailedAtMs > 0 && now - lastFailedAtMs > FAILURE_RESET_WINDOW_MS;

  const previousFailures = shouldResetCounter ? 0 : row?.failed_attempts ?? 0;
  const nextFailures = previousFailures + 1;
  const lockStep = getLockStep(nextFailures);
  const lockedUntil = lockStep ? new Date(now + lockStep.lockMs).toISOString() : null;

  await upsertLockoutRow({
    channel,
    principal,
    failedAttempts: nextFailures,
    lockLevel: lockStep?.level ?? 0,
    lockedUntil,
    lastFailedAt: nowIso,
    ip,
  });

  return {
    failedAttempts: nextFailures,
    blocked: !!lockedUntil,
    retryAfterSeconds: getRetryAfterSeconds(lockedUntil),
  };
}

export async function clearLoginFailures(
  channel: LoginChannel,
  principalInput: string,
  ip?: string
) {
  const principal = normalizePrincipal(principalInput);
  await upsertLockoutRow({
    channel,
    principal,
    failedAttempts: 0,
    lockLevel: 0,
    lockedUntil: null,
    lastFailedAt: null,
    ip,
  });
}
