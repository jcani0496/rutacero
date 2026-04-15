import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../risk';
import type { Debt } from '@/types';
import type { DebtHealthInput } from '../risk';

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

describe('Risk Assessment Engine', () => {
  describe('calculateRiskScore', () => {
    it('should calculate risk score for healthy financial situation', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        emergencyFund: 15000,
        paymentHistory: [
          { debtId: '1', onTime: true, date: '2024-01-01' },
          { debtId: '2', onTime: true, date: '2024-01-01' },
          { debtId: '1', onTime: true, date: '2024-02-01' },
          { debtId: '2', onTime: true, date: '2024-02-01' },
        ],
      };

      const result = calculateRiskScore(input);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.level).toBe('HEALTHY');
      expect(result.factors).toHaveLength(5);
      expect(result.recommendations).toBeDefined();
    });

    it('should calculate risk score for at-risk situation', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 5000, // Lower income
        monthlyExpenses: 3500, // High expenses
        emergencyFund: 2000, // Low emergency fund
        paymentHistory: [
          { debtId: '1', onTime: true, date: '2024-01-01' },
          { debtId: '2', onTime: false, date: '2024-01-01' }, // Late payment
          { debtId: '1', onTime: true, date: '2024-02-01' },
          { debtId: '2', onTime: true, date: '2024-02-01' },
        ],
      };

      const result = calculateRiskScore(input);

      expect(result.level).toBe('AT_RISK');
      expect(result.score).toBeLessThan(70);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate risk score for critical situation', () => {
      const input: DebtHealthInput = {
        debts: [
          ...mockDebts,
          {
            ...mockDebts[0],
            id: '3',
            balance: 20000,
            apr: 35,
            min_payment: 600,
          },
        ],
        monthlyIncome: 4000,
        monthlyExpenses: 3000,
        emergencyFund: 0,
        paymentHistory: [
          { debtId: '1', onTime: false, date: '2024-01-01' },
          { debtId: '2', onTime: false, date: '2024-01-01' },
          { debtId: '3', onTime: false, date: '2024-01-01' },
        ],
      };

      const result = calculateRiskScore(input);

      expect(result.level).toBe('CRITICAL');
      expect(result.score).toBeLessThan(40);
    });

    it('should include all 5 risk factors', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const result = calculateRiskScore(input);

      expect(result.factors).toHaveLength(5);

      const factorNames = result.factors.map(f => f.name);
      expect(factorNames).toContain('Ratio Deuda/Ingreso');
      expect(factorNames).toContain('Carga de Pagos');
      expect(factorNames).toContain('Deuda con Alto Interés');
      expect(factorNames).toContain('Fondo de Emergencia');
      expect(factorNames).toContain('Consistencia de Pagos');
    });

    it('should calculate correct DTI ratio', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000, // 120k annual
        monthlyExpenses: 3000,
      };

      const result = calculateRiskScore(input);
      const dtiFactor = result.factors.find(f => f.name === 'Ratio Deuda/Ingreso');

      expect(dtiFactor).toBeDefined();
      expect(dtiFactor?.weight).toBe(30);
      // Total debt = 15000, annual income = 120000, DTI = 12.5%
      expect(dtiFactor?.value).toContain('%');
    });

    it('should penalize high debt-to-income ratio', () => {
      const highDebtInput: DebtHealthInput = {
        debts: [
          ...mockDebts,
          {
            ...mockDebts[0],
            id: '3',
            balance: 100000,
            min_payment: 2000,
            apr: 18,
          },
        ],
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const lowDebtInput: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const highDebtResult = calculateRiskScore(highDebtInput);
      const lowDebtResult = calculateRiskScore(lowDebtInput);

      expect(highDebtResult.score).toBeLessThan(lowDebtResult.score);
    });

    it('should penalize high interest debt', () => {
      const highInterestDebts: Debt[] = [
        {
          ...mockDebts[0],
          apr: 45, // Very high interest
        },
        {
          ...mockDebts[1],
          apr: 38,
        },
      ];

      const highInterestInput: DebtHealthInput = {
        debts: highInterestDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const normalInput: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const highInterestResult = calculateRiskScore(highInterestInput);
      const normalResult = calculateRiskScore(normalInput);

      const highInterestFactor = highInterestResult.factors.find(
        f => f.name === 'Deuda con Alto Interés'
      );
      const normalInterestFactor = normalResult.factors.find(
        f => f.name === 'Deuda con Alto Interés'
      );

      expect(highInterestFactor?.score).toBeLessThan(normalInterestFactor?.score || 100);
    });

    it('should reward emergency fund', () => {
      const withFundInput: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        emergencyFund: 18000, // 6 months of expenses
      };

      const withoutFundInput: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        emergencyFund: 0,
      };

      const withFundResult = calculateRiskScore(withFundInput);
      const withoutFundResult = calculateRiskScore(withoutFundInput);

      expect(withFundResult.score).toBeGreaterThan(withoutFundResult.score);
    });

    it('should reward on-time payments', () => {
      const onTimeInput: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        paymentHistory: [
          { debtId: '1', onTime: true, date: '2024-01-01' },
          { debtId: '2', onTime: true, date: '2024-01-01' },
          { debtId: '1', onTime: true, date: '2024-02-01' },
          { debtId: '2', onTime: true, date: '2024-02-01' },
        ],
      };

      const lateInput: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        paymentHistory: [
          { debtId: '1', onTime: false, date: '2024-01-01' },
          { debtId: '2', onTime: false, date: '2024-01-01' },
          { debtId: '1', onTime: false, date: '2024-02-01' },
          { debtId: '2', onTime: false, date: '2024-02-01' },
        ],
      };

      const onTimeResult = calculateRiskScore(onTimeInput);
      const lateResult = calculateRiskScore(lateInput);

      expect(onTimeResult.score).toBeGreaterThan(lateResult.score);
    });

    it('should generate recommendations based on risk factors', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const result = calculateRiskScore(input);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeLessThanOrEqual(3);

      result.recommendations.forEach(rec => {
        expect(rec.priority).toMatch(/HIGH|MEDIUM|LOW/);
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.action).toBeDefined();
      });
    });

    it('should handle empty payment history gracefully', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        paymentHistory: [],
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const result = calculateRiskScore(input);
      expect(result).toBeDefined();
    });

    it('should handle zero income edge case', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 0,
        monthlyExpenses: 3000,
      };

      const result = calculateRiskScore(input);
      expect(result.level).toBe('CRITICAL');
      expect(result.score).toBeLessThan(40);
    });

    it('should validate factor weights sum correctly', () => {
      const input: DebtHealthInput = {
        debts: mockDebts,
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
      };

      const result = calculateRiskScore(input);
      const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);

      expect(totalWeight).toBe(100);
    });
  });
});
