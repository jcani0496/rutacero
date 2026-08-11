/**
 * Focused tests for preferred-currency change gate in profile actions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    getAppUserMock,
    revalidatePathMock,
    loggerErrorMock,
    evaluateUserWorkingCurrencyChangeMock,
    getUserWorkingCurrencyMock,
    getUserFinancialDataPresenceMock,
    isDrizzleEnabledMock,
    getDbMock,
} = vi.hoisted(() => ({
    getAppUserMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    loggerErrorMock: vi.fn(),
    evaluateUserWorkingCurrencyChangeMock: vi.fn(),
    getUserWorkingCurrencyMock: vi.fn(),
    getUserFinancialDataPresenceMock: vi.fn(),
    isDrizzleEnabledMock: vi.fn(),
    getDbMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: loggerErrorMock,
    },
}));

vi.mock('@/lib/auth/session', () => ({
    getAppUser: getAppUserMock,
}));

vi.mock('@/lib/auth/identity', () => ({
    updateIdentityUser: vi.fn(),
}));

vi.mock('@/lib/data/provider', () => ({
    isDrizzleEnabled: isDrizzleEnabledMock,
}));

vi.mock('@/db/client', () => ({
    getDb: getDbMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

vi.mock('@/lib/currency/working-currency-server', () => ({
    evaluateUserWorkingCurrencyChange: evaluateUserWorkingCurrencyChangeMock,
    getUserWorkingCurrency: getUserWorkingCurrencyMock,
    getUserFinancialDataPresence: getUserFinancialDataPresenceMock,
}));

import {
    getWorkingCurrencyChangeEligibility,
    updateUserProfilePreferences,
} from '@/lib/actions/profile';
import { WORKING_CURRENCY_LOCKED_MESSAGE } from '@/lib/currency/working-currency';

describe('preferred currency change gate', () => {
    beforeEach(() => {
        getAppUserMock.mockReset();
        revalidatePathMock.mockReset();
        loggerErrorMock.mockReset();
        evaluateUserWorkingCurrencyChangeMock.mockReset();
        getUserWorkingCurrencyMock.mockReset();
        getUserFinancialDataPresenceMock.mockReset();
        isDrizzleEnabledMock.mockReset();
        getDbMock.mockReset();

        getAppUserMock.mockResolvedValue({
            id: 'user-1',
            email: 'u@example.com',
            name: null,
        });
        isDrizzleEnabledMock.mockReturnValue(true);
    });

    it('reports canChange=false when financial records exist', async () => {
        getUserWorkingCurrencyMock.mockResolvedValue('GTQ');
        getUserFinancialDataPresenceMock.mockResolvedValue({
            debts: 1,
            payments: 0,
            incomes: 0,
            expenses: 0,
            budgets: 0,
        });

        const result = await getWorkingCurrencyChangeEligibility();
        expect(result.canChange).toBe(false);
        expect(result.currencyBase).toBe('GTQ');
        expect(result.message).toBe(WORKING_CURRENCY_LOCKED_MESSAGE);
    });

    it('reports canChange=true when user has no financial records', async () => {
        getUserWorkingCurrencyMock.mockResolvedValue('USD');
        getUserFinancialDataPresenceMock.mockResolvedValue({
            debts: 0,
            payments: 0,
            incomes: 0,
            expenses: 0,
            budgets: 0,
        });

        const result = await getWorkingCurrencyChangeEligibility();
        expect(result.canChange).toBe(true);
        expect(result.currencyBase).toBe('USD');
        expect(result.message).toBeUndefined();
    });

    it('blocks updateUserProfilePreferences when currency change is locked', async () => {
        evaluateUserWorkingCurrencyChangeMock.mockResolvedValue({
            allowed: false,
            current: 'GTQ',
            next: 'USD',
            reason: WORKING_CURRENCY_LOCKED_MESSAGE,
        });

        const result = await updateUserProfilePreferences({
            currency_base: 'USD',
            goal_type: 'BALANCED',
            motivation_level: 3,
            risk_tolerance: 3,
            safety_buffer_pct: 10,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe(WORKING_CURRENCY_LOCKED_MESSAGE);
        expect(getDbMock).not.toHaveBeenCalled();
    });

    it('allows updateUserProfilePreferences when currency change is allowed', async () => {
        evaluateUserWorkingCurrencyChangeMock.mockResolvedValue({
            allowed: true,
            current: 'GTQ',
            next: 'USD',
        });

        const returning = vi.fn().mockResolvedValue([{ id: 'profile-1' }]);
        const where = vi.fn(() => ({ returning }));
        const set = vi.fn(() => ({ where }));
        const update = vi.fn(() => ({ set }));
        getDbMock.mockReturnValue({ update });

        const result = await updateUserProfilePreferences({
            currency_base: 'USD',
            goal_type: 'BALANCED',
            motivation_level: 3,
            risk_tolerance: 3,
            safety_buffer_pct: 10,
        });

        expect(result.success).toBe(true);
        expect(update).toHaveBeenCalled();
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                currencyBase: 'USD',
            }),
        );
    });
});
