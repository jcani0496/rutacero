'use server';

import { revalidatePath } from 'next/cache';
import { requireUserTenant } from '@/lib/tenant/server';
import type { IncomeEvent, EssentialExpense, Currency, VariableBudgetTarget } from '@/types';
import {
    createIncomeSchema,
    createEssentialExpenseSchema,
    createBudgetTargetSchema,
    updateBudgetTargetSchema,
} from '@/lib/validations/api';
import { invalidateMovimientosCache } from '@/lib/movimientos';

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

// Fetch all incomes for the current user
export async function getIncomes(month?: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

    // PERF-011: Select specific fields instead of *
    let query = supabase
        .from('income_events')
        .select('id, user_id, date, amount, currency, type, source, notes, created_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    // Filter by month if provided (format: YYYY-MM)
    if (month) {
        const startDate = `${month}-01`;
        const [year, monthNum] = month.split('-').map(Number);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${month}-${lastDay}`;
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

    // Validate input with Zod (VUL-006 remediation)
    // Note: Using inline validation as income_events schema differs from recurring income schema
    const validated = createIncomeSchema.parse({
        name: input.source || 'Salario',
        amount: input.amount,
        frequency: 'ONCE' as const,
        currency: input.currency ?? 'GTQ',
        next_date: new Date(input.date).toISOString(),
        is_variable: input.type === 'VARIABLE',
        notes: input.notes,
    });

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

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Income;
}

// Update an existing income
export async function updateIncome(input: UpdateIncomeInput) {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { id, ...updates } = input;

    const { data, error } = await supabase
        .from('income_events')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating income:', error);
        throw new Error('Error al actualizar el ingreso');
    }

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Income;
}

// Delete an income
export async function deleteIncome(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

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

    await invalidateMovimientosCache(user.id);

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

    const validated = createBudgetTargetSchema.parse({
        category: input.category,
        amount: input.amount,
        period: input.period,
        currency: input.currency ?? 'GTQ',
        actual_amount: input.actual_amount,
    });

    const amount = validated.amount ?? validated.monthly_target;
    const actualAmount = validated.actual_amount ?? 0;

    if (!amount) {
        throw new Error('Monto invalido');
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

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as BudgetTarget;
}

export async function updateBudgetTarget(input: UpdateBudgetTargetInput) {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { id, ...updates } = input;
    const validated = updateBudgetTargetSchema.parse({
        ...updates,
        currency: updates.currency ?? undefined,
    });

    const amount = validated.amount ?? validated.monthly_target;
    const updatePayload: Partial<VariableBudgetTarget> = {};

    if (validated.category !== undefined) {
        updatePayload.category = validated.category;
    }

    if (validated.currency !== undefined) {
        updatePayload.currency = validated.currency;
    }

    if (validated.period !== undefined) {
        updatePayload.period = validated.period;
    }

    if (amount !== undefined) {
        updatePayload.amount = amount;
    }

    if (validated.actual_amount !== undefined) {
        updatePayload.actual_amount = validated.actual_amount;
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

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as BudgetTarget;
}

export async function deleteBudgetTarget(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

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

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return { success: true };
}


// Fetch all expenses for the current user
export async function getExpenses() {
    const { supabase, user, tenantId } = await requireUserTenant();

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

    // Validate input with Zod (VUL-006 remediation)
    const validated = createEssentialExpenseSchema.parse({
        name: input.name,
        amount: input.amount,
        frequency: input.frequency,
        currency: input.currency ?? 'GTQ',
        due_day: undefined, // Not in current input
        category: input.category,
        is_variable: input.expense_type === 'WANT',
        notes: undefined,
    });

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

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Expense;
}

// Update an existing expense
export async function updateExpense(input: UpdateExpenseInput) {
    const { supabase, user, tenantId } = await requireUserTenant();

    const { id, ...updates } = input;

    const { data, error } = await supabase
        .from('essential_expenses')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating expense:', error);
        throw new Error('Error al actualizar el gasto');
    }

    await invalidateMovimientosCache(user.id);

    revalidatePath('/finances');
    revalidatePath('/dashboard');
    revalidatePath('/finances/movimientos');

    return data as Expense;
}

// Delete an expense
export async function deleteExpense(id: string) {
    const { supabase, user, tenantId } = await requireUserTenant();

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

    await invalidateMovimientosCache(user.id);

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

export async function getBudgetOverview(): Promise<BudgetOverview | null> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return null;
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

    const items: BudgetUsageItem[] = (data || []).map((budget) => {
        const target = Number(budget.amount);
        const actual = Number(budget.actual_amount || 0);
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

    // Get incomes
    let incomeQuery = supabase
        .from('income_events')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (month) {
        const startDate = `${month}-01`;
        const [year, monthNum] = month.split('-').map(Number);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${month}-${lastDay}`;
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
