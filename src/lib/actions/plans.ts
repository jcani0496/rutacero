'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { calculatePayoffPlan, comparePlansPersonalized, ENGINE_VERSION } from '@/lib/engine/engine';
import type { PayoffStrategy, PlanComparison } from '@/lib/engine/types';
import type { Debt, Plan, PlanItem } from '@/types';
import { checkFeatureAccess } from '@/lib/utils/feature-access';
import { requireUserTenant } from '@/lib/tenant/server';
import {
    computeEffectiveMonthlyBudget,
    createBudgetShortfallIssue,
    type ComparisonResult,
} from '@/lib/plans/contracts';
import { recordMarketingEvent } from '@/lib/funnel/events';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { mapDebtRow, mapPlanItemRow, mapPlanRow } from '@/lib/data/mappers';
import { getDb } from '@/db/client';
import {
    debts,
    essentialExpenses,
    incomeEvents,
    planItems,
    plans,
    userProfiles,
} from '@/db/schema';

// ============================================
// GET USER DEBTS (internal helper)
// ============================================

async function getUserDebts(): Promise<Debt[]> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select()
            .from(debts)
            .where(
                and(
                    eq(debts.tenantId, tenantId),
                    eq(debts.userId, user.id),
                    eq(debts.status, 'ACTIVE'),
                ),
            )
            .orderBy(desc(debts.balance));
        return rows.map(mapDebtRow);
    }

    // PERF-011: Select specific fields instead of *
    const { data, error } = await supabase
        .from('debts')
        .select('id, user_id, type, creditor, balance, currency, apr, min_payment, statement_date, due_date, payment_day, interest_model, monthly_fees, min_payment_rule, next_payment_date, category, installment_count, installments_left, fixed_payment, goal_extra_payment, goal_target_date, status, notes, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('balance', { ascending: false });

    if (error) {
        throw new Error('Error al obtener deudas');
    }

    return (data || []) as Debt[];
}

type PlanProfileFields = {
    currency_base: string;
    goal_type?: 'FASTEST' | 'LEAST_INTEREST' | 'BALANCED';
    motivation_level?: number;
    risk_tolerance?: number;
    safety_buffer_pct?: number;
};

async function getPlanProfile(
    userId: string,
    fields: 'budget' | 'compare',
): Promise<PlanProfileFields | null> {
    const { supabase } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [row] = await db
            .select({
                currencyBase: userProfiles.currencyBase,
                safetyBufferPct: userProfiles.safetyBufferPct,
                goalType: userProfiles.goalType,
                motivationLevel: userProfiles.motivationLevel,
                riskTolerance: userProfiles.riskTolerance,
            })
            .from(userProfiles)
            .where(eq(userProfiles.userId, userId))
            .limit(1);

        if (!row) return null;

        return {
            currency_base: row.currencyBase,
            safety_buffer_pct: Number(row.safetyBufferPct ?? 10),
            goal_type: row.goalType as PlanProfileFields['goal_type'],
            motivation_level: row.motivationLevel,
            risk_tolerance: row.riskTolerance,
        };
    }

    if (fields === 'budget') {
        const { data } = await supabase
            .from('user_profiles')
            .select('currency_base, safety_buffer_pct')
            .eq('user_id', userId)
            .single();
        return data as PlanProfileFields | null;
    }

    const { data } = await supabase
        .from('user_profiles')
        .select('currency_base, goal_type, motivation_level, risk_tolerance, safety_buffer_pct')
        .eq('user_id', userId)
        .single();
    return data as PlanProfileFields | null;
}

async function getMonthlyBudgetFromFinances(
    tenantId: string,
    userId: string,
): Promise<number> {
    const { supabase } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const scope = and(
            eq(incomeEvents.tenantId, tenantId),
            eq(incomeEvents.userId, userId),
        );
        const expenseScope = and(
            eq(essentialExpenses.tenantId, tenantId),
            eq(essentialExpenses.userId, userId),
        );

        const [incomes, expenses] = await Promise.all([
            db.select({ amount: incomeEvents.amount }).from(incomeEvents).where(scope),
            db
                .select({ budgetAmount: essentialExpenses.budgetAmount })
                .from(essentialExpenses)
                .where(expenseScope),
        ]);

        const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
        const totalExpenses = expenses.reduce(
            (sum, e) => sum + Number(e.budgetAmount || 0),
            0,
        );
        return Math.max(totalIncome - totalExpenses, 0);
    }

    const { data: incomes } = await supabase
        .from('income_events')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

    const { data: expenses } = await supabase
        .from('essential_expenses')
        .select('budget_amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

    const totalIncome = (incomes || []).reduce((sum, i) => sum + Number(i.amount), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.budget_amount || 0), 0);
    return Math.max(totalIncome - totalExpenses, 0);
}

function monthsToTarget(targetDate: Date, today: Date) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    return Math.max(1, diff);
}

function calculateTargetPayment(balance: number, apr: number | null, months: number) {
    if (months <= 0) return balance;
    if (!apr || apr <= 0) {
        return balance / months;
    }

    const monthlyRate = apr / 100 / 12;
    const denominator = 1 - Math.pow(1 + monthlyRate, -months);
    if (denominator <= 0) return balance / months;

    return (balance * monthlyRate) / denominator;
}

function computeModeledMinPayment(debt: Debt): { modeledMinPayment: number | null; note: string | null } {
    const rule = debt.min_payment_rule as unknown;
    if (!rule || typeof rule !== 'object') return { modeledMinPayment: null, note: null };

    const r = rule as Record<string, unknown>;
    const type = String(r.type || '');
    const balance = Number(debt.balance);
    const apr = Number(debt.apr || 0);
    const fees = Math.max(0, Number(debt.monthly_fees || 0));

    if (!Number.isFinite(balance) || balance <= 0) return { modeledMinPayment: null, note: null };

    if (type === 'FIXED') {
        const amount = Number(r.amount);
        if (!Number.isFinite(amount) || amount <= 0) return { modeledMinPayment: null, note: null };
        return { modeledMinPayment: amount, note: 'Minimo fijo por regla' };
    }

    if (type === 'PERCENT_OF_BALANCE') {
        const percent = Number(r.percent);
        const minimum = r.minimum !== undefined ? Number(r.minimum) : 0;
        if (!Number.isFinite(percent) || percent < 0) return { modeledMinPayment: null, note: null };
        const calc = balance * percent;
        const modeled = Math.max(calc, Number.isFinite(minimum) ? minimum : 0);
        return { modeledMinPayment: modeled, note: 'Minimo estimado por porcentaje de saldo' };
    }

    if (type === 'PERCENT_PLUS_INTEREST_FEES') {
        const percent = Number(r.percent);
        const minimum = r.minimum !== undefined ? Number(r.minimum) : 0;
        if (!Number.isFinite(percent) || percent < 0) return { modeledMinPayment: null, note: null };

        // Approximate monthly interest component (best-effort).
        const interestEst = apr > 0 ? balance * (apr / 100 / 12) : 0;
        const base = balance * percent + interestEst + fees;
        const modeled = Math.max(base, Number.isFinite(minimum) ? minimum : 0);
        return { modeledMinPayment: modeled, note: 'Minimo estimado: %saldo + interes + fees (aprox)' };
    }

    return { modeledMinPayment: null, note: null };
}

function applyDebtGoals(debts: Debt[], canUseGoals: boolean) {
    const today = new Date();
    const goalOverrides: Record<string, { extraPayment: number; targetDate: string | null; targetPayment: number | null; monthsToTarget: number | null }> = {};
    const modelOverrides: Record<string, { baseMinPayment: number; modeledMinPayment: number | null; effectiveMinPayment: number; note: string | null }> = {};

    if (!canUseGoals) {
        // Still apply modeling even if goals are disabled.
        const adjustedDebts = debts.map((debt) => {
            const baseMinPayment = Number(debt.min_payment);
            const { modeledMinPayment, note } = computeModeledMinPayment(debt);
            const effectiveMinPayment = modeledMinPayment ? Math.max(baseMinPayment, modeledMinPayment) : baseMinPayment;
            modelOverrides[debt.id] = {
                baseMinPayment,
                modeledMinPayment,
                effectiveMinPayment: Math.round(effectiveMinPayment * 100) / 100,
                note,
            };
            return { ...debt, min_payment: Math.round(effectiveMinPayment * 100) / 100 };
        });

        return { adjustedDebts, goalOverrides, modelOverrides };
    }

    const adjustedDebts = debts.map((debt) => {
        const baseMinPayment = Number(debt.min_payment);
        const { modeledMinPayment, note } = computeModeledMinPayment(debt);
        const modeledEffective = modeledMinPayment ? Math.max(baseMinPayment, modeledMinPayment) : baseMinPayment;

        const extraPayment = Number(debt.goal_extra_payment || 0);
        let targetPayment: number | null = null;
        let months: number | null = null;

        if (debt.goal_target_date) {
            const targetDate = new Date(debt.goal_target_date);
            if (!Number.isNaN(targetDate.getTime()) && targetDate >= today) {
                months = monthsToTarget(targetDate, today);
                const calculated = calculateTargetPayment(Number(debt.balance), Number(debt.apr || 0), months);
                if (Number.isFinite(calculated)) {
                    targetPayment = calculated;
                }
            }
        }

        const effectiveMinPayment = Math.max(modeledEffective, modeledEffective + extraPayment, targetPayment ?? 0);

        goalOverrides[debt.id] = {
            extraPayment,
            targetDate: debt.goal_target_date ?? null,
            targetPayment: targetPayment ? Math.round(targetPayment * 100) / 100 : null,
            monthsToTarget: months,
        };

        modelOverrides[debt.id] = {
            baseMinPayment,
            modeledMinPayment: modeledMinPayment ? Math.round(modeledMinPayment * 100) / 100 : null,
            effectiveMinPayment: Math.round(effectiveMinPayment * 100) / 100,
            note,
        };

        return {
            ...debt,
            min_payment: Math.round(effectiveMinPayment * 100) / 100,
        };
    });

    return { adjustedDebts, goalOverrides, modelOverrides };
}

// ============================================
// GENERATE PLAN
// ============================================

export interface GeneratePlanInput {
    strategy: PayoffStrategy;
    monthlyBudget?: number; // Optional - will calculate from finances
}

export type GeneratePlanResult = ComparisonResult<Plan>;
export type CompareStrategiesResult = ComparisonResult<PlanComparison>;

export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
    const { supabase, user, tenantId } = await requireUserTenant();

    let existingPlanCount = 0;
    if (isDrizzleEnabled()) {
        const db = getDb();
        const [countRow] = await db
            .select({ value: count() })
            .from(plans)
            .where(and(eq(plans.tenantId, tenantId), eq(plans.userId, user.id)));
        existingPlanCount = countRow?.value ?? 0;
    } else {
        const { count: supabaseCount } = await supabase
            .from('plans')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id);
        existingPlanCount = supabaseCount || 0;
    }

    // Get user's debts
    const userDebts = await getUserDebts();

    if (userDebts.length === 0) {
        throw new Error('No hay deudas activas para planificar');
    }

    // Get user's currency + personalization preferences
    const profile = await getPlanProfile(user.id, 'budget');
    const currency = (profile?.currency_base as 'GTQ' | 'USD') || 'GTQ';
    const safetyBufferPct = Number(profile?.safety_buffer_pct ?? 10);

    const { hasAccess: canUseGoals } = await checkFeatureAccess('debtGoals');
    const { adjustedDebts, goalOverrides, modelOverrides } = applyDebtGoals(userDebts, canUseGoals);

    // Calculate monthly budget if not provided
    let monthlyBudget = input.monthlyBudget;

    if (!monthlyBudget) {
        monthlyBudget = await getMonthlyBudgetFromFinances(tenantId, user.id);
    }

    // Feasibility: do not inflate budgets (avoids unrealistic plans).
    const totalMinPayments = adjustedDebts.reduce((sum, d) => sum + Number(d.min_payment), 0);
    const { effectiveBudget, feasible } = computeEffectiveMonthlyBudget({
        rawMonthlyBudget: monthlyBudget,
        totalMinPayments,
        safetyBufferPct,
    });
    if (!feasible) {
        return {
            ok: false,
            issue: createBudgetShortfallIssue({
                effectiveBudget,
                requiredMinPayments: totalMinPayments,
                safetyBufferPct,
            }),
        };
    }
    monthlyBudget = effectiveBudget;

    // Run the engine
    const plan = calculatePayoffPlan({
        debts: adjustedDebts,
        monthlyBudget,
        currency,
        strategy: input.strategy,
    });

    const assumptions = {
        monthlyBudget,
        currency,
        generatedAt: plan.generatedAt.toISOString(),
        goalOverrides,
        safetyBufferPct,
        modelOverrides,
    };
    const etaDebtFree = plan.summary.etaDebtFree.toISOString().split('T')[0];

    let savedPlan: Plan;

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const [row] = await db
                .insert(plans)
                .values({
                    tenantId,
                    userId: user.id,
                    strategy: input.strategy,
                    engineVersion: ENGINE_VERSION,
                    active: false,
                    assumptions,
                    horizonPeriods: plan.timeline.length,
                    etaDebtFree,
                    interestEstimate: String(plan.summary.totalInterest),
                    avgPayment: String(plan.summary.avgMonthlyPayment),
                })
                .returning();

            if (!row) {
                throw new Error('Error al guardar el plan');
            }

            const itemsToSave = plan.timeline.slice(0, 12).flatMap((step) =>
                step.payments.map((payment, idx) => ({
                    tenantId,
                    planId: row.id,
                    periodStart: step.periodStart.toISOString().split('T')[0],
                    periodEnd: step.periodEnd.toISOString().split('T')[0],
                    debtId: payment.debtId,
                    plannedAmount: String(payment.amount),
                    currency,
                    priorityOrder: idx + 1,
                    isFocus: payment.debtId === step.focusDebtId,
                    rationale: {
                        ...(plan.debts.find((d) => d.id === payment.debtId)?.rationale || {}),
                        min_due: modelOverrides[payment.debtId]?.effectiveMinPayment ?? null,
                    },
                })),
            );

            if (itemsToSave.length > 0) {
                await db.insert(planItems).values(itemsToSave);
            }

            savedPlan = mapPlanRow(row);
        } catch (error) {
            console.error('Error saving plan:', error);
            throw new Error('Error al guardar el plan');
        }
    } else {
        const { data: inserted, error: planError } = await supabase
            .from('plans')
            .insert({
                tenant_id: tenantId,
                user_id: user.id,
                strategy: input.strategy,
                engine_version: ENGINE_VERSION,
                active: false,
                assumptions,
                horizon_periods: plan.timeline.length,
                eta_debt_free: etaDebtFree,
                interest_estimate: plan.summary.totalInterest,
                avg_payment: plan.summary.avgMonthlyPayment,
            })
            .select()
            .single();

        if (planError || !inserted) {
            throw new Error('Error al guardar el plan');
        }

        const itemsToSave = plan.timeline.slice(0, 12).flatMap((step) =>
            step.payments.map((payment, idx) => ({
                tenant_id: tenantId,
                plan_id: inserted.id,
                period_start: step.periodStart.toISOString().split('T')[0],
                period_end: step.periodEnd.toISOString().split('T')[0],
                debt_id: payment.debtId,
                planned_amount: payment.amount,
                currency,
                priority_order: idx + 1,
                is_focus: payment.debtId === step.focusDebtId,
                rationale: {
                    ...(plan.debts.find((d) => d.id === payment.debtId)?.rationale || {}),
                    // Used by the UI to properly label "extra" vs "minimum" even when
                    // minimum is adjusted via modeling/goals at plan generation time.
                    min_due: modelOverrides[payment.debtId]?.effectiveMinPayment ?? null,
                },
            })),
        );

        if (itemsToSave.length > 0) {
            // plan_items.rationale is JSONB; cast to avoid TS friction with structural JSON typing.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('plan_items') as any).insert(itemsToSave);
        }

        savedPlan = inserted as Plan;
    }

    revalidatePath('/plan');
    revalidatePath('/dashboard');

    if (existingPlanCount === 0) {
        await recordMarketingEvent({
            eventName: 'first_plan_generated',
            tenantId,
            userId: user.id,
            path: '/plan',
            planStrategy: input.strategy,
        });
    }

    return { ok: true, data: savedPlan };
}

// ============================================
// GET PLANS
// ============================================

export async function getPlans(): Promise<Plan[]> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select()
            .from(plans)
            .where(and(eq(plans.tenantId, tenantId), eq(plans.userId, user.id)))
            .orderBy(desc(plans.createdAt));
        return rows.map(mapPlanRow);
    }

    // PERF-011: Select specific fields instead of *
    const { data, error } = await supabase
        .from('plans')
        .select('id, user_id, strategy, engine_version, created_at, active, assumptions, horizon_periods, eta_debt_free, interest_estimate, avg_payment')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error('Error al obtener planes');
    }

    return (data || []) as Plan[];
}

// ============================================
// GET ACTIVE PLAN
// ============================================

export async function getActivePlan(): Promise<Plan | null> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return null;
    }

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [row] = await db
            .select()
            .from(plans)
            .where(
                and(
                    eq(plans.tenantId, tenantId),
                    eq(plans.userId, user.id),
                    eq(plans.active, true),
                ),
            )
            .limit(1);
        return row ? mapPlanRow(row) : null;
    }

    // PERF-011: Select specific fields instead of *
    const { data } = await supabase
        .from('plans')
        .select('id, user_id, strategy, engine_version, created_at, active, assumptions, horizon_periods, eta_debt_free, interest_estimate, avg_payment')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('active', true)
        .single();

    return data as Plan | null;
}

// ============================================
// SET ACTIVE PLAN
// ============================================

export async function setActivePlan(planId: string): Promise<void> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            await db.transaction(async (tx) => {
                await tx
                    .update(plans)
                    .set({ active: false })
                    .where(and(eq(plans.tenantId, tenantId), eq(plans.userId, user.id)));

                await tx
                    .update(plans)
                    .set({ active: true })
                    .where(
                        and(
                            eq(plans.id, planId),
                            eq(plans.tenantId, tenantId),
                            eq(plans.userId, user.id),
                        ),
                    );
            });
        } catch (error) {
            console.error('Error activating plan:', error);
            throw new Error('Error al activar el plan');
        }

        revalidatePath('/plan');
        revalidatePath('/dashboard');
        return;
    }

    // Deactivate all plans first
    await supabase
        .from('plans')
        .update({ active: false })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    // Activate the selected plan
    const { error } = await supabase
        .from('plans')
        .update({ active: true })
        .eq('id', planId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error('Error al activar el plan');
    }

    revalidatePath('/plan');
    revalidatePath('/dashboard');
}

// ============================================
// DELETE PLAN
// ============================================

export async function deletePlan(planId: string): Promise<void> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            await db
                .delete(plans)
                .where(
                    and(
                        eq(plans.id, planId),
                        eq(plans.tenantId, tenantId),
                        eq(plans.userId, user.id),
                    ),
                );
        } catch (error) {
            console.error('Error deleting plan:', error);
            throw new Error('Error al eliminar el plan');
        }

        revalidatePath('/plan');
        return;
    }

    const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error('Error al eliminar el plan');
    }

    revalidatePath('/plan');
}

// ============================================
// GET PLAN ITEMS
// ============================================

export async function getPlanItems(planId: string): Promise<PlanItem[]> {
    const { supabase, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select({
                id: planItems.id,
                planId: planItems.planId,
                periodStart: planItems.periodStart,
                periodEnd: planItems.periodEnd,
                debtId: planItems.debtId,
                plannedAmount: planItems.plannedAmount,
                currency: planItems.currency,
                priorityOrder: planItems.priorityOrder,
                isFocus: planItems.isFocus,
                rationale: planItems.rationale,
                debtJoinId: debts.id,
                debtCreditor: debts.creditor,
                debtBalance: debts.balance,
                debtMinPayment: debts.minPayment,
                debtApr: debts.apr,
                debtType: debts.type,
            })
            .from(planItems)
            .leftJoin(debts, eq(planItems.debtId, debts.id))
            .where(and(eq(planItems.planId, planId), eq(planItems.tenantId, tenantId)))
            .orderBy(asc(planItems.periodStart), asc(planItems.priorityOrder));

        return rows.map((row) =>
            mapPlanItemRow({
                id: row.id,
                planId: row.planId,
                periodStart: row.periodStart,
                periodEnd: row.periodEnd,
                debtId: row.debtId,
                plannedAmount: row.plannedAmount,
                currency: row.currency,
                priorityOrder: row.priorityOrder,
                isFocus: row.isFocus,
                rationale: row.rationale,
                debt: row.debtJoinId
                    ? {
                          id: row.debtJoinId,
                          creditor: row.debtCreditor ?? '',
                          balance: row.debtBalance ?? 0,
                          minPayment: row.debtMinPayment ?? 0,
                          apr: row.debtApr,
                          type: row.debtType ?? 'LOAN',
                      }
                    : null,
            }),
        );
    }

    const { data, error } = await supabase
        .from('plan_items')
        .select(`
            *,
            debt:debts (
                id,
                creditor,
                balance,
                min_payment,
                apr,
                type
            )
        `)
        .eq('plan_id', planId)
        .eq('tenant_id', tenantId)
        .order('period_start', { ascending: true })
        .order('priority_order', { ascending: true });

    if (error) {
        throw new Error('Error al obtener items del plan');
    }

    return (data || []) as PlanItem[];
}

// ============================================
// COMPARE STRATEGIES
// ============================================

export async function compareStrategies(monthlyBudget?: number): Promise<CompareStrategiesResult> {
    const { user, tenantId } = await requireUserTenant();

    const userDebts = await getUserDebts();

    if (userDebts.length === 0) {
        throw new Error('No hay deudas activas para comparar');
    }

    const profile = await getPlanProfile(user.id, 'compare');
    const currency = (profile?.currency_base as 'GTQ' | 'USD') || 'GTQ';
    const goalType = profile?.goal_type || 'BALANCED';
    const motivationLevel = profile?.motivation_level ?? 3;
    const riskTolerance = profile?.risk_tolerance ?? 3;
    const safetyBufferPct = Number(profile?.safety_buffer_pct ?? 10);

    // Calculate budget if not provided
    if (!monthlyBudget) {
        monthlyBudget = await getMonthlyBudgetFromFinances(tenantId, user.id);
    }

    const { hasAccess: canUseGoals } = await checkFeatureAccess('debtGoals');
    const { adjustedDebts } = applyDebtGoals(userDebts, canUseGoals);
    const totalMinPayments = adjustedDebts.reduce((sum, d) => sum + Number(d.min_payment), 0);
    const { effectiveBudget, feasible } = computeEffectiveMonthlyBudget({
        rawMonthlyBudget: monthlyBudget,
        totalMinPayments,
        safetyBufferPct,
    });
    if (!feasible) {
        return {
            ok: false,
            issue: createBudgetShortfallIssue({
                effectiveBudget,
                requiredMinPayments: totalMinPayments,
                safetyBufferPct,
            }),
        };
    }

    return {
        ok: true,
        data: comparePlansPersonalized(adjustedDebts, effectiveBudget, currency, {
            goalType,
            motivationLevel,
            riskTolerance,
        }),
    };
}
