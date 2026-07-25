import { describe, it, expect } from 'vitest';
import { calculatePayoffPlan, comparePlansPersonalized } from '../engine';
import type { Debt } from '@/types';
import type { PayoffInput } from '../types';

// Mock debt data
const mockDebts: Debt[] = [
  {
    id: '1',
    user_id: 'test-user',
    type: 'CREDIT_CARD',
    creditor: 'Tarjeta Visa',
    balance: 5000,
    apr: 24,
    min_payment: 150,
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
  },
  {
    id: '2',
    user_id: 'test-user',
    type: 'LOAN',
    creditor: 'Préstamo Personal',
    balance: 10000,
    apr: 12,
    min_payment: 300,
    currency: 'GTQ',
    statement_date: null,
    due_date: 10,
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
    id: '3',
    user_id: 'test-user',
    type: 'CREDIT_CARD',
    creditor: 'Tarjeta Mastercard',
    balance: 2000,
    apr: 18,
    min_payment: 80,
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
];

describe('Payoff Engine', () => {
  describe('calculatePayoffPlan', () => {
    it('should throw error when no debts provided', () => {
      const input: PayoffInput = {
        debts: [],
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      expect(() => calculatePayoffPlan(input)).toThrow('No debts provided');
    });

    it('should throw error when monthly budget is zero or negative', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 0,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      expect(() => calculatePayoffPlan(input)).toThrow('Monthly budget must be positive');
    });

    it('should throw error when budget is less than minimum payments', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 400, // Total min payments = 530
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      expect(() => calculatePayoffPlan(input)).toThrow(/Budget .* is less than minimum payments/);
    });

    it('should generate valid plan with AVALANCHE strategy', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);

      expect(plan).toBeDefined();
      expect(plan.strategy).toBe('AVALANCHE');
      expect(plan.debts).toHaveLength(3);
      expect(plan.timeline).toBeDefined();
      expect(plan.summary).toBeDefined();
      expect(plan.engineVersion).toBeDefined();
      expect(plan.generatedAt).toBeInstanceOf(Date);
    });

    it('should prioritize highest APR debt first in AVALANCHE strategy', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);

      // Highest APR first: Tarjeta Visa (24%), Tarjeta Mastercard (18%), Préstamo (12%)
      expect(plan.debts[0].creditor).toBe('Tarjeta Visa');
      expect(plan.debts[0].priorityOrder).toBe(1);
    });

    it('should generate valid plan with SNOWBALL strategy', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'SNOWBALL',
      };

      const plan = calculatePayoffPlan(input);

      expect(plan).toBeDefined();
      expect(plan.strategy).toBe('SNOWBALL');
    });

    it('should prioritize lowest balance first in SNOWBALL strategy', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'SNOWBALL',
      };

      const plan = calculatePayoffPlan(input);

      // Lowest balance first: Tarjeta Mastercard (2000), Tarjeta Visa (5000), Préstamo (10000)
      expect(plan.debts[0].creditor).toBe('Tarjeta Mastercard');
      expect(plan.debts[0].priorityOrder).toBe(1);
    });

    it('should generate valid plan with HYBRID strategy', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'HYBRID',
      };

      const plan = calculatePayoffPlan(input);

      expect(plan).toBeDefined();
      expect(plan.strategy).toBe('HYBRID');
      expect(plan.debts).toHaveLength(3);
    });

    it('should generate payment timeline', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);

      expect(plan.timeline).toBeDefined();
      expect(Array.isArray(plan.timeline)).toBe(true);
      expect(plan.timeline.length).toBeGreaterThan(0);

      // Each step should have required fields
      const firstStep = plan.timeline[0];
      expect(firstStep.periodStart).toBeInstanceOf(Date);
      expect(firstStep.periodEnd).toBeInstanceOf(Date);
      expect(Array.isArray(firstStep.payments)).toBe(true);
      expect(Array.isArray(firstStep.debtSnapshots)).toBe(true);
      expect(firstStep.focusDebtId).toBeDefined();
    });

    it('should calculate correct summary totals', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);
      const { summary } = plan;

      expect(summary.totalDebt).toBeGreaterThan(0);
      expect(summary.totalInterest).toBeGreaterThan(0);
      expect(summary.totalPayments).toBeGreaterThan(0);
      expect(summary.monthsToPayoff).toBeGreaterThan(0);
      expect(summary.etaDebtFree).toBeInstanceOf(Date);
    });

    it('should handle single debt correctly', () => {
      const input: PayoffInput = {
        debts: [mockDebts[0]],
        monthlyBudget: 500,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);

      expect(plan.debts).toHaveLength(1);
      expect(plan.debts[0].priorityOrder).toBe(1);
    });

    it('should assign rationale to each debt', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);

      plan.debts.forEach(debt => {
        expect(debt.rationale).toBeDefined();
        expect(debt.rationale.summary).toBeDefined();
        expect(debt.rationale.factors).toBeDefined();
        expect(Array.isArray(debt.rationale.factors)).toBe(true);
        expect(debt.rationale.factors.length).toBeGreaterThan(0);
      });
    });

    it('should allocate extra budget to priority debt', () => {
      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: 1000, // 470 extra after min payments
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);
      const firstMonth = plan.timeline[0];

      // Find the highest priority debt's allocation
      const priorityDebt = plan.debts.find(d => d.priorityOrder === 1);
      const priorityAllocation = firstMonth.payments.find((p) => p.debtId === priorityDebt?.id);

      // Priority debt should get more than minimum
      expect(priorityAllocation?.amount).toBeGreaterThan(Number(priorityDebt?.min_payment || 0));
    });
  });

  describe('Edge Cases', () => {
    it('should handle debts with 0% APR', () => {
      const zeroAprDebt: Debt = {
        ...mockDebts[0],
        id: 'zero-apr',
        apr: 0,
      };

      const input: PayoffInput = {
        debts: [zeroAprDebt, mockDebts[1]],
        monthlyBudget: 800,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      expect(() => calculatePayoffPlan(input)).not.toThrow();
    });

    it('should handle large balances', () => {
      const largeDebt: Debt = {
        ...mockDebts[0],
        id: 'large',
        balance: 1000000,
        min_payment: 5000,
        apr: 12,
      };

      const input: PayoffInput = {
        debts: [largeDebt],
        monthlyBudget: 30000,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);
      expect(plan.summary.monthsToPayoff).toBeGreaterThan(0);
    });

    it('should handle budget exactly equal to minimum payments', () => {
      const totalMin = mockDebts.reduce((sum, d) => sum + d.min_payment, 0);

      const input: PayoffInput = {
        debts: mockDebts,
        monthlyBudget: totalMin,
        currency: 'GTQ',
        strategy: 'AVALANCHE',
      };

      const plan = calculatePayoffPlan(input);
      expect(plan).toBeDefined();
    });
  });

  describe('comparePlansPersonalized', () => {
    it('should return recommendation metadata and a best-effort range', () => {
      const comparison = comparePlansPersonalized(mockDebts, 1000, 'GTQ', {
        goalType: 'BALANCED',
        motivationLevel: 3,
        riskTolerance: 3,
      });

      expect(comparison.recommendation).toBeDefined();
      expect(comparison.recommendationReason).toBeDefined();
      expect(comparison.recommendationMeta?.goalType).toBe('BALANCED');
      expect(typeof comparison.recommendationMeta?.confidence).toBe('number');
      expect(Array.isArray(comparison.recommendationMeta?.drivers)).toBe(true);
    });

    it('maps FASTEST → SNOWBALL (onboarding goal)', () => {
      const comparison = comparePlansPersonalized(mockDebts, 1000, 'GTQ', { goalType: 'FASTEST' });
      expect(comparison.recommendation).toBe('SNOWBALL');
      expect(comparison.recommendationReason).toMatch(/Según lo que elegiste/i);
    });

    it('maps LEAST_INTEREST → AVALANCHE (onboarding goal)', () => {
      const comparison = comparePlansPersonalized(mockDebts, 1000, 'GTQ', { goalType: 'LEAST_INTEREST' });
      expect(comparison.recommendation).toBe('AVALANCHE');
      expect(comparison.recommendationReason).toMatch(/Según lo que elegiste/i);
    });

    it('maps BALANCED → HYBRID (onboarding goal)', () => {
      const comparison = comparePlansPersonalized(mockDebts, 1000, 'GTQ', { goalType: 'BALANCED' });
      expect(comparison.recommendation).toBe('HYBRID');
      expect(comparison.recommendationReason).toMatch(/Según lo que elegiste/i);
    });
  });
});
