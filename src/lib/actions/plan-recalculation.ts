'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, gt } from 'drizzle-orm';
import { getActivePlan } from './plans';
import { requireUserTenant } from '@/lib/tenant/server';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { getDb } from '@/db/client';
import { debts, essentialExpenses, incomeEvents, plans } from '@/db/schema';

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

    if (isDrizzleEnabled()) {
        const db = getDb();
        const debtScope = and(
            eq(debts.tenantId, tenantId),
            eq(debts.userId, user.id),
            eq(debts.status, 'ACTIVE'),
        );

        const [modifiedDebts, newDebts, modifiedIncomes, modifiedExpenses] =
            await Promise.all([
                db
                    .select({ id: debts.id, creditor: debts.creditor })
                    .from(debts)
                    .where(and(debtScope, gt(debts.updatedAt, planCreatedAt))),
                db
                    .select({ id: debts.id, creditor: debts.creditor })
                    .from(debts)
                    .where(and(debtScope, gt(debts.createdAt, planCreatedAt))),
                db
                    .select({ id: incomeEvents.id })
                    .from(incomeEvents)
                    .where(
                        and(
                            eq(incomeEvents.tenantId, tenantId),
                            eq(incomeEvents.userId, user.id),
                            gt(incomeEvents.createdAt, planCreatedAt),
                        ),
                    ),
                db
                    .select({ id: essentialExpenses.id })
                    .from(essentialExpenses)
                    .where(
                        and(
                            eq(essentialExpenses.tenantId, tenantId),
                            eq(essentialExpenses.userId, user.id),
                            gt(essentialExpenses.createdAt, planCreatedAt),
                        ),
                    ),
            ]);

        if (modifiedDebts.length > 0) {
            changedDebtsCount = modifiedDebts.length;
            reasons.push(
                `${modifiedDebts.length} deuda(s) modificada(s): ${modifiedDebts.map((d) => d.creditor).join(', ')}`,
            );
        }

        if (newDebts.length > 0) {
            changedDebtsCount += newDebts.length;
            reasons.push(
                `${newDebts.length} deuda(s) nueva(s): ${newDebts.map((d) => d.creditor).join(', ')}`,
            );
        }

        if (modifiedIncomes.length > 0) {
            changedIncomesCount = modifiedIncomes.length;
            reasons.push(`${modifiedIncomes.length} ingreso(s) nuevo(s)`);
        }

        if (modifiedExpenses.length > 0) {
            reasons.push(`${modifiedExpenses.length} gasto(s) nuevo(s)`);
        }
    } else {
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
            reasons.push(
                `${modifiedDebts.length} deuda(s) modificada(s): ${modifiedDebts.map((d) => d.creditor).join(', ')}`,
            );
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
            reasons.push(
                `${newDebts.length} deuda(s) nueva(s): ${newDebts.map((d) => d.creditor).join(', ')}`,
            );
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
    }

    // Check if plan is older than 30 days
    const daysSincePlan = Math.floor(
        (Date.now() - planCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
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

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            await db
                .update(plans)
                .set({ active: false })
                .where(
                    and(
                        eq(plans.tenantId, tenantId),
                        eq(plans.userId, user.id),
                        eq(plans.active, true),
                    ),
                );
        } catch (error) {
            console.error('Error archiving plan:', error);
            throw new Error('Error al archivar el plan');
        }

        revalidatePath('/plan');
        revalidatePath('/dashboard');
        return;
    }

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

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [debtRows, incomeRows, expenseRows] = await Promise.all([
            db
                .select({
                    balance: debts.balance,
                    minPayment: debts.minPayment,
                    apr: debts.apr,
                })
                .from(debts)
                .where(
                    and(
                        eq(debts.tenantId, tenantId),
                        eq(debts.userId, user.id),
                        eq(debts.status, 'ACTIVE'),
                    ),
                ),
            db
                .select({ amount: incomeEvents.amount })
                .from(incomeEvents)
                .where(
                    and(
                        eq(incomeEvents.tenantId, tenantId),
                        eq(incomeEvents.userId, user.id),
                    ),
                ),
            db
                .select({ amount: essentialExpenses.amount })
                .from(essentialExpenses)
                .where(
                    and(
                        eq(essentialExpenses.tenantId, tenantId),
                        eq(essentialExpenses.userId, user.id),
                    ),
                ),
        ]);

        const totalDebt = debtRows.reduce((sum, d) => sum + Number(d.balance), 0);
        const totalMinPayments = debtRows.reduce(
            (sum, d) => sum + Number(d.minPayment),
            0,
        );
        const avgApr = debtRows.length
            ? debtRows.reduce((sum, d) => sum + Number(d.apr || 0), 0) / debtRows.length
            : 0;
        const totalIncome = incomeRows.reduce((sum, i) => sum + Number(i.amount), 0);
        const totalExpenses = expenseRows.reduce(
            (sum, e) => sum + Number(e.amount),
            0,
        );

        return {
            totalDebt,
            totalMinPayments,
            avgApr: Math.round(avgApr * 100) / 100,
            debtCount: debtRows.length,
            totalIncome,
            totalExpenses,
            availableForDebt: Math.max(0, totalIncome - totalExpenses),
        };
    }

    // Get total debt
    const { data: debtRows } = await supabase
        .from('debts')
        .select('balance, min_payment, apr')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    const totalDebt = debtRows?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;
    const totalMinPayments =
        debtRows?.reduce((sum, d) => sum + Number(d.min_payment), 0) || 0;
    const avgApr = debtRows?.length
        ? debtRows.reduce((sum, d) => sum + Number(d.apr || 0), 0) / debtRows.length
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
        debtCount: debtRows?.length || 0,
        totalIncome,
        totalExpenses,
        availableForDebt,
    };
}
