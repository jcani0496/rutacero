/**
 * Pure aggregation logic for the Movimientos view.
 *
 * Given a list of raw movements and a granularity, returns the bucketed
 * series + totals. Empty buckets are kept (rendered as gaps in the chart).
 *
 * IMPORTANT — double-counting:
 *   `essential_expenses` and `payments` (debt-to-creditor) are summed into
 *   the SAME "expense" series. By design they should not overlap (rent is
 *   not a credit card payment), but a sloppy user might register a debt
 *   payment as an essential expense. We document this here and do NOT
 *   auto-deduplicate — the user is the source of truth for their data.
 */

import { bucketKey, buildWindow, parseDate } from './buckets';
import type {
    Granularity,
    MovimientosBucket,
    MovimientosResult,
    MovimientosTotals,
    RawMovement,
} from './types';

export interface AggregateParams {
    movements: RawMovement[];
    granularity: Granularity;
    /** "Now" — controls the window end. Future buckets are NEVER included. */
    now: Date;
    /** Currency for the result envelope. Default 'GTQ'. */
    currency?: string;
}

/**
 * Build the bucketed series + totals. Pure, deterministic.
 */
export function aggregate(params: AggregateParams): MovimientosResult {
    const { movements, granularity, now, currency = 'GTQ' } = params;

    const window = buildWindow(now, granularity);
    if (window.length === 0) {
        return emptyResult(granularity, now, currency);
    }

    const byKey = new Map<string, MovimientosBucket>();
    for (const b of window) byKey.set(b.key, b);

    const windowStart = new Date(window[0].bucketStart);
    const windowEnd = new Date(window[window.length - 1].bucketEnd);

    let movementCount = 0;

    for (const m of movements) {
        const amount = Number(m.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const date = parseDate(m.date);
        if (Number.isNaN(date.getTime())) continue;
        // Drop movements outside the window — defensive: the SQL layer should
        // already filter, but the aggregator must be robust to overshoot.
        if (date < windowStart || date > windowEnd) continue;

        const key = bucketKey(date, granularity);
        const bucket = byKey.get(key);
        if (!bucket) continue;

        if (m.source === 'income') {
            bucket.income += amount;
        } else {
            // essential_expense + debt_payment both flow into "expense".
            bucket.expense += amount;
        }
        bucket.isEmpty = false;
        movementCount += 1;
    }

    // Recompute derived balances + flag empties.
    for (const b of window) {
        b.balance = b.income - b.expense;
    }

    const totals: MovimientosTotals = window.reduce(
        (acc, b) => {
            acc.income += b.income;
            acc.expense += b.expense;
            return acc;
        },
        { income: 0, expense: 0, balance: 0 },
    );
    totals.balance = totals.income - totals.expense;

    return {
        granularity,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        buckets: window,
        totals,
        currency,
        movementCount,
        hasData: movementCount > 0,
        computedAt: now.toISOString(),
    };
}

function emptyResult(
    granularity: Granularity,
    now: Date,
    currency: string,
): MovimientosResult {
    return {
        granularity,
        windowStart: now.toISOString(),
        windowEnd: now.toISOString(),
        buckets: [],
        totals: { income: 0, expense: 0, balance: 0 },
        currency,
        movementCount: 0,
        hasData: false,
        computedAt: now.toISOString(),
    };
}

/**
 * Number of buckets in the window that have at least one recorded movement.
 * UI uses this to decide whether to show the "insufficient data" card vs the
 * actual chart.
 */
export function nonEmptyBucketCount(result: MovimientosResult): number {
    return result.buckets.filter((b) => !b.isEmpty).length;
}

/**
 * Helper for the UI to decide if a "missing series" banner is needed.
 * Returns the series that have zero data across the whole window.
 */
export function missingSeries(result: MovimientosResult): Array<'income' | 'expense'> {
    const missing: Array<'income' | 'expense'> = [];
    if (result.totals.income === 0 && result.hasData) missing.push('income');
    if (result.totals.expense === 0 && result.hasData) missing.push('expense');
    return missing;
}
