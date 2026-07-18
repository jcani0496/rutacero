import { describe, expect, it } from 'vitest';
import {
    debtsDueWithin,
    monthlyInterestFor,
    mostExpensiveDebt,
    nextUpcomingPayment,
    payoffMonths,
    smallestDebt,
    totalBalance,
    totalInterestPaid,
    totalMinPayments,
    totalMonthlyInterest,
    whatIfExtraPayment,
} from '../math';
import { makeDebt, NOW_ISO } from './helpers';

describe('insights/math', () => {
    describe('monthlyInterestFor', () => {
        it('computes balance * apr/100 / 12', () => {
            // 10000 * 24% / 12 = 200
            expect(monthlyInterestFor({ balance: 10000, apr: 24 })).toBe(200);
        });

        it('returns 0 when apr is null', () => {
            expect(monthlyInterestFor({ balance: 10000, apr: null })).toBe(0);
        });

        it('returns 0 when balance is 0', () => {
            expect(monthlyInterestFor({ balance: 0, apr: 24 })).toBe(0);
        });

        it('returns 0 for negative apr', () => {
            expect(monthlyInterestFor({ balance: 1000, apr: -5 })).toBe(0);
        });

        it('returns 0 for non-finite inputs', () => {
            expect(monthlyInterestFor({ balance: NaN, apr: 24 })).toBe(0);
            expect(monthlyInterestFor({ balance: 1000, apr: Infinity })).toBe(0);
        });
    });

    describe('totalMonthlyInterest', () => {
        it('sums interest across debts', () => {
            const debts = [
                makeDebt({ balance: 10000, apr: 24 }), // 200
                makeDebt({ balance: 5000, apr: 12 }), // 50
            ];
            expect(totalMonthlyInterest(debts)).toBe(250);
        });
        it('returns 0 for empty list', () => {
            expect(totalMonthlyInterest([])).toBe(0);
        });
    });

    describe('totalMinPayments and totalBalance', () => {
        it('sums each across debts', () => {
            const debts = [
                makeDebt({ balance: 100, minPayment: 10 }),
                makeDebt({ balance: 200, minPayment: 20 }),
            ];
            expect(totalBalance(debts)).toBe(300);
            expect(totalMinPayments(debts)).toBe(30);
        });
    });

    describe('payoffMonths', () => {
        it('handles zero APR with simple division', () => {
            // 1000 / 100 = 10 months exact
            expect(payoffMonths(1000, 0, 100)).toBe(10);
            expect(payoffMonths(1000, null, 100)).toBe(10);
        });

        it('rounds up partial months', () => {
            expect(payoffMonths(1000, 0, 300)).toBe(4);
        });

        it('returns null when payment <= interest portion', () => {
            // 10000 * 24%/12 = 200 monthly interest; payment of 200 does not amortize
            expect(payoffMonths(10000, 24, 200)).toBeNull();
        });

        it('returns null for invalid inputs', () => {
            expect(payoffMonths(0, 24, 100)).toBeNull();
            expect(payoffMonths(1000, 24, 0)).toBeNull();
            expect(payoffMonths(NaN, 24, 100)).toBeNull();
        });

        it('returns a finite reasonable number for a typical credit card', () => {
            // 10000 balance @ 24% APR, paying 500/mo
            const m = payoffMonths(10000, 24, 500);
            expect(m).not.toBeNull();
            expect(m).toBeGreaterThan(20);
            expect(m).toBeLessThan(30);
        });

        it('caps at 600 months for runaway scenarios with zero APR', () => {
            expect(payoffMonths(1_000_000, 0, 1)).toBe(600);
        });
    });

    describe('totalInterestPaid', () => {
        it('is zero when APR is zero', () => {
            expect(totalInterestPaid(1000, 0, 100)).toBe(0);
        });
        it('is positive and finite for typical inputs', () => {
            const interest = totalInterestPaid(10000, 24, 500);
            expect(interest).not.toBeNull();
            expect(interest!).toBeGreaterThan(0);
            expect(interest!).toBeLessThan(10000);
        });
        it('returns null when not amortizing', () => {
            expect(totalInterestPaid(10000, 24, 200)).toBeNull();
        });
    });

    describe('whatIfExtraPayment', () => {
        it('returns months and interest saved for typical case', () => {
            const delta = whatIfExtraPayment(10000, 24, 500, 500);
            expect(delta).not.toBeNull();
            expect(delta!.baseMonths).toBeGreaterThan(delta!.newMonths);
            expect(delta!.monthsSaved).toBeGreaterThan(0);
            expect(delta!.interestSaved).toBeGreaterThan(0);
        });

        it('returns null when extra is zero', () => {
            expect(whatIfExtraPayment(10000, 24, 500, 0)).toBeNull();
        });

        it('returns null when base payment does not amortize', () => {
            expect(whatIfExtraPayment(10000, 24, 100, 50)).toBeNull();
        });

        it('saves more time the larger the extra', () => {
            const small = whatIfExtraPayment(10000, 24, 500, 100);
            const large = whatIfExtraPayment(10000, 24, 500, 1000);
            expect(large!.monthsSaved).toBeGreaterThanOrEqual(small!.monthsSaved);
            expect(large!.interestSaved).toBeGreaterThanOrEqual(small!.interestSaved);
        });
    });

    describe('mostExpensiveDebt', () => {
        it('returns the debt with highest monthly interest', () => {
            const cheap = makeDebt({ id: 'a', balance: 1000, apr: 10 }); // ~8.33
            const expensive = makeDebt({ id: 'b', balance: 5000, apr: 40 }); // ~166.67
            expect(mostExpensiveDebt([cheap, expensive])!.id).toBe('b');
        });

        it('returns null when no debt has positive interest', () => {
            expect(mostExpensiveDebt([makeDebt({ apr: 0 })])).toBeNull();
            expect(mostExpensiveDebt([])).toBeNull();
        });
    });

    describe('smallestDebt', () => {
        it('returns the debt with smallest positive balance', () => {
            const small = makeDebt({ id: 'a', balance: 100 });
            const big = makeDebt({ id: 'b', balance: 5000 });
            expect(smallestDebt([big, small])!.id).toBe('a');
        });
        it('ignores zero-balance debts', () => {
            expect(smallestDebt([makeDebt({ balance: 0 })])).toBeNull();
        });
    });

    describe('debtsDueWithin', () => {
        it('returns debts due inside the window, sorted ascending', () => {
            const d1 = makeDebt({ id: 'a', nextPaymentDate: '2026-05-16' });
            const d2 = makeDebt({ id: 'b', nextPaymentDate: '2026-05-20' });
            const out = makeDebt({ id: 'c', nextPaymentDate: '2026-06-01' });
            const past = makeDebt({ id: 'd', nextPaymentDate: '2026-04-01' });
            const result = debtsDueWithin([out, d2, d1, past], NOW_ISO, 7);
            expect(result.map((d) => d.id)).toEqual(['a', 'b']);
        });

        it('returns empty when no debts in window', () => {
            const debts = [makeDebt({ nextPaymentDate: '2026-07-01' })];
            expect(debtsDueWithin(debts, NOW_ISO, 7)).toEqual([]);
        });

        it('returns empty for invalid fromIso', () => {
            expect(debtsDueWithin([makeDebt()], 'not-a-date', 7)).toEqual([]);
        });

        // Regression (audit 2026-07): a payment due TODAY was silently
        // dropped — the bare date parsed to UTC midnight, always earlier
        // than the computedAt timestamp.
        it('includes a payment due today', () => {
            const today = makeDebt({ id: 'today', nextPaymentDate: '2026-05-15' });
            const result = debtsDueWithin([today], NOW_ISO, 7);
            expect(result.map((d) => d.id)).toEqual(['today']);
        });

        it('treats the window upper bound as inclusive', () => {
            const edge = makeDebt({ id: 'edge', nextPaymentDate: '2026-05-22' });
            const past = makeDebt({ id: 'past', nextPaymentDate: '2026-05-23' });
            const result = debtsDueWithin([edge, past], NOW_ISO, 7);
            expect(result.map((d) => d.id)).toEqual(['edge']);
        });

        // Regression (audit 2026-07): for a Guatemala user in the evening
        // (UTC-6) the UTC calendar day has already rolled over; "today in
        // Guatemala" must still count as today.
        it('uses the Guatemala calendar day, not the UTC day', () => {
            // 2026-07-19T02:00Z == 2026-07-18 20:00 in Guatemala.
            const eveningGT = '2026-07-19T02:00:00.000Z';
            const todayGT = makeDebt({ id: 'gt', nextPaymentDate: '2026-07-18' });
            const result = debtsDueWithin([todayGT], eveningGT, 7);
            expect(result.map((d) => d.id)).toEqual(['gt']);
        });
    });

    describe('nextUpcomingPayment', () => {
        it('returns the earliest upcoming payment', () => {
            const debts = [
                makeDebt({ id: 'a', nextPaymentDate: '2026-06-01' }),
                makeDebt({ id: 'b', nextPaymentDate: '2026-05-18' }),
                makeDebt({ id: 'past', nextPaymentDate: '2026-04-01' }),
            ];
            expect(nextUpcomingPayment(debts, NOW_ISO)!.id).toBe('b');
        });

        it('returns null when no upcoming payments', () => {
            expect(
                nextUpcomingPayment(
                    [makeDebt({ nextPaymentDate: '2026-01-01' })],
                    NOW_ISO,
                ),
            ).toBeNull();
        });

        // Regression (audit 2026-07): same today-dropped bug as
        // debtsDueWithin — "Próximo pago programado" vanished on the day
        // it mattered most.
        it('returns a payment due today', () => {
            const today = makeDebt({ id: 'today', nextPaymentDate: '2026-05-15' });
            expect(nextUpcomingPayment([today], NOW_ISO)!.id).toBe('today');
        });

        it('prefers today over tomorrow', () => {
            const debts = [
                makeDebt({ id: 'tomorrow', nextPaymentDate: '2026-05-16' }),
                makeDebt({ id: 'today', nextPaymentDate: '2026-05-15' }),
            ];
            expect(nextUpcomingPayment(debts, NOW_ISO)!.id).toBe('today');
        });
    });
});
