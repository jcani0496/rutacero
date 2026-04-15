import { createAdminClient } from '@/lib/supabase/server';

export type SecurityMaintenanceResult = {
  lockoutsDeleted: number;
  webhookEventsDeleted: number;
  lockoutCutoffIso: string;
  webhookCutoffIso: string;
};

function getRetentionDays(envName: string, fallback: number) {
  const parsed = Number(process.env[envName] || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function runSecurityMaintenance(): Promise<SecurityMaintenanceResult> {
  const admin = createAdminClient();

  const lockoutRetentionDays = getRetentionDays('LOGIN_LOCKOUT_RETENTION_DAYS', 90);
  const webhookRetentionDays = getRetentionDays('WEBHOOK_EVENT_RETENTION_DAYS', 30);

  const lockoutCutoffIso = new Date(Date.now() - lockoutRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const webhookCutoffIso = new Date(Date.now() - webhookRetentionDays * 24 * 60 * 60 * 1000).toISOString();

  // Delete old lockout rows regardless of channel.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deletedLockouts, error: lockoutError } = await (admin as any)
    .from('auth_login_lockouts')
    .delete()
    .lt('updated_at', lockoutCutoffIso)
    .select('channel');

  if (lockoutError) {
    throw new Error(`Failed to cleanup login lockouts: ${lockoutError.message}`);
  }

  // Keep recent failed webhook events for diagnostics; cleanup old processed records.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deletedWebhookEvents, error: webhookError } = await (admin as any)
    .from('payment_webhook_events')
    .delete()
    .eq('processed', true)
    .lt('received_at', webhookCutoffIso)
    .select('id');

  if (webhookError) {
    throw new Error(`Failed to cleanup webhook events: ${webhookError.message}`);
  }

  return {
    lockoutsDeleted: deletedLockouts?.length || 0,
    webhookEventsDeleted: deletedWebhookEvents?.length || 0,
    lockoutCutoffIso,
    webhookCutoffIso,
  };
}
