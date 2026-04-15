import { describe, it, expect } from 'vitest';
import { generateCashFlowForecast } from '../forecast';
import type { Debt } from '@/types';
import type { ForecastInput } from '../forecast';

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
];

const mockIncomes = [
  { amount: 8000, source: 'Salario', type: 'FIXED' as const },
  { amount: 1000, source: 'Freelance', type: 'VARIABLE' as const },
];

const mockExpenses = [
  { amount: 2000, name: 'Alquiler', category: 'Vivienda', expense_type: 'NEED' as const },
  { amount: 500, name: 'Comida', category: 'Alimentación', expense_type: 'NEED' as const },
  { amount: 300, name: 'Entretenimiento', category: 'Ocio', expense_type: 'WANT' as const },
];

describe('Cash Flow Forecast Engine', () => {
  describe('generateCashFlowForecast', () => {
    it('should generate forecast for 12 months by default', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      expect(forecast).toBeDefined();
      expect(forecast.periods).toHaveLength(12);
      expect(forecast.currency).toBe('GTQ');
    });

    it('should generate forecast for custom horizon', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input, 6);

      expect(forecast.periods).toHaveLength(6);
    });

    it('should calculate correct total income per period', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      // Total income should be sum of all income sources
      const expectedIncome = mockIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      expect(firstPeriod.totalIncome).toBe(expectedIncome);
    });

    it('should calculate correct total expenses per period', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      // Total expenses should be sum of all expenses
      const expectedExpenses = mockExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      expect(firstPeriod.totalExpenses).toBe(expectedExpenses);
    });

    it('should include debt payments in projections', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      expect(firstPeriod.debtPayments).toBeDefined();
      expect(firstPeriod.debtPayments.length).toBeGreaterThan(0);
      expect(firstPeriod.totalDebtPayments).toBeGreaterThan(0);

      // Should include both debts
      expect(firstPeriod.debtPayments).toHaveLength(mockDebts.length);
    });

    it('should calculate net cash flow correctly', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      const expectedNet =
        firstPeriod.totalIncome -
        firstPeriod.totalExpenses -
        firstPeriod.totalDebtPayments;

      expect(firstPeriod.netCashFlow).toBe(expectedNet);
    });

    it('should track cumulative debt paid', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      // Cumulative should increase each month
      for (let i = 1; i < forecast.periods.length; i++) {
        expect(forecast.periods[i].cumulativeDebtPaid).toBeGreaterThanOrEqual(
          forecast.periods[i - 1].cumulativeDebtPaid
        );
      }
    });

    it('should track remaining debt', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const totalDebt = mockDebts.reduce((sum, d) => sum + Number(d.balance), 0);

      // Remaining debt should decrease (or stay same if only paying minimums)
      for (let i = 1; i < forecast.periods.length; i++) {
        expect(forecast.periods[i].remainingDebt).toBeLessThanOrEqual(
          forecast.periods[i - 1].remainingDebt
        );
      }

      // First period remaining debt should be close to total debt
      expect(forecast.periods[0].remainingDebt).toBeLessThanOrEqual(totalDebt);
    });

    it('should generate forecast summary', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      expect(forecast.summary).toBeDefined();
      expect(forecast.summary.totalIncome12m).toBeGreaterThan(0);
      expect(forecast.summary.totalExpenses12m).toBeGreaterThan(0);
      expect(forecast.summary.totalDebtPayments12m).toBeGreaterThan(0);
      expect(forecast.summary.avgMonthlyNet).toBeDefined();
    });

    it('should identify worst and best months', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      if (forecast.periods.length > 1) {
        expect(forecast.summary.worstMonth).toBeDefined();
        expect(forecast.summary.bestMonth).toBeDefined();
      }
    });

    it('should detect cash flow gaps', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: [{ amount: 2000, source: 'Salario bajo', type: 'FIXED' }],
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      expect(forecast.gaps).toBeDefined();
      expect(Array.isArray(forecast.gaps)).toBe(true);

      // With low income, should detect gaps
      expect(forecast.gaps.length).toBeGreaterThan(0);

      if (forecast.gaps.length > 0) {
        const gap = forecast.gaps[0];
        expect(gap.period).toBeDefined();
        expect(gap.shortfall).toBeGreaterThan(0);
        expect(gap.severity).toMatch(/WARNING|CRITICAL/);
        expect(gap.suggestion).toBeDefined();
      }
    });

    it('should not detect gaps with healthy cash flow', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: [{ amount: 15000, source: 'Buen salario', type: 'FIXED' }],
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      expect(forecast.gaps.length).toBe(0);
    });

    it('should include period metadata', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      expect(firstPeriod.period).toBeDefined();
      expect(firstPeriod.period.periodStart).toBeInstanceOf(Date);
      expect(firstPeriod.period.periodEnd).toBeInstanceOf(Date);
      expect(firstPeriod.period.month).toBeGreaterThan(0);
      expect(firstPeriod.period.month).toBeLessThanOrEqual(12);
      expect(firstPeriod.period.year).toBeGreaterThan(2020);
      expect(firstPeriod.period.label).toBeDefined();
    });

    it('should handle extra payment budget', () => {
      const inputWithExtra: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
        extraPaymentBudget: 500,
      };

      const inputWithoutExtra: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecastWithExtra = generateCashFlowForecast(inputWithExtra);
      const forecastWithoutExtra = generateCashFlowForecast(inputWithoutExtra);

      // With extra payments, cumulative debt paid should be higher
      const lastMonthWith = forecastWithExtra.periods[forecastWithExtra.periods.length - 1];
      const lastMonthWithout = forecastWithoutExtra.periods[forecastWithoutExtra.periods.length - 1];

      expect(lastMonthWith.cumulativeDebtPaid).toBeGreaterThan(
        lastMonthWithout.cumulativeDebtPaid
      );
    });

    it('should handle empty debts array', () => {
      const input: ForecastInput = {
        debts: [],
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);

      expect(forecast.periods).toHaveLength(12);
      expect(forecast.periods[0].totalDebtPayments).toBe(0);
      expect(forecast.periods[0].debtPayments).toHaveLength(0);
    });

    it('should handle USD currency', () => {
      const input: ForecastInput = {
        debts: mockDebts.map(d => ({ ...d, currency: 'USD' as const })),
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'USD',
      };

      const forecast = generateCashFlowForecast(input);

      expect(forecast.currency).toBe('USD');
    });

    it('should calculate average monthly net correctly', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input, 12);

      const totalNet = forecast.periods.reduce((sum, p) => sum + p.netCashFlow, 0);
      const expectedAvg = totalNet / 12;

      expect(forecast.summary.avgMonthlyNet).toBeCloseTo(expectedAvg, 2);
    });

    it('should provide income breakdown per period', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      expect(firstPeriod.incomes).toBeDefined();
      expect(firstPeriod.incomes).toHaveLength(mockIncomes.length);

      firstPeriod.incomes.forEach(income => {
        expect(income.amount).toBeGreaterThan(0);
        expect(income.source).toBeDefined();
        expect(income.type).toMatch(/FIXED|VARIABLE/);
      });
    });

    it('should provide expense breakdown per period', () => {
      const input: ForecastInput = {
        debts: mockDebts,
        incomes: mockIncomes,
        expenses: mockExpenses,
        currency: 'GTQ',
      };

      const forecast = generateCashFlowForecast(input);
      const firstPeriod = forecast.periods[0];

      expect(firstPeriod.expenses).toBeDefined();
      expect(firstPeriod.expenses).toHaveLength(mockExpenses.length);

      firstPeriod.expenses.forEach(expense => {
        expect(expense.amount).toBeGreaterThan(0);
        expect(expense.name).toBeDefined();
        expect(expense.category).toBeDefined();
        expect(expense.type).toMatch(/NEED|WANT/);
      });
    });
  });
});
