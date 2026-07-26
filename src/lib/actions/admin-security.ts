'use server';

import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { logAdminAction, requirePermission } from '@/lib/actions/admin-auth';
import { runSecurityMaintenance } from '@/lib/security/maintenance';

export type LoginLockoutEntry = {
  channel: 'user' | 'admin';
  principal: string;
  failed_attempts: number;
  lock_level: number;
  locked_until: string | null;
  updated_at: string;
};

export async function getLoginLockouts(limit = 100): Promise<LoginLockoutEntry[]> {
  await requirePermission('settings:read');
  const db = getDb();
  const rows = await db
    .select({
      channel: schema.authLoginLockouts.channel,
      principal: schema.authLoginLockouts.principal,
      failedAttempts: schema.authLoginLockouts.failedAttempts,
      lockLevel: schema.authLoginLockouts.lockLevel,
      lockedUntil: schema.authLoginLockouts.lockedUntil,
      updatedAt: schema.authLoginLockouts.updatedAt,
    })
    .from(schema.authLoginLockouts)
    .orderBy(desc(schema.authLoginLockouts.updatedAt))
    .limit(Math.max(1, Math.min(limit, 500)));

  return rows.map((row) => ({
    channel: row.channel as 'user' | 'admin',
    principal: row.principal,
    failed_attempts: row.failedAttempts,
    lock_level: row.lockLevel,
    locked_until: row.lockedUntil?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  }));
}

export async function unlockLoginLockout(input: {
  channel: 'user' | 'admin';
  principal: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await requirePermission('staff:update');
  const principal = input.principal.trim().toLowerCase();

  if (!principal) {
    return { success: false, error: 'Principal inválido.' };
  }

  const db = getDb();
  await db
    .delete(schema.authLoginLockouts)
    .where(
      and(
        eq(schema.authLoginLockouts.channel, input.channel),
        eq(schema.authLoginLockouts.principal, principal),
      ),
    );

  await logAdminAction(session.adminId, 'UNLOCK_LOGIN_PRINCIPAL', 'auth_login_lockouts', undefined, {
    channel: input.channel,
    principal,
  });

  return { success: true };
}

export async function runSecurityMaintenanceNow(): Promise<{
  success: boolean;
  error?: string;
  deleted?: { lockouts: number; webhookEvents: number };
}> {
  const session = await requirePermission('settings:read');
  try {
    const result = await runSecurityMaintenance();
    await logAdminAction(session.adminId, 'RUN_SECURITY_MAINTENANCE', 'security_maintenance', undefined, result);
    return {
      success: true,
      deleted: { lockouts: result.lockoutsDeleted, webhookEvents: result.webhookEventsDeleted },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error ejecutando mantenimiento de seguridad',
    };
  }
}
