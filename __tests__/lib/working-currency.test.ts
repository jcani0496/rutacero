import { describe, it, expect } from 'vitest';
import {
    WORKING_CURRENCY_ADMIN_LOCKED_MESSAGE,
    WORKING_CURRENCY_LOCKED_MESSAGE,
    evaluateWorkingCurrencyChange,
    hasFinancialRecords,
    normalizeWorkingCurrency,
    resolveWorkingCurrencyForWrite,
    type FinancialDataPresence,
} from '@/lib/currency/working-currency';

const emptyPresence = (): FinancialDataPresence => ({
    debts: 0,
    payments: 0,
    incomes: 0,
    expenses: 0,
    budgets: 0,
});

describe('working currency policy', () => {
    it('normalizes unknown values to GTQ', () => {
        expect(normalizeWorkingCurrency(undefined)).toBe('GTQ');
        expect(normalizeWorkingCurrency(null)).toBe('GTQ');
        expect(normalizeWorkingCurrency('EUR')).toBe('GTQ');
        expect(normalizeWorkingCurrency('USD')).toBe('USD');
        expect(normalizeWorkingCurrency('GTQ')).toBe('GTQ');
    });

    it('ignores client currency on write and uses currency_base', () => {
        expect(resolveWorkingCurrencyForWrite('GTQ', 'USD')).toBe('GTQ');
        expect(resolveWorkingCurrencyForWrite('USD', 'GTQ')).toBe('USD');
        expect(resolveWorkingCurrencyForWrite(undefined, 'USD')).toBe('GTQ');
    });

    it('detects financial records presence', () => {
        expect(hasFinancialRecords(emptyPresence())).toBe(false);
        expect(hasFinancialRecords({ ...emptyPresence(), debts: 1 })).toBe(true);
        expect(hasFinancialRecords({ ...emptyPresence(), payments: 2 })).toBe(true);
        expect(hasFinancialRecords({ ...emptyPresence(), incomes: 1 })).toBe(true);
        expect(hasFinancialRecords({ ...emptyPresence(), expenses: 1 })).toBe(true);
        expect(hasFinancialRecords({ ...emptyPresence(), budgets: 1 })).toBe(true);
    });

    it('allows currency change when there is no financial data', () => {
        const result = evaluateWorkingCurrencyChange({
            current: 'GTQ',
            next: 'USD',
            presence: emptyPresence(),
        });
        expect(result.allowed).toBe(true);
        expect(result.next).toBe('USD');
        expect(result.reason).toBeUndefined();
    });

    it('allows no-op currency update even when financial data exists', () => {
        const result = evaluateWorkingCurrencyChange({
            current: 'GTQ',
            next: 'GTQ',
            presence: { ...emptyPresence(), debts: 3 },
        });
        expect(result.allowed).toBe(true);
        expect(result.next).toBe('GTQ');
    });

    it('blocks currency change when any financial data exists (user message)', () => {
        const result = evaluateWorkingCurrencyChange({
            current: 'GTQ',
            next: 'USD',
            presence: { ...emptyPresence(), payments: 1 },
            audience: 'user',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe(WORKING_CURRENCY_LOCKED_MESSAGE);
    });

    it('blocks currency change for admin with admin message', () => {
        const result = evaluateWorkingCurrencyChange({
            current: 'USD',
            next: 'GTQ',
            presence: { ...emptyPresence(), budgets: 1 },
            audience: 'admin',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe(WORKING_CURRENCY_ADMIN_LOCKED_MESSAGE);
    });
});
