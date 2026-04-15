import { describe, expect, it } from 'vitest';
import { calculatePayoffPlan, comparePlansPersonalized } from '../engine';
import type { Debt } from '@/types';
import type { PayoffStrategy } from '../types';

const contractDebts: Debt[] = [
  {
    id: 'debt-1',
    user_id: 'contract-user',
    type: 'CREDIT_CARD',
    creditor: 'Tarjeta Oro',
    balance: 4200,
    apr: 32,
    min_payment: 180,
    currency: 'GTQ',
    statement_date: null,
    due_date: 12,
    next_payment_date: new Date().toISOString(),
    installment_count: null,
    installments_left: null,
    fixed_payment: null,
    status: 'ACTIVE',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'debt-2',
    user_id: 'contract-user',
    type: 'LOAN',
    creditor: 'Prestamo Auto',
    balance: 12500,
    apr: 14,
    min_payment: 350,
    currency: 'GTQ',
    statement_date: null,
    due_date: 20,
    next_payment_date: new Date().toISOString(),
    installment_count: null,
    installments_left: null,
    fixed_payment: null,
    status: 'ACTIVE',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'debt-3',
    user_id: 'contract-user',
    type: 'INSTALLMENT',
    creditor: 'Electrodomesticos',
    balance: 1800,
    apr: 9,
    min_payment: 120,
    currency: 'GTQ',
    statement_date: null,
    due_date: 5,
    next_payment_date: new Date().toISOString(),
    installment_count: null,
    installments_left: null,
    fixed_payment: null,
    status: 'ACTIVE',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const strategies: PayoffStrategy[] = ['AVALANCHE', 'SNOWBALL', 'HYBRID'];

describe('payoff engine contracts', () => {
  it.each(strategies)('returns a finite, payoff-complete timeline for %s', (strategy) => {
    const monthlyBudget = 1100;
    const plan = calculatePayoffPlan({
      debts: contractDebts,
      monthlyBudget,
      currency: 'GTQ',
      strategy,
    });

    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.summary.monthsToPayoff).toBe(plan.timeline.length);
    expect(plan.summary.totalPayments).toBeGreaterThanOrEqual(plan.summary.totalDebt);

    for (const step of plan.timeline) {
      const totalStepPayments = step.payments.reduce((sum, payment) => sum + payment.amount, 0);

      expect(totalStepPayments).toBeGreaterThan(0);
      expect(totalStepPayments).toBeLessThanOrEqual(monthlyBudget + 0.01);

      for (const payment of step.payments) {
        expect(Number.isFinite(payment.amount)).toBe(true);
        expect(payment.amount).toBeGreaterThan(0);
      }

      for (const snapshot of step.debtSnapshots) {
        expect(Number.isFinite(snapshot.startBalance)).toBe(true);
        expect(Number.isFinite(snapshot.endBalance)).toBe(true);
        expect(snapshot.endBalance).toBeGreaterThanOrEqual(0);
        expect(snapshot.endBalance).toBeLessThanOrEqual(snapshot.startBalance + snapshot.interest + 0.01);
      }
    }

    const finalStep = plan.timeline.at(-1);
    expect(finalStep).toBeDefined();
    for (const snapshot of finalStep!.debtSnapshots) {
      expect(snapshot.endBalance).toBeLessThanOrEqual(0.01);
    }
  });

  it('keeps recommendation metadata aligned with returned strategies', () => {
    const comparison = comparePlansPersonalized(contractDebts, 1100, 'GTQ', {
      goalType: 'BALANCED',
      motivationLevel: 4,
      riskTolerance: 3,
    });

    const summaryByStrategy = {
      AVALANCHE: comparison.avalanche,
      SNOWBALL: comparison.snowball,
      HYBRID: comparison.hybrid,
    };

    expect(summaryByStrategy[comparison.recommendation]).toBeDefined();
    expect(comparison.recommendationMeta?.confidence).toBeGreaterThanOrEqual(0);
    expect(comparison.recommendationMeta?.confidence).toBeLessThanOrEqual(1);
    expect(comparison.recommendationMeta?.drivers?.length ?? 0).toBeGreaterThan(0);
    expect(comparison.recommendationRange?.monthsToPayoff.min ?? 0).toBeLessThanOrEqual(
      comparison.recommendationRange?.monthsToPayoff.max ?? 0
    );
    expect(comparison.recommendationRange?.totalInterest.min ?? 0).toBeLessThanOrEqual(
      comparison.recommendationRange?.totalInterest.max ?? 0
    );
  });
});
