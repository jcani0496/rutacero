'use server';

import { revalidatePath } from 'next/cache';
import { getActivePlan } from './plans';
import { requireUserTenant } from '@/lib/tenant/server';

interface RecalculationStatus {
    needsRecalculation: boolean;
    reasons: string[];
    lastPlanDate: string | null;
    changedDebtsCount: number;
    changedIncomesCount: number;
}

/**
 * Check if the user's plan needs recalculation
 * Compares the plan creation date with the latest modifications to debts/incomes
 */
export async function checkRecalculationNeeded(): Promise<RecalculationStatus> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return {
            needsRecalculation: false,
            reasons: [],
            lastPlanDate: null,
            changedDebtsCount: 0,
            changedIncomesCount: 0,
        };
    }

    // Get active plan
    const activePlan = await getActivePlan();

    if (!activePlan) {
        return {
            needsRecalculation: false,
            reasons: ['No hay plan activo'],
            lastPlanDate: null,
            changedDebtsCount: 0,
            changedIncomesCount: 0,
        };
    }

    const planCreatedAt = new Date(activePlan.created_at);
    const reasons: string[] = [];
    let changedDebtsCount = 0;
    let changedIncomesCount = 0;

    // Check for debts modified after plan creation
    const { data: modifiedDebts } = await supabase
        .from('debts')
        .select('id, creditor, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gt('updated_at', activePlan.created_at);

    if (modifiedDebts && modifiedDebts.length > 0) {
        changedDebtsCount = modifiedDebts.length;
        reasons.push(`${modifiedDebts.length} deuda(s) modificada(s): ${modifiedDebts.map(d => d.creditor).join(', ')}`);
    }

    // Check for new debts added after plan creation
    const { data: newDebts } = await supabase
        .from('debts')
        .select('id, creditor')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gt('created_at', activePlan.created_at);

    if (newDebts && newDebts.length > 0) {
        changedDebtsCount += newDebts.length;
        reasons.push(`${newDebts.length} deuda(s) nueva(s): ${newDebts.map(d => d.creditor).join(', ')}`);
    }

    // Check for income changes
    const { data: modifiedIncomes } = await supabase
        .from('income_events')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gt('created_at', activePlan.created_at);

    if (modifiedIncomes && modifiedIncomes.length > 0) {
        changedIncomesCount = modifiedIncomes.length;
        reasons.push(`${modifiedIncomes.length} ingreso(s) nuevo(s)`);
    }

    // Check for expense changes
    const { data: modifiedExpenses } = await supabase
        .from('essential_expenses')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gt('created_at', activePlan.created_at);

    if (modifiedExpenses && modifiedExpenses.length > 0) {
        reasons.push(`${modifiedExpenses.length} gasto(s) nuevo(s)`);
    }

    // Check if plan is older than 30 days
    const daysSincePlan = Math.floor((Date.now() - planCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSincePlan > 30) {
        reasons.push(`Plan tiene ${daysSincePlan} días de antigüedad`);
    }

    return {
        needsRecalculation: reasons.length > 0,
        reasons,
        lastPlanDate: activePlan.created_at,
        changedDebtsCount,
        changedIncomesCount,
    };
}

/**
 * Archive the current plan and prepare for recalculation
 */
export async function archiveCurrentPlan(): Promise<void> {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Deactivate all active plans
    const { error } = await supabase
        .from('plans')
        .update({ active: false })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('active', true);

    if (error) {
        throw new Error('Error al archivar el plan');
    }

    revalidatePath('/plan');
    revalidatePath('/dashboard');
}

/**
 * Get a summary of the user's current financial situation for display
 */
export async function getFinancialSummary() {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return null;
    }

    // Get total debt
    const { data: debts } = await supabase
        .from('debts')
        .select('balance, min_payment, apr')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    const totalDebt = debts?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;
    const totalMinPayments = debts?.reduce((sum, d) => sum + Number(d.min_payment), 0) || 0;
    const avgApr = debts?.length
        ? debts.reduce((sum, d) => sum + Number(d.apr || 0), 0) / debts.length
        : 0;

    // Get income
    const { data: incomes } = await supabase
        .from('income_events')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const totalIncome = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

    // Get expenses
    const { data: expenses } = await supabase
        .from('essential_expenses')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    const availableForDebt = Math.max(0, totalIncome - totalExpenses);

    return {
        totalDebt,
        totalMinPayments,
        avgApr: Math.round(avgApr * 100) / 100,
        debtCount: debts?.length || 0,
        totalIncome,
        totalExpenses,
        availableForDebt,
    };
}
