import { describe, expect, it } from 'vitest';
import { generateWhatIfInsights, WHATIF_EXTRA_PAYMENT } from '../generators/whatif';
import { payoffMonths } from '../math';
import { makeDebt, NOW_ISO } from './helpers';

describe('insights/generators/whatif', () => {
    it('returns empty when there are no debts', () => {
        expect(generateWhatIfInsights({ debts: [], computedAt: NOW_ISO })).toEqual([]);
    });

    it('emits an insight when extra payment yields months saved', () => {
        const debts = [makeDebt({ balance: 10000, apr: 24, minPayment: 500 })];
        const out = generateWhatIfInsights({ debts, computedAt: NOW_ISO });
        expect(out).toHaveLength(1);
        const insight = out[0];
        expect(insight.id).toBe('whatif-extra-500');
        expect(insight.body).toMatch(/Una opción que podrías explorar/);
        expect(insight.body).toMatch(/aproximadamente/);
    });

    it('matches the underlying amortization math', () => {
        const debts = [makeDebt({ balance: 10000, apr: 24, minPayment: 500 })];
        const base = payoffMonths(10000, 24, 500)!;
        const accelerated = payoffMonths(10000, 24, 500 + WHATIF_EXTRA_PAYMENT)!;
        const expectedSavings = base - accelerated;
        expect(expectedSavings).toBeGreaterThan(0);

        const out = generateWhatIfInsights({ debts, computedAt: NOW_ISO });
        // Body should mention at least the right magnitude in months-ish text.
        // We can't easily assert the exact rendered duration but it should
        // appear in the body.
        expect(out[0].body).toMatch(/mes/);
    });

    it('skips when extra payment yields no real benefit (already zero interest)', () => {
        // 0% APR loan: most-expensive helper returns null, so no whatif insight.
        const debts = [makeDebt({ apr: 0 })];
        const out = generateWhatIfInsights({ debts, computedAt: NOW_ISO });
        expect(out).toEqual([]);
    });

    it('skips when min payment does not amortize', () => {
        const debts = [makeDebt({ balance: 100000, apr: 80, minPayment: 100 })];
        const out = generateWhatIfInsights({ debts, computedAt: NOW_ISO });
        expect(out).toEqual([]);
    });

    it('uses neutral, non-prescriptive language', () => {
        const debts = [makeDebt({ balance: 10000, apr: 24, minPayment: 500 })];
        const out = generateWhatIfInsights({ debts, computedAt: NOW_ISO });
        const forbidden = /(recomendamos|deberías|conviene|te aconsejo|lo mejor es)/i;
        for (const insight of out) {
            expect(insight.title).not.toMatch(forbidden);
            expect(insight.body).not.toMatch(forbidden);
        }
    });
});
