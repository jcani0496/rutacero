'use server';

import { requireUserTenant } from '@/lib/tenant/server';
import { getMovimientos } from '@/lib/movimientos/server';
import {
    DEFAULT_GRANULARITY,
    GRANULARITIES,
    type Granularity,
    type MovimientosResult,
} from '@/lib/movimientos';

/**
 * Normalize a (possibly URL-supplied) granularity string into a valid value.
 * Falls back to the default for unknown / missing inputs.
 */
export async function normalizeGranularity(
    value: string | undefined | null,
): Promise<Granularity> {
    if (!value) return DEFAULT_GRANULARITY;
    return (GRANULARITIES as readonly string[]).includes(value)
        ? (value as Granularity)
        : DEFAULT_GRANULARITY;
}

export async function getMovimientosAggregates(input?: {
    granularity?: Granularity;
}): Promise<MovimientosResult> {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('currency_base')
        .eq('user_id', user.id)
        .maybeSingle();

    const currency = (profile as { currency_base?: string } | null)?.currency_base || 'GTQ';

    return getMovimientos({
        supabase,
        tenantId,
        userId: user.id,
        granularity: input?.granularity ?? DEFAULT_GRANULARITY,
        currency,
    });
}
