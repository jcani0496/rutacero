'use server';

import { logger } from '@/lib/logger';
import { getInsightsForUser, type InsightsResult } from '@/lib/insights';
import { requireUserTenant } from '@/lib/tenant/server';

/**
 * Server action returning the current user's precomputed insights. Safe to
 * call from React Server Components / `Suspense` wrappers — never throws on
 * cache/data errors; degrades to an empty result instead.
 */
export async function fetchUserInsights(): Promise<InsightsResult> {
    try {
        const { supabase, user, tenantId } = await requireUserTenant();
        return await getInsightsForUser({ supabase, tenantId, userId: user.id });
    } catch (err) {
        logger.error({ err }, '[insights] fetchUserInsights failed');
        return { insights: [], totalDebts: 0, hasData: false };
    }
}
