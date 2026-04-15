'use server';

import { createAdminClient } from '@/lib/supabase/server';
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
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('auth_login_lockouts')
    .select('channel, principal, failed_attempts, lock_level, locked_until, updated_at')
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) {
    console.error('Error fetching login lockouts:', error?.message || error);
    return [];
  }

  return (data || []) as LoginLockoutEntry[];
}

export async function unlockLoginLockout(input: {
  channel: 'user' | 'admin';
  principal: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await requirePermission('staff:update');
  const admin = createAdminClient();
  const principal = input.principal.trim().toLowerCase();

  if (!principal) {
    return { success: false, error: 'Principal inválido.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('auth_login_lockouts')
    .delete()
    .eq('channel', input.channel)
    .eq('principal', principal);

  if (error) {
    return { success: false, error: 'No se pudo desbloquear la cuenta.' };
  }

  await logAdminAction(session.adminId, 'UNLOCK_LOGIN_PRINCIPAL', 'auth_login_lockouts', undefined, {
    channel: input.channel,
    principal,
  });

  return { success: true };
}

export async function runSecurityMaintenanceNow(): Promise<{ success: boolean; error?: string; deleted?: { lockouts: number; webhookEvents: number } }> {
  const session = await requirePermission('settings:read');
  try {
    const result = await runSecurityMaintenance();
    await logAdminAction(session.adminId, 'RUN_SECURITY_MAINTENANCE', 'security_maintenance', undefined, result);
    return { success: true, deleted: { lockouts: result.lockoutsDeleted, webhookEvents: result.webhookEventsDeleted } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error ejecutando mantenimiento de seguridad',
    };
  }
}
