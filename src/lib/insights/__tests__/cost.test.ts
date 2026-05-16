import { describe, expect, it } from 'vitest';
import { generateCostInsights } from '../generators/cost';
import { makeDebt, NOW_ISO } from './helpers';

describe('insights/generators/cost', () => {
    it('returns empty array when there are no debts', () => {
        expect(generateCostInsights({ debts: [], computedAt: NOW_ISO })).toEqual([]);
    });

    it('emits monthly-interest insight when total interest > 0', () => {
        const debts = [makeDebt({ balance: 10000, apr: 24, minPayment: 500 })];
        const out = generateCostInsights({ debts, computedAt: NOW_ISO });
        const monthly = out.find((i) => i.id === 'cost-monthly-interest');
        expect(monthly).toBeDefined();
        expect(monthly!.category).toBe('cost');
        expect(monthly!.body).toMatch(/Q200\.00/);
        expect(monthly!.body).toMatch(/Actualmente pagás/);
    });

    it('skips monthly-interest insight when APR is zero', () => {
        const debts = [makeDebt({ apr: 0 })];
        const out = generateCostInsights({ debts, computedAt: NOW_ISO });
        expect(out.find((i) => i.id === 'cost-monthly-interest')).toBeUndefined();
    });

    it('marks attention severity when interest is >= 40% of payments', () => {
        const debts = [makeDebt({ balance: 10000, apr: 30, minPayment: 250 })];
        const out = generateCostInsights({ debts, computedAt: NOW_ISO });
        const monthly = out.find((i) => i.id === 'cost-monthly-interest');
        expect(monthly!.severity).toBe('attention');
    });

    it('emits most-expensive-debt insight with creditor and apr', () => {
        const debts = [
            makeDebt({ id: 'a', creditor: 'Banrural', balance: 2000, apr: 8 }),
            makeDebt({ id: 'b', creditor: 'BAC', balance: 10000, apr: 36 }),
        ];
        const out = generateCostInsights({ debts, computedAt: NOW_ISO });
        const exp = out.find((i) => i.id === 'cost-most-expensive-debt');
        expect(exp).toBeDefined();
        expect(exp!.body).toMatch(/BAC/);
        expect(exp!.body).toMatch(/36%/);
    });

    it('uses neutral observational language (no prescriptive verbs)', () => {
        const debts = [makeDebt({ balance: 10000, apr: 24, minPayment: 500 })];
        const out = generateCostInsights({ debts, computedAt: NOW_ISO });
        const forbidden = /(recomendamos|deberías|conviene|te aconsejo|lo mejor es)/i;
        for (const insight of out) {
            expect(insight.title).not.toMatch(forbidden);
            expect(insight.body).not.toMatch(forbidden);
        }
    });
});
