'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/actions/admin-auth';
import { computeFunnel, type FunnelResult } from '@/lib/funnel/aggregate';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { drizzleListMarketingEventNamesSince } from '@/lib/billing/drizzle';

export async function getFunnelLast30Days(): Promise<FunnelResult> {
    await requirePermission('reports:read');
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (isDrizzleEnabled()) {
        const data = await drizzleListMarketingEventNamesSince(sinceDate);
        return computeFunnel(data);
    }

    const admin = createAdminClient();
    const since = sinceDate.toISOString();
    const { data, error } = await admin
        .from('marketing_funnel_events')
        .select('event_name')
        .gte('occurred_at', since);
    if (error) throw error;
    return computeFunnel(data ?? []);
}
