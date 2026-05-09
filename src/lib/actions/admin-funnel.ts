import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/actions/admin-auth';

const STEPS = ['pricing_viewed', 'checkout_started', 'payment_succeeded'] as const;
type Step = (typeof STEPS)[number];

export interface FunnelResult extends Record<Step, number> {
    conversion_pricing_to_checkout: number;
    conversion_checkout_to_payment: number;
    conversion_pricing_to_payment: number;
}

export function computeFunnel(events: Array<{ event_name: string }>): FunnelResult {
    const counts: Record<Step, number> = {
        pricing_viewed: 0,
        checkout_started: 0,
        payment_succeeded: 0,
    };
    for (const e of events) {
        if ((STEPS as readonly string[]).includes(e.event_name)) {
            counts[e.event_name as Step] += 1;
        }
    }
    const safe = (n: number, d: number) => (d === 0 ? 0 : n / d);
    return {
        ...counts,
        conversion_pricing_to_checkout: safe(counts.checkout_started, counts.pricing_viewed),
        conversion_checkout_to_payment: safe(counts.payment_succeeded, counts.checkout_started),
        conversion_pricing_to_payment: safe(counts.payment_succeeded, counts.pricing_viewed),
    };
}

export async function getFunnelLast30Days(): Promise<FunnelResult> {
    await requireAdminAuth();
    const admin = createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
        .from('marketing_funnel_events')
        .select('event_name')
        .gte('occurred_at', since);
    if (error) throw error;
    return computeFunnel(data ?? []);
}
