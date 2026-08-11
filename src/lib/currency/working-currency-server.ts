import { count, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import {
    debts,
    essentialExpenses,
    incomeEvents,
    payments,
    userProfiles,
    variableBudgetTargets,
} from '@/db/schema';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { createClient } from '@/lib/supabase/server';
import type { Currency } from '@/types';
import {
    evaluateWorkingCurrencyChange,
    normalizeWorkingCurrency,
    resolveWorkingCurrencyForWrite,
    type FinancialDataPresence,
} from '@/lib/currency/working-currency';

async function countExact(
    table: 'debts' | 'payments' | 'income_events' | 'essential_expenses' | 'variable_budget_targets',
    userId: string,
): Promise<number> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const schemaTable =
            table === 'debts'
                ? debts
                : table === 'payments'
                  ? payments
                  : table === 'income_events'
                    ? incomeEvents
                    : table === 'essential_expenses'
                      ? essentialExpenses
                      : variableBudgetTargets;

        const [row] = await db
            .select({ value: count() })
            .from(schemaTable)
            .where(eq(schemaTable.userId, userId));
        return row?.value ?? 0;
    }

    const supabase = await createClient();
    const { count: supabaseCount } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    return supabaseCount || 0;
}

export async function getUserWorkingCurrency(userId: string): Promise<Currency> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const [row] = await db
            .select({ currencyBase: userProfiles.currencyBase })
            .from(userProfiles)
            .where(eq(userProfiles.userId, userId))
            .limit(1);
        return normalizeWorkingCurrency(row?.currencyBase);
    }

    const supabase = await createClient();
    const { data } = await supabase
        .from('user_profiles')
        .select('currency_base')
        .eq('user_id', userId)
        .maybeSingle();
    return normalizeWorkingCurrency(
        (data as { currency_base?: string } | null)?.currency_base,
    );
}

export async function getUserFinancialDataPresence(
    userId: string,
): Promise<FinancialDataPresence> {
    const [debtsCount, paymentsCount, incomesCount, expensesCount, budgetsCount] =
        await Promise.all([
            countExact('debts', userId),
            countExact('payments', userId),
            countExact('income_events', userId),
            countExact('essential_expenses', userId),
            countExact('variable_budget_targets', userId),
        ]);

    return {
        debts: debtsCount,
        payments: paymentsCount,
        incomes: incomesCount,
        expenses: expensesCount,
        budgets: budgetsCount,
    };
}

export async function evaluateUserWorkingCurrencyChange(
    userId: string,
    nextCurrency: string | null | undefined,
    audience: 'user' | 'admin' = 'user',
): Promise<{ allowed: boolean; current: Currency; next: Currency; reason?: string }> {
    const current = await getUserWorkingCurrency(userId);
    const presence = await getUserFinancialDataPresence(userId);
    const result = evaluateWorkingCurrencyChange({
        current,
        next: nextCurrency,
        presence,
        audience,
    });
    return {
        allowed: result.allowed,
        current,
        next: result.next,
        reason: result.reason,
    };
}

/**
 * Convenience for write paths: always return currency_base for this user.
 * Client currency input is intentionally ignored.
 */
export async function resolveUserWorkingCurrencyForWrite(
    userId: string,
    clientCurrency?: string | null,
): Promise<Currency> {
    const base = await getUserWorkingCurrency(userId);
    return resolveWorkingCurrencyForWrite(base, clientCurrency);
}
