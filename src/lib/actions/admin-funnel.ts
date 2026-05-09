'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/actions/admin-auth';
import { computeFunnel, type FunnelResult } from '@/lib/funnel/aggregate';

export async function getFunnelLast30Days(): Promise<FunnelResult> {
    await requirePermission('reports:read');
    const admin = createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
        .from('marketing_funnel_events')
        .select('event_name')
        .gte('occurred_at', since);
    if (error) throw error;
    return computeFunnel(data ?? []);
}
