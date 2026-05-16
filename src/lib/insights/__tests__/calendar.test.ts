import { describe, expect, it } from 'vitest';
import { generateCalendarInsights } from '../generators/calendar';
import { makeDebt, NOW_ISO } from './helpers';

describe('insights/generators/calendar', () => {
    it('returns empty array when there are no debts', () => {
        expect(generateCalendarInsights({ debts: [], computedAt: NOW_ISO })).toEqual([]);
    });

    it('emits next-payment insight with creditor and date', () => {
        const debts = [
            makeDebt({ id: 'a', creditor: 'BAC', nextPaymentDate: '2026-05-22', minPayment: 350 }),
            makeDebt({ id: 'b', creditor: 'Banrural', nextPaymentDate: '2026-06-10' }),
        ];
        const out = generateCalendarInsights({ debts, computedAt: NOW_ISO });
        const next = out.find((i) => i.id === 'calendar-next-payment');
        expect(next).toBeDefined();
        expect(next!.body).toMatch(/BAC/);
        expect(next!.body).toMatch(/Q350\.00/);
    });

    it('omits next-payment insight when no future payment exists', () => {
        const debts = [makeDebt({ nextPaymentDate: '2026-01-01' })];
        const out = generateCalendarInsights({ debts, computedAt: NOW_ISO });
        expect(out.find((i) => i.id === 'calendar-next-payment')).toBeUndefined();
    });

    it('emits week-upcoming insight with count and total in 7-day window', () => {
        const debts = [
            makeDebt({ id: 'a', nextPaymentDate: '2026-05-16', minPayment: 100 }),
            makeDebt({ id: 'b', nextPaymentDate: '2026-05-20', minPayment: 200 }),
            makeDebt({ id: 'out', nextPaymentDate: '2026-06-01', minPayment: 999 }),
        ];
        const out = generateCalendarInsights({ debts, computedAt: NOW_ISO });
        const week = out.find((i) => i.id === 'calendar-week-upcoming');
        expect(week).toBeDefined();
        expect(week!.body).toMatch(/2 pagos/);
        expect(week!.body).toMatch(/Q300\.00/);
    });

    it('marks week-upcoming attention when 3 or more payments due', () => {
        const debts = [
            makeDebt({ id: 'a', nextPaymentDate: '2026-05-16', minPayment: 100 }),
            makeDebt({ id: 'b', nextPaymentDate: '2026-05-17', minPayment: 100 }),
            makeDebt({ id: 'c', nextPaymentDate: '2026-05-18', minPayment: 100 }),
        ];
        const out = generateCalendarInsights({ debts, computedAt: NOW_ISO });
        const week = out.find((i) => i.id === 'calendar-week-upcoming');
        expect(week!.severity).toBe('attention');
    });

    it('omits week-upcoming insight when no debts in window', () => {
        const debts = [makeDebt({ nextPaymentDate: '2026-09-01' })];
        const out = generateCalendarInsights({ debts, computedAt: NOW_ISO });
        expect(out.find((i) => i.id === 'calendar-week-upcoming')).toBeUndefined();
    });
});
