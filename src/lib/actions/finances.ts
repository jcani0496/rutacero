'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { requireUserTenant } from '@/lib/tenant/server';
import type { IncomeEvent, EssentialExpense, Currency, VariableBudgetTarget } from '@/types';
import {
    createIncomeSchema,
    createEssentialExpenseSchema,
    createBudgetTargetSchema,
    updateBudgetTargetSchema,
} from '@/lib/validations/api';
import { invalidateMovimientosCache } from '@/lib/movimientos/server';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    mapEssentialExpenseRow,
    mapIncomeEventRow,
    mapVariableBudgetTargetRow,
} from '@/lib/data/mappers';
import { getDb } from '@/db/client';
import {
    essentialExpenses,
    incomeEvents,
    variableBudgetTargets,
} from '@/db/schema';
import { resolveUserWorkingCurrencyForWrite } from '@/lib/currency/working-currency-server';

// ============================================
// INCOME TYPES & ACTIONS
// ============================================

export interface CreateIncomeInput {
    amount: number;
    date: string;
    type: 'FIXED' | 'VARIABLE';
    source?: string;
    currency?: Currency;
    notes?: string;
}

export interface UpdateIncomeInput extends Partial<CreateIncomeInput> {
    id: string;
}

// Extended income type with source
export interface Income extends IncomeEvent {
    source?: string;
}

function monthDateRange(month: string): { startDate: string; endDate: string } {
    const startDate = `${month}-01`;
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
}

// Fetch all incomes for the current user
export async function getIncomes(month?: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const conditions = [
            eq(incomeEvents.tenantId, tenantId),
            eq(incomeEvents.userId, user.id),
        ];
        if (month) {
            const { startDate, endDate } = monthDateRange(month);
            conditions.push(gte(incomeEvents.date, startDate));
            conditions.push(lte(incomeEvents.date, endDate));
        }
        const rows = await db
            .select()
            .from(incomeEvents)
            .where(and(...conditions))
            .orderBy(desc(incomeEvents.date));
        return rows.map(mapIncomeEventRow) as Income[];
    }

    // PERF-011: Select specific fields instead of *
    let query = supabase
        .from('income_events')
        .select('id, user_id, date, amount, currency, type, source, notes, created_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    // Filter by month if provided (format: YYYY-MM)
    if (month) {
        const { startDate, endDate } = monthDateRange(month);
        query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching incomes:', error);
        throw new Error('Error al cargar los ingresos');
    }

    return data as Income[];
}

// Create a new income
export async function createIncome(input: CreateIncomeInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    // Validate input with Zod (VUL-006 remediation)
    // Note: Using inline validation as income_events schema differs from recurring income schema
    const validated = createIncomeSchema.parse({
        name: input.source || 'Salario',
        amount: input.amount,
        frequency: 'ONCE' as const,
        currency: workingCurrency,
        next_date: new Date(input.date).toISOString(),
        is_variable: input.type === 'VARIABLE',
        notes: input.notes,
    });

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const [row] = await db
                .insert(incomeEvents)
                .values({
                    tenantId,
                    userId: user.id,
                    amount: String(validated.amount),
                    date: input.date,
                    type: input.type,
                    source: validated.name,
                    currency: validated.currency,
                    notes: validated.notes ?? null,
                })
                .returning();

            if (!row) {
                throw new Error('Error al crear el ingreso');
            }

            await invalidateMovimientosCache(tenantId, user.id);
            revalidatePath('/finances');
            revalidatePath('/dashboard');
            revalidatePath('/finances/movimientos');
            return mapIncomeEventRow(row) as Income;
        } catch (error) {
            console.error('Error creating income:', error);
            throw new Error('Error al crear el ingreso');
        }
    }

    const { data, error } = await supabase
        .from('income_events')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            amount: validated.amount,
            date: input.date,
            type: input.type,
            source: validated.name,
            currency: validated.currency,
            notes: validated.notes,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating income:', error);
        throw new Error('Error al crear el ingreso');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Income;
}

// Update an existing income
export async function updateIncome(input: UpdateIncomeInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    const { id, ...updates } = input;

    if (isDrizzleEnabled()) {
        const db = getDb();
        const drizzleUpdates: Record<string, unknown> = {};
        if (updates.amount !== undefined) drizzleUpdates.amount = String(updates.amount);
        if (updates.date !== undefined) drizzleUpdates.date = updates.date;
        if (updates.type !== undefined) drizzleUpdates.type = updates.type;
        if (updates.source !== undefined) drizzleUpdates.source = updates.source;
        if (updates.currency !== undefined) drizzleUpdates.currency = workingCurrency;
        if (updates.notes !== undefined) drizzleUpdates.notes = updates.notes;

        try {
            const [row] = await db
                .update(incomeEvents)
                .set(drizzleUpdates)
                .where(
                    and(
                        eq(incomeEvents.id, id),
                        eq(incomeEvents.tenantId, tenantId),
                        eq(incomeEvents.userId, user.id),
                    ),
                )
                .returning();

            if (!row) {
                throw new Error('Error al actualizar el ingreso');
            }

            await invalidateMovimientosCache(tenantId, user.id);
            revalidatePath('/finances');
            revalidatePath('/dashboard');
            revalidatePath('/finances/movimientos');
            return mapIncomeEventRow(row) as Income;
        } catch (error) {
            console.error('Error updating income:', error);
            throw new Error('Error al actualizar el ingreso');
        }
    }

    const { data, error } = await supabase
        .from('income_events')
        .update({
            ...updates,
            ...(updates.currency !== undefined ? { currency: workingCurrency } : {}),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating income:', error);
        throw new Error('Error al actualizar el ingreso');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Income;
}

// Delete an income
export async function deleteIncome(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const deleted = await db
            .delete(incomeEvents)
            .where(
                and(
                    eq(incomeEvents.id, id),
                    eq(incomeEvents.tenantId, tenantId),
                    eq(incomeEvents.userId, user.id),
                ),
            )
            .returning({ id: incomeEvents.id });

        if (deleted.length === 0) {
            console.error('Error deleting income: not found or not owned');
            throw new Error('Error al eliminar el ingreso');
        }

        await invalidateMovimientosCache(tenantId, user.id);
        revalidatePath('/finances');
        revalidatePath('/dashboard');
        revalidatePath('/finances/movimientos');
        return { success: true };
    }

    const { error } = await supabase
        .from('income_events')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting income:', error);
        throw new Error('Error al eliminar el ingreso');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return { success: true };
}

// ============================================
// EXPENSE TYPES & ACTIONS
// ============================================

export interface CreateExpenseInput {
    name: string;
    amount: number;
    budget_amount?: number;
    actual_amount?: number;
    frequency: 'MONTHLY' | 'BIWEEKLY';
    expense_type: 'NEED' | 'WANT';
    category: string;
    next_date: string;
    currency?: Currency;
}

export interface UpdateExpenseInput extends Partial<CreateExpenseInput> {
    id: string;
}

// Extended expense type with categorization
export interface Expense extends EssentialExpense {
    expense_type?: 'NEED' | 'WANT';
    category?: string;
    budget_amount?: number;
    actual_amount?: number;
}

// ============================================
// BUDGET TARGETS TYPES & ACTIONS
// ============================================

export interface CreateBudgetTargetInput {
    category: string;
    amount: number;
    period: 'MONTHLY' | 'BIWEEKLY';
    currency?: Currency;
    actual_amount?: number;
}

export interface UpdateBudgetTargetInput extends Partial<CreateBudgetTargetInput> {
    id: string;
}

export type BudgetTarget = VariableBudgetTarget;

export async function getBudgetTargets() {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select()
            .from(variableBudgetTargets)
            .where(
                and(
                    eq(variableBudgetTargets.tenantId, tenantId),
                    eq(variableBudgetTargets.userId, user.id),
                ),
            )
            .orderBy(asc(variableBudgetTargets.category));
        return rows.map(mapVariableBudgetTargetRow) as BudgetTarget[];
    }

    const { data, error } = await supabase
        .from('variable_budget_targets')
        .select('id, user_id, category, amount, actual_amount, period, currency, created_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching budget targets:', error);
        throw new Error('Error al cargar los presupuestos');
    }

    return data as BudgetTarget[];
}

export async function createBudgetTarget(input: CreateBudgetTargetInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    const validated = createBudgetTargetSchema.parse({
        category: input.category,
        amount: input.amount,
        period: input.period,
        currency: workingCurrency,
        actual_amount: input.actual_amount,
    });

    const amount = validated.amount ?? validated.monthly_target;
    const actualAmount = validated.actual_amount ?? 0;

    if (!amount) {
        throw new Error('Monto invalido');
    }

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const [row] = await db
                .insert(variableBudgetTargets)
                .values({
                    tenantId,
                    userId: user.id,
                    category: validated.category,
                    amount: String(amount),
                    actualAmount: String(actualAmount),
                    period: validated.period,
                    currency: validated.currency,
                })
                .returning();

            if (!row) {
                throw new Error('Error al crear el presupuesto');
            }

            await invalidateMovimientosCache(tenantId, user.id);
            revalidatePath('/finances');
            revalidatePath('/dashboard');
            revalidatePath('/finances/movimientos');
            return mapVariableBudgetTargetRow(row) as BudgetTarget;
        } catch (error) {
            console.error('Error creating budget target:', error);
            throw new Error('Error al crear el presupuesto');
        }
    }

    const { data, error } = await supabase
        .from('variable_budget_targets')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            category: validated.category,
            amount,
            actual_amount: actualAmount,
            period: validated.period,
            currency: validated.currency,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating budget target:', error);
        throw new Error('Error al crear el presupuesto');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as BudgetTarget;
}

export async function updateBudgetTarget(input: UpdateBudgetTargetInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    const { id, ...updates } = input;
    const validated = updateBudgetTargetSchema.parse({
        ...updates,
        currency: updates.currency !== undefined ? workingCurrency : undefined,
    });

    const amount = validated.amount ?? validated.monthly_target;
    const updatePayload: Partial<VariableBudgetTarget> = {};
    const drizzleUpdates: Record<string, unknown> = {};

    if (validated.category !== undefined) {
        updatePayload.category = validated.category;
        drizzleUpdates.category = validated.category;
    }

    if (validated.currency !== undefined) {
        updatePayload.currency = validated.currency;
        drizzleUpdates.currency = validated.currency;
    }

    if (validated.period !== undefined) {
        updatePayload.period = validated.period;
        drizzleUpdates.period = validated.period;
    }

    if (amount !== undefined) {
        updatePayload.amount = amount;
        drizzleUpdates.amount = String(amount);
    }

    if (validated.actual_amount !== undefined) {
        updatePayload.actual_amount = validated.actual_amount;
        drizzleUpdates.actualAmount = String(validated.actual_amount);
    }

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const [row] = await db
                .update(variableBudgetTargets)
                .set(drizzleUpdates)
                .where(
                    and(
                        eq(variableBudgetTargets.id, id),
                        eq(variableBudgetTargets.tenantId, tenantId),
                        eq(variableBudgetTargets.userId, user.id),
                    ),
                )
                .returning();

            if (!row) {
                throw new Error('Error al actualizar el presupuesto');
            }

            await invalidateMovimientosCache(tenantId, user.id);
            revalidatePath('/finances');
            revalidatePath('/dashboard');
            revalidatePath('/finances/movimientos');
            return mapVariableBudgetTargetRow(row) as BudgetTarget;
        } catch (error) {
            console.error('Error updating budget target:', error);
            throw new Error('Error al actualizar el presupuesto');
        }
    }

    const { data, error } = await supabase
        .from('variable_budget_targets')
        .update(updatePayload)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating budget target:', error);
        throw new Error('Error al actualizar el presupuesto');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as BudgetTarget;
}

export async function deleteBudgetTarget(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const deleted = await db
            .delete(variableBudgetTargets)
            .where(
                and(
                    eq(variableBudgetTargets.id, id),
                    eq(variableBudgetTargets.tenantId, tenantId),
                    eq(variableBudgetTargets.userId, user.id),
                ),
            )
            .returning({ id: variableBudgetTargets.id });

        if (deleted.length === 0) {
            console.error('Error deleting budget target: not found or not owned');
            throw new Error('Error al eliminar el presupuesto');
        }

        await invalidateMovimientosCache(tenantId, user.id);
        revalidatePath('/finances');
        revalidatePath('/dashboard');
        revalidatePath('/finances/movimientos');
        return { success: true };
    }

    const { error } = await supabase
        .from('variable_budget_targets')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting budget target:', error);
        throw new Error('Error al eliminar el presupuesto');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return { success: true };
}


// Fetch all expenses for the current user
export async function getExpenses() {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select()
            .from(essentialExpenses)
            .where(
                and(
                    eq(essentialExpenses.tenantId, tenantId),
                    eq(essentialExpenses.userId, user.id),
                ),
            )
            .orderBy(asc(essentialExpenses.expenseType), asc(essentialExpenses.name));
        return rows.map(mapEssentialExpenseRow) as Expense[];
    }

    // PERF-011: Select specific fields instead of *
    const { data, error } = await supabase
        .from('essential_expenses')
        .select('id, user_id, name, amount, frequency, next_date, currency, created_at, expense_type, category, budget_amount, actual_amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('expense_type', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching expenses:', error);
        throw new Error('Error al cargar los gastos');
    }

    return data as Expense[];
}

// Create a new expense
export async function createExpense(input: CreateExpenseInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    // Validate input with Zod (VUL-006 remediation)
    const validated = createEssentialExpenseSchema.parse({
        name: input.name,
        amount: input.amount,
        frequency: input.frequency,
        currency: workingCurrency,
        due_day: undefined, // Not in current input
        category: input.category,
        is_variable: input.expense_type === 'WANT',
        notes: undefined,
    });

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const [row] = await db
                .insert(essentialExpenses)
                .values({
                    tenantId,
                    userId: user.id,
                    name: validated.name,
                    amount: String(validated.amount),
                    budgetAmount: String(input.budget_amount ?? validated.amount),
                    actualAmount: String(input.actual_amount ?? 0),
                    frequency: validated.frequency,
                    expenseType: input.expense_type,
                    category: validated.category,
                    nextDate: input.next_date,
                    currency: validated.currency,
                })
                .returning();

            if (!row) {
                throw new Error('Error al crear el gasto');
            }

            await invalidateMovimientosCache(tenantId, user.id);
            revalidatePath('/finances');
            revalidatePath('/dashboard');
            revalidatePath('/finances/movimientos');
            return mapEssentialExpenseRow(row) as Expense;
        } catch (error) {
            console.error('Error creating expense:', error);
            throw new Error('Error al crear el gasto');
        }
    }

    const { data, error } = await supabase
        .from('essential_expenses')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            name: validated.name,
            amount: validated.amount,
            budget_amount: input.budget_amount ?? validated.amount,
            actual_amount: input.actual_amount ?? 0,
            frequency: validated.frequency,
            expense_type: input.expense_type,
            category: validated.category,
            next_date: input.next_date,
            currency: validated.currency,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating expense:', error);
        throw new Error('Error al crear el gasto');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Expense;
}

// Update an existing expense
export async function updateExpense(input: UpdateExpenseInput) {
    const { supabase, user, tenantId } = await requireUserTenant();
    const workingCurrency = await resolveUserWorkingCurrencyForWrite(
        user.id,
        input.currency,
    );

    const { id, ...updates } = input;

    if (isDrizzleEnabled()) {
        const db = getDb();
        const drizzleUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) drizzleUpdates.name = updates.name;
        if (updates.amount !== undefined) drizzleUpdates.amount = String(updates.amount);
        if (updates.budget_amount !== undefined) {
            drizzleUpdates.budgetAmount = String(updates.budget_amount);
        }
        if (updates.actual_amount !== undefined) {
            drizzleUpdates.actualAmount = String(updates.actual_amount);
        }
        if (updates.frequency !== undefined) drizzleUpdates.frequency = updates.frequency;
        if (updates.expense_type !== undefined) drizzleUpdates.expenseType = updates.expense_type;
        if (updates.category !== undefined) drizzleUpdates.category = updates.category;
        if (updates.next_date !== undefined) drizzleUpdates.nextDate = updates.next_date;
        if (updates.currency !== undefined) drizzleUpdates.currency = workingCurrency;

        try {
            const [row] = await db
                .update(essentialExpenses)
                .set(drizzleUpdates)
                .where(
                    and(
                        eq(essentialExpenses.id, id),
                        eq(essentialExpenses.tenantId, tenantId),
                        eq(essentialExpenses.userId, user.id),
                    ),
                )
                .returning();

            if (!row) {
                throw new Error('Error al actualizar el gasto');
            }

            await invalidateMovimientosCache(tenantId, user.id);
            revalidatePath('/finances');
            revalidatePath('/dashboard');
            revalidatePath('/finances/movimientos');
            return mapEssentialExpenseRow(row) as Expense;
        } catch (error) {
            console.error('Error updating expense:', error);
            throw new Error('Error al actualizar el gasto');
        }
    }

    const { data, error } = await supabase
        .from('essential_expenses')
        .update({
            ...updates,
            ...(updates.currency !== undefined ? { currency: workingCurrency } : {}),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating expense:', error);
        throw new Error('Error al actualizar el gasto');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Expense;
}

// Delete an expense
export async function deleteExpense(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const deleted = await db
            .delete(essentialExpenses)
            .where(
                and(
                    eq(essentialExpenses.id, id),
                    eq(essentialExpenses.tenantId, tenantId),
                    eq(essentialExpenses.userId, user.id),
                ),
            )
            .returning({ id: essentialExpenses.id });

        if (deleted.length === 0) {
            console.error('Error deleting expense: not found or not owned');
            throw new Error('Error al eliminar el gasto');
        }

        await invalidateMovimientosCache(tenantId, user.id);
        revalidatePath('/finances');
        revalidatePath('/dashboard');
        revalidatePath('/finances/movimientos');
        return { success: true };
    }

    const { error } = await supabase
        .from('essential_expenses')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting expense:', error);
        throw new Error('Error al eliminar el gasto');
    }

    await invalidateMovimientosCache(tenantId, user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return { success: true };
}

export interface BudgetUsageItem {
    id: string;
    category: string;
    period: 'MONTHLY' | 'BIWEEKLY';
    currency: Currency;
    target: number;
    actual: number;
    usagePercent: number;
    remaining: number;
    status: 'ON_TRACK' | 'NEAR_LIMIT' | 'OVER';
}

export interface BudgetOverview {
    totalTarget: number;
    totalActual: number;
    remainingTotal: number;
    overBudgetCount: number;
    items: BudgetUsageItem[];
}

const normalizeBudgetPeriod = (value: string | null | undefined): BudgetUsageItem['period'] => {
    return value === 'BIWEEKLY' ? 'BIWEEKLY' : 'MONTHLY';
};

const normalizeCurrency = (value: string | null | undefined): Currency => {
    return value === 'USD' ? 'USD' : 'GTQ';
};

function buildBudgetOverview(
    budgets: Array<{
        id: string;
        category: string;
        amount: string | number;
        actual_amount?: string | number | null;
        actualAmount?: string | number | null;
        period: string | null;
        currency: string | null;
    }>,
): BudgetOverview {
    const items: BudgetUsageItem[] = budgets.map((budget) => {
        const target = Number(budget.amount);
        const actual = Number(budget.actual_amount ?? budget.actualAmount ?? 0);
        const usagePercent = target > 0 ? Math.round((actual / target) * 100) : 0;
        const remaining = target - actual;
        let status: BudgetUsageItem['status'] = 'ON_TRACK';

        if (actual > target) {
            status = 'OVER';
        } else if (usagePercent >= 85) {
            status = 'NEAR_LIMIT';
        }

        return {
            id: budget.id,
            category: budget.category,
            period: normalizeBudgetPeriod(budget.period),
            currency: normalizeCurrency(budget.currency),
            target,
            actual,
            usagePercent,
            remaining,
            status,
        };
    });

    const totalTarget = items.reduce((sum, item) => sum + item.target, 0);
    const totalActual = items.reduce((sum, item) => sum + item.actual, 0);
    const remainingTotal = totalTarget - totalActual;
    const overBudgetCount = items.filter((item) => item.status === 'OVER').length;

    return {
        totalTarget,
        totalActual,
        remainingTotal,
        overBudgetCount,
        items,
    };
}

export async function getBudgetOverview(): Promise<BudgetOverview | null> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return null;
    }

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select({
                id: variableBudgetTargets.id,
                category: variableBudgetTargets.category,
                amount: variableBudgetTargets.amount,
                actualAmount: variableBudgetTargets.actualAmount,
                period: variableBudgetTargets.period,
                currency: variableBudgetTargets.currency,
            })
            .from(variableBudgetTargets)
            .where(
                and(
                    eq(variableBudgetTargets.tenantId, tenantId),
                    eq(variableBudgetTargets.userId, user.id),
                ),
            )
            .orderBy(asc(variableBudgetTargets.category));

        return buildBudgetOverview(rows);
    }

    const { data, error } = await supabase
        .from('variable_budget_targets')
        .select('id, category, amount, actual_amount, period, currency')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching budget overview:', error);
        throw new Error('Error al cargar presupuesto');
    }

    return buildBudgetOverview(data || []);
}

// ============================================
// FINANCE SUMMARY
// ============================================

export interface FinanceSummary {
    totalIncome: number;
    totalBudgeted: number;
    totalSpent: number;
    availableForDebt: number;
    needsTotal: number;
    wantsTotal: number;
    incomeCount: number;
    expenseCount: number;
}

// Get financial summary
export async function getFinanceSummary(month?: string): Promise<FinanceSummary> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const incomeConditions = [
            eq(incomeEvents.tenantId, tenantId),
            eq(incomeEvents.userId, user.id),
        ];
        if (month) {
            const { startDate, endDate } = monthDateRange(month);
            incomeConditions.push(gte(incomeEvents.date, startDate));
            incomeConditions.push(lte(incomeEvents.date, endDate));
        }

        const [incomes, expenses] = await Promise.all([
            db
                .select({ amount: incomeEvents.amount })
                .from(incomeEvents)
                .where(and(...incomeConditions)),
            db
                .select({
                    amount: essentialExpenses.amount,
                    budgetAmount: essentialExpenses.budgetAmount,
                    actualAmount: essentialExpenses.actualAmount,
                    expenseType: essentialExpenses.expenseType,
                })
                .from(essentialExpenses)
                .where(
                    and(
                        eq(essentialExpenses.tenantId, tenantId),
                        eq(essentialExpenses.userId, user.id),
                    ),
                ),
        ]);

        const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
        const totalBudgeted = expenses.reduce(
            (sum, e) => sum + Number(e.budgetAmount || e.amount),
            0,
        );
        const totalSpent = expenses.reduce(
            (sum, e) => sum + Number(e.actualAmount || 0),
            0,
        );
        const needsTotal = expenses
            .filter((e) => e.expenseType === 'NEED')
            .reduce((sum, e) => sum + Number(e.budgetAmount || e.amount), 0);
        const wantsTotal = expenses
            .filter((e) => e.expenseType === 'WANT')
            .reduce((sum, e) => sum + Number(e.budgetAmount || e.amount), 0);

        return {
            totalIncome,
            totalBudgeted,
            totalSpent,
            availableForDebt: totalIncome - totalBudgeted,
            needsTotal,
            wantsTotal,
            incomeCount: incomes.length,
            expenseCount: expenses.length,
        };
    }

    // Get incomes
    let incomeQuery = supabase
        .from('income_events')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (month) {
        const { startDate, endDate } = monthDateRange(month);
        incomeQuery = incomeQuery.gte('date', startDate).lte('date', endDate);
    }

    const { data: incomes, error: incomeError } = await incomeQuery;

    if (incomeError) {
        console.error('Error fetching income summary:', incomeError);
        throw new Error('Error al cargar resumen de ingresos');
    }

    // Get expenses
    const { data: expenses, error: expenseError } = await supabase
        .from('essential_expenses')
        .select('amount, budget_amount, actual_amount, expense_type')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (expenseError) {
        console.error('Error fetching expense summary:', expenseError);
        throw new Error('Error al cargar resumen de gastos');
    }

    const totalIncome = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
    const totalBudgeted = expenses?.reduce((sum, e) => sum + Number(e.budget_amount || e.amount), 0) || 0;
    const totalSpent = expenses?.reduce((sum, e) => sum + Number(e.actual_amount || 0), 0) || 0;
    const needsTotal = expenses?.filter(e => e.expense_type === 'NEED').reduce((sum, e) => sum + Number(e.budget_amount || e.amount), 0) || 0;
    const wantsTotal = expenses?.filter(e => e.expense_type === 'WANT').reduce((sum, e) => sum + Number(e.budget_amount || e.amount), 0) || 0;

    return {
        totalIncome,
        totalBudgeted,
        totalSpent,
        availableForDebt: totalIncome - totalBudgeted,
        needsTotal,
        wantsTotal,
        incomeCount: incomes?.length || 0,
        expenseCount: expenses?.length || 0,
    };
}
