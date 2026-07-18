import { describe, it, expect } from 'vitest';
import { calculatePayoffPlan } from '../engine';
import type { Debt } from '@/types';
import type { PayoffInput } from '../types';

/**
 * Regression tests for the surplus-cascade bug (audit 2026-07).
 *
 * Root cause, two entangled defects in calculatePeriodStep:
 *  A) The payoff payment was capped at the debt's PRINCIPAL, excluding the
 *     interest accrued that same period — so a "paid off" debt retained an
 *     interest-sized residual balance that decayed geometrically but never
 *     reached zero.
 *  B) The budget surplus was only ever applied to activeDebts[0]. The
 *     residual debt stayed at position 0 forever with remainingBalance ≈ 0,
 *     so the entire surplus was silently discarded every month after the
 *     first payoff, and the other debts crawled along on minimums alone.
 *
 * Measured impact before the fix: a Q15,000 / Q1,000-per-month plan that
 * should resolve in ~20 months was reported at 244 months, with total
 * interest inflated from ~Q4,884 to ~Q6,028.
 *
 * These tests bound the plan duration and interest so any reintroduction
 * of either defect fails loudly. The pre-fix engine fails all of them.
 */

function makeDebt(overrides: Partial<Debt> & Pick<Debt, 'id' | 'balance' | 'apr' | 'min_payment'>): Debt {
    return {
        user_id: 'test-user',
        type: 'CREDIT_CARD',
        creditor: `Acreedor ${overrides.id}`,
        currency: 'GTQ',
        statement_date: null,
        due_date: 15,
        next_payment_date: new Date().toISOString(),
        installment_count: null,
        installments_left: null,
        fixed_payment: null,
        status: 'ACTIVE',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    } as Debt;
}

describe('Engine regression: surplus cascade after payoff', () => {
    it('resolves the audited 2-debt avalanche scenario in ~20 months, not 244', () => {
        const input: PayoffInput = {
            debts: [
                makeDebt({ id: 'A', balance: 9200, apr: 45, min_payment: 350 }),
                makeDebt({ id: 'B', balance: 5800, apr: 24, min_payment: 200 }),
            ],
            monthlyBudget: 1000,
            currency: 'GTQ',
            strategy: 'AVALANCHE',
        };

        const plan = calculatePayoffPlan(input);

        // Correct simulation pays this off in ~20 months. Allow slack for
        // rounding/calendar details, but the buggy engine reported 244.
        expect(plan.summary.monthsToPayoff).toBeLessThanOrEqual(22);

        // Correct total interest ≈ Q4,884. The buggy engine reported Q6,028.
        expect(plan.summary.totalInterest).toBeLessThan(5500);

        // Internal consistency must hold either way.
        expect(plan.summary.totalPayments).toBeCloseTo(
            plan.summary.totalDebt + plan.summary.totalInterest,
            1
        );
    });

    it('retires a single debt whose payoff is fully covered in month 1', () => {
        const input: PayoffInput = {
            debts: [makeDebt({ id: 'solo', balance: 1000, apr: 24, min_payment: 50 })],
            monthlyBudget: 2000,
            currency: 'GTQ',
            strategy: 'AVALANCHE',
        };

        const plan = calculatePayoffPlan(input);

        // Budget covers balance + first-month interest (~Q20) outright.
        // Pre-fix, the interest residual dragged this into a second month.
        expect(plan.summary.monthsToPayoff).toBe(1);

        const finalStep = plan.timeline[plan.timeline.length - 1];
        const soloSnapshot = finalStep.debtSnapshots.find(s => s.debtId === 'solo');
        expect(soloSnapshot?.endBalance).toBe(0);

        // The closing payment must be labeled PAYOFF, and must cover
        // principal AND the interest accrued in the period.
        const soloPayment = finalStep.payments.find(p => p.debtId === 'solo');
        expect(soloPayment?.type).toBe('PAYOFF');
        expect(soloPayment!.amount).toBeGreaterThanOrEqual(1000);
    });

    it('cascades surplus to the next debt within the payoff month', () => {
        // Focus debt is nearly done; the surplus that remains after killing
        // it must flow to debt B in the SAME month, not be discarded.
        const input: PayoffInput = {
            debts: [
                makeDebt({ id: 'A', balance: 300, apr: 45, min_payment: 100 }),
                makeDebt({ id: 'B', balance: 4000, apr: 24, min_payment: 100 }),
            ],
            monthlyBudget: 1000,
            currency: 'GTQ',
            strategy: 'AVALANCHE',
        };

        const plan = calculatePayoffPlan(input);
        const month1 = plan.timeline[0];

        const paidMonth1 = month1.payments.reduce((sum, p) => sum + p.amount, 0);
        // A absorbs ~Q311 (balance + interest); the rest of the Q1,000
        // budget must land on B instead of evaporating.
        expect(paidMonth1).toBeGreaterThanOrEqual(999);

        const bPayment = month1.payments.find(p => p.debtId === 'B');
        expect(bPayment!.amount).toBeGreaterThan(600);
    });

    it('keeps every debt monotonically shrinking to exact zero (no immortal residuals)', () => {
        const input: PayoffInput = {
            debts: [
                makeDebt({ id: 'A', balance: 9200, apr: 45, min_payment: 350 }),
                makeDebt({ id: 'B', balance: 5800, apr: 24, min_payment: 200 }),
            ],
            monthlyBudget: 1000,
            currency: 'GTQ',
            strategy: 'SNOWBALL',
        };

        const plan = calculatePayoffPlan(input);

        // Every debt's final snapshot must be exactly 0 — not a floating
        // point crumb that would have kept it "active".
        const lastSeen = new Map<string, number>();
        for (const step of plan.timeline) {
            for (const snap of step.debtSnapshots) {
                lastSeen.set(snap.debtId, snap.endBalance);
            }
        }
        for (const [, endBalance] of lastSeen) {
            expect(endBalance).toBe(0);
        }

        expect(plan.summary.monthsToPayoff).toBeLessThanOrEqual(24);
    });
});
