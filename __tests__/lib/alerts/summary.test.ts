import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getAlertSummaryFor } from '@/lib/alerts/summary';

// Minimal stub: the helper only uses `.from(table).select(...).eq(...)...`
// chains, returning awaited `{ data }`. We build a chainable proxy that
// always resolves to the configured `data` for the requested table.
function makeStubSupabase(tables: Record<string, unknown>) {
    const build = (data: unknown) => {
        const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            single: () => Promise.resolve({ data, error: null }),
            maybeSingle: () => Promise.resolve({ data, error: null }),
            then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
                resolve({ data, error: null }),
        };
        return chain;
    };

    const client = {
        from: (table: string) => build(tables[table] ?? null),
    } as unknown as SupabaseClient<Database>;

    return client;
}

describe('getAlertSummaryFor', () => {
    beforeEach(() => {
        // Pin "today" so day-of-month arithmetic in the helper is deterministic.
        // 2026-05-10 puts todayDay = 10 (May).
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a zeroed summary when the tenant has no active debts', async () => {
        const supabase = makeStubSupabase({
            debts: [],
            subscriptions: { plan_code: 'FREE', status: 'ACTIVE' },
        });

        const summary = await getAlertSummaryFor({
            supabase,
            tenantId: 'tenant-1',
            userId: 'user-1',
        });

        expect(summary).toEqual({
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            topAlert: null,
        });
    });

    it('returns the expected summary shape and surfaces high-APR warnings', async () => {
        const supabase = makeStubSupabase({
            debts: [
                {
                    id: 'd1',
                    user_id: 'user-1',
                    creditor: 'TestCard',
                    balance: '5000',
                    apr: '60', // >= 40 triggers RISK_WARNING
                    min_payment: '500',
                    // todayDay=10 (pinned above), so daysUntilDue=18 — outside
                    // every due/overdue window, isolating the high-APR alert.
                    due_date: 28,
                    status: 'ACTIVE',
                    goal_target_date: null,
                    goal_extra_payment: null,
                },
            ],
            subscriptions: { plan_code: 'FREE', status: 'ACTIVE' },
        });

        const summary = await getAlertSummaryFor({
            supabase,
            tenantId: 'tenant-1',
            userId: 'user-1',
        });

        // Shape sanity.
        expect(summary).toHaveProperty('criticalCount');
        expect(summary).toHaveProperty('warningCount');
        expect(summary).toHaveProperty('infoCount');
        expect(summary).toHaveProperty('topAlert');

        // The single debt should produce exactly one WARNING (high APR).
        expect(summary.warningCount).toBe(1);
        expect(summary.criticalCount).toBe(0);
        expect(summary.topAlert?.type).toBe('RISK_WARNING');
        expect(summary.topAlert?.severity).toBe('WARNING');
    });
});
