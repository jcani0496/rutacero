/**
 * Server-only entry points for the Movimientos module.
 *
 * Anything that touches Supabase, the structured logger (pino), or the
 * Upstash cache lives here. Pure logic (types, buckets, formatters,
 * aggregator) stays in their own files and is re-exported from
 * `./index.ts` so client components can import them safely.
 *
 * Why split: importing this file from a client component would pull
 * `@/lib/logger` → `pino` → `pino.destination()` into the browser
 * bundle, which crashes on module evaluation because `destination` is a
 * Node-only API. The `'use server'`-style separation keeps the import
 * graph clean: server components / server actions import from
 * `@/lib/movimientos/server`; client components import from
 * `@/lib/movimientos`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { logger } from '@/lib/logger';
import { aggregate } from './aggregator';
import { buildWindow } from './buckets';
import {
    readMovimientosCache,
    writeMovimientosCache,
} from './cache';
import type {
    Granularity,
    MovimientosResult,
    RawMovement,
} from './types';
import { DEFAULT_GRANULARITY } from './types';

export interface GetMovimientosParams {
    supabase: SupabaseClient<Database>;
    tenantId: string;
    userId: string;
    granularity?: Granularity;
    /** Override "now" — used by tests / shareable URLs. */
    now?: Date;
    currency?: string;
    /** When true, bypass Redis read (still writes). */
    skipCache?: boolean;
}

/**
 * Top-level fetcher. Returns a fully-formed `MovimientosResult` ready for
 * the UI. Caches per (user, granularity).
 */
export async function getMovimientos(
    params: GetMovimientosParams,
): Promise<MovimientosResult> {
    const {
        supabase,
        tenantId,
        userId,
        granularity = DEFAULT_GRANULARITY,
        now = new Date(),
        currency = 'GTQ',
        skipCache = false,
    } = params;

    if (!skipCache) {
        const cached = await readMovimientosCache(userId, granularity);
        if (cached) return cached;
    }

    // Build the window first so we know the date range to query. Tiny work,
    // not worth optimizing — saves us from pulling 5 years of data when the
    // user only looks at the last 90 days.
    const window = buildWindow(now, granularity);
    if (window.length === 0) {
        const empty = aggregate({ movements: [], granularity, now, currency });
        await writeMovimientosCache(userId, granularity, empty);
        return empty;
    }
    const windowStart = window[0].bucketStart.slice(0, 10);
    const windowEnd = window[window.length - 1].bucketEnd.slice(0, 10);

    const movements: RawMovement[] = [];

    // INCOME
    const incomeRes = await supabase
        .from('income_events')
        .select('date, amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('date', windowStart)
        .lte('date', windowEnd);

    if (incomeRes.error) {
        logger.warn({ err: incomeRes.error, userId }, '[movimientos] income query failed');
    } else {
        for (const row of incomeRes.data ?? []) {
            movements.push({
                date: row.date,
                amount: Number(row.amount) || 0,
                source: 'income',
            });
        }
    }

    // ESSENTIAL EXPENSES (use actual_amount, fall back to amount)
    const expenseRes = await supabase
        .from('essential_expenses')
        .select('next_date, amount, actual_amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('next_date', windowStart)
        .lte('next_date', windowEnd);

    if (expenseRes.error) {
        logger.warn({ err: expenseRes.error, userId }, '[movimientos] expense query failed');
    } else {
        for (const row of expenseRes.data ?? []) {
            const amount = row.actual_amount != null ? Number(row.actual_amount) : Number(row.amount);
            movements.push({
                date: row.next_date,
                amount: amount || 0,
                source: 'essential_expense',
            });
        }
    }

    // DEBT PAYMENTS
    const paymentsRes = await supabase
        .from('payments')
        .select('payment_date, amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('payment_date', windowStart)
        .lte('payment_date', windowEnd);

    if (paymentsRes.error) {
        logger.warn({ err: paymentsRes.error, userId }, '[movimientos] payments query failed');
    } else {
        for (const row of paymentsRes.data ?? []) {
            movements.push({
                date: row.payment_date,
                amount: Number(row.amount) || 0,
                source: 'debt_payment',
            });
        }
    }

    const result = aggregate({ movements, granularity, now, currency });
    await writeMovimientosCache(userId, granularity, result);
    return result;
}

/**
 * Re-export for server callers that previously imported from `@/lib/movimientos`.
 * Cache utilities are server-only because they pull the structured logger.
 */
export { invalidateMovimientosCache } from './cache';
