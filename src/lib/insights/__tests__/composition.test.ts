import { describe, expect, it } from 'vitest';
import { generateCompositionInsights } from '../generators/composition';
import { makeDebt, NOW_ISO } from './helpers';

describe('insights/generators/composition', () => {
    it('returns empty array when there are no debts', () => {
        expect(
            generateCompositionInsights({ debts: [], computedAt: NOW_ISO }),
        ).toEqual([]);
    });

    it('always emits total-debts insight when debts exist', () => {
        const debts = [makeDebt({ balance: 1500 }), makeDebt({ id: 'b', balance: 500 })];
        const out = generateCompositionInsights({ debts, computedAt: NOW_ISO });
        const total = out.find((i) => i.id === 'composition-total-debts');
        expect(total).toBeDefined();
        expect(total!.body).toMatch(/2 deudas activas/);
        expect(total!.body).toMatch(/Q2,000\.00/);
    });

    it('handles singular wording for one debt', () => {
        const out = generateCompositionInsights({
            debts: [makeDebt()],
            computedAt: NOW_ISO,
        });
        const total = out.find((i) => i.id === 'composition-total-debts');
        expect(total!.body).toMatch(/1 deuda activa/);
    });

    it('emits smallest-debt insight with payoff estimate', () => {
        const debts = [
            makeDebt({ id: 'a', balance: 5000, minPayment: 200, apr: 24 }),
            makeDebt({ id: 'b', creditor: 'Banrural', balance: 800, minPayment: 100, apr: 12 }),
        ];
        const out = generateCompositionInsights({ debts, computedAt: NOW_ISO });
        const small = out.find((i) => i.id === 'composition-smallest-debt');
        expect(small).toBeDefined();
        expect(small!.body).toMatch(/Banrural/);
        expect(small!.body).toMatch(/Q800\.00/);
        expect(small!.body).toMatch(/aproximadamente/);
    });

    it('omits smallest-debt insight when min payment does not amortize', () => {
        const debts = [makeDebt({ balance: 10000, apr: 60, minPayment: 50 })];
        const out = generateCompositionInsights({ debts, computedAt: NOW_ISO });
        expect(out.find((i) => i.id === 'composition-smallest-debt')).toBeUndefined();
    });

    it('uses neutral language', () => {
        const debts = [makeDebt(), makeDebt({ id: 'b', balance: 200, minPayment: 50 })];
        const out = generateCompositionInsights({ debts, computedAt: NOW_ISO });
        const forbidden = /(recomendamos|deberías|conviene|te aconsejo|lo mejor es)/i;
        for (const insight of out) {
            expect(insight.body).not.toMatch(forbidden);
        }
    });
});
