/**
 * Public entry point for the deterministic insights module.
 *
 * Responsibilities:
 *  - Fetch the user's active debts (the only DB call in this module).
 *  - Normalize them into pure DebtSnapshot objects.
 *  - Run each generator (pure functions) on that snapshot.
 *  - Rank the union of insights and cap at maxInsights.
 *  - Cache the result in Upstash Redis when configured.
 *
 * No LLM, no external HTTP calls, no business-logic side effects.
 */

import type { Database } from '@/types/supabase';
import { logger } from '@/lib/logger';
import { generateCalendarInsights } from './generators/calendar';
import { generateCompositionInsights } from './generators/composition';
import { generateCostInsights } from './generators/cost';
import { generateWhatIfInsights } from './generators/whatif';
import { rank } from './rank';
import { readInsightsCache, writeInsightsCache } from './cache';
import type { DebtSnapshot, InsightsResult } from './types';

export type {
    DebtSnapshot,
    GeneratorContext,
    Insight,
    InsightCategory,
    InsightSeverity,
    InsightsResult,
} from './types';
export { invalidateInsightsCache } from './cache';

const DEFAULT_MAX_INSIGHTS = 4;

type DebtRow = Database['public']['Tables']['debts']['Row'];

function toSnapshot(row: DebtRow): DebtSnapshot {
    return {
        id: row.id,
        creditor: row.creditor,
        balance: Number(row.balance) || 0,
        apr: row.apr === null ? null : Number(row.apr),
        minPayment: Number(row.min_payment) || 0,
        paymentDay: row.payment_day ?? null,
        nextPaymentDate: row.next_payment_date,
        currency: row.currency || 'GTQ',
        type: row.type,
    };
}

export interface GetInsightsParams {
    supabase: any;
    tenantId: string;
    userId: string;
    maxInsights?: number;
    /** When true, bypass Redis read (still writes on success). For tests/admin. */
    skipCache?: boolean;
    /** Override "now" — used by tests. */
    now?: Date;
}

export async function getInsightsForUser(
    params: GetInsightsParams,
): Promise<InsightsResult> {
    const {
        supabase,
        tenantId,
        userId,
        maxInsights = DEFAULT_MAX_INSIGHTS,
        skipCache = false,
        now = new Date(),
    } = params;

    if (!skipCache) {
        const cached = await readInsightsCache(tenantId, userId);
        if (cached) return cached;
    }

    const { data, error } = await supabase
        .from('debts')
        .select(
            'id, creditor, balance, apr, min_payment, payment_day, next_payment_date, currency, type, status, tenant_id',
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');

    if (error) {
        logger.error({ err: error, tenantId }, '[insights] debts query failed');
        return { insights: [], totalDebts: 0, hasData: false };
    }

    const rows = (data ?? []) as DebtRow[];
    const debts = rows.map(toSnapshot).filter((d) => d.balance > 0);

    if (debts.length === 0) {
        const empty: InsightsResult = { insights: [], totalDebts: 0, hasData: false };
        // Cache the empty result too — avoids re-querying on every dashboard load.
        await writeInsightsCache(tenantId, userId, empty);
        return empty;
    }

    const ctx = { debts, computedAt: now.toISOString() };
    const raw = [
        ...generateCostInsights(ctx),
        ...generateCompositionInsights(ctx),
        ...generateCalendarInsights(ctx),
        ...generateWhatIfInsights(ctx),
    ];

    const ranked = rank(raw, maxInsights);

    const result: InsightsResult = {
        insights: ranked,
        totalDebts: debts.length,
        hasData: true,
    };

    await writeInsightsCache(tenantId, userId, result);
    return result;
}
