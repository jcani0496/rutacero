'use server';

import { revalidatePath } from 'next/cache';
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

// ============================================
// GET USER DEBTS (internal helper)
// ============================================

async function getUserDebts(): Promise<Debt[]> {
    const { supabase, user, tenantId } = await requireUserTenant();

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
    const { count: existingPlanCount } = await supabase
        .from('plans')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    // Get user's debts
    const debts = await getUserDebts();

    if (debts.length === 0) {
        throw new Error('No hay deudas activas para planificar');
    }

    // Get user's currency + personalization preferences
    const { data: profileData } = await supabase
        .from('user_profiles')
        .select('currency_base, safety_buffer_pct')
        .eq('user_id', user.id)
        .single();

    const profile = profileData as { currency_base: string; safety_buffer_pct?: number } | null;
    const currency = (profile?.currency_base as 'GTQ' | 'USD') || 'GTQ';
    const safetyBufferPct = Number(profile?.safety_buffer_pct ?? 10);

    const { hasAccess: canUseGoals } = await checkFeatureAccess('debtGoals');
    const { adjustedDebts, goalOverrides, modelOverrides } = applyDebtGoals(debts, canUseGoals);

    // Calculate monthly budget if not provided
    let monthlyBudget = input.monthlyBudget;

    if (!monthlyBudget) {
        // Get from finances - available for debt
        const { data: incomes } = await supabase
            .from('income_events')
            .select('amount')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id);

        const { data: expenses } = await supabase
            .from('essential_expenses')
            .select('budget_amount')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id);

        const totalIncome = (incomes || []).reduce((sum, i) => sum + Number(i.amount), 0);
        const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.budget_amount || 0), 0);
        monthlyBudget = Math.max(totalIncome - totalExpenses, 0);
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

    // Save to database
    const { data: savedPlan, error: planError } = await supabase
        .from('plans')
        .insert({
            tenant_id: tenantId,
            user_id: user.id,
            strategy: input.strategy,
            engine_version: ENGINE_VERSION,
            active: false,
            assumptions: {
                monthlyBudget,
                currency,
                generatedAt: plan.generatedAt.toISOString(),
                goalOverrides,
                safetyBufferPct,
                modelOverrides,
            },
            horizon_periods: plan.timeline.length,
            eta_debt_free: plan.summary.etaDebtFree.toISOString().split('T')[0],
            interest_estimate: plan.summary.totalInterest,
            avg_payment: plan.summary.avgMonthlyPayment,
        })
        .select()
        .single();

    if (planError || !savedPlan) {
        throw new Error('Error al guardar el plan');
    }

    // Save plan items (first 12 months for now)
    const itemsToSave = plan.timeline.slice(0, 12).flatMap(step =>
        step.payments.map((payment, idx) => ({
            tenant_id: tenantId,
            plan_id: savedPlan.id,
            period_start: step.periodStart.toISOString().split('T')[0],
            period_end: step.periodEnd.toISOString().split('T')[0],
            debt_id: payment.debtId,
            planned_amount: payment.amount,
            currency,
            priority_order: idx + 1,
            is_focus: payment.debtId === step.focusDebtId,
            rationale: {
                ...(plan.debts.find(d => d.id === payment.debtId)?.rationale || {}),
                // Used by the UI to properly label "extra" vs "minimum" even when
                // minimum is adjusted via modeling/goals at plan generation time.
                min_due: modelOverrides[payment.debtId]?.effectiveMinPayment ?? null,
            },
        }))
    );

    if (itemsToSave.length > 0) {
        // plan_items.rationale is JSONB; cast to avoid TS friction with structural JSON typing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('plan_items') as any).insert(itemsToSave);
    }

    revalidatePath('/plan');
    revalidatePath('/dashboard');

    if ((existingPlanCount || 0) === 0) {
        await recordMarketingEvent({
            eventName: 'first_plan_generated',
            tenantId,
            userId: user.id,
            path: '/plan',
            planStrategy: input.strategy,
        });
    }

    return { ok: true, data: savedPlan as Plan };
}

// ============================================
// GET PLANS
// ============================================

export async function getPlans(): Promise<Plan[]> {
    const { supabase, user, tenantId } = await requireUserTenant();

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
    const { supabase, user, tenantId } = await requireUserTenant();

    const debts = await getUserDebts();

    if (debts.length === 0) {
        throw new Error('No hay deudas activas para comparar');
    }

    const { data: profileData } = await supabase
        .from('user_profiles')
        .select('currency_base, goal_type, motivation_level, risk_tolerance, safety_buffer_pct')
        .eq('user_id', user.id)
        .single();

    const profile = profileData as {
        currency_base: string;
        goal_type?: 'FASTEST' | 'LEAST_INTEREST' | 'BALANCED';
        motivation_level?: number;
        risk_tolerance?: number;
        safety_buffer_pct?: number;
    } | null;
    const currency = (profile?.currency_base as 'GTQ' | 'USD') || 'GTQ';
    const goalType = profile?.goal_type || 'BALANCED';
    const motivationLevel = profile?.motivation_level ?? 3;
    const riskTolerance = profile?.risk_tolerance ?? 3;
    const safetyBufferPct = Number(profile?.safety_buffer_pct ?? 10);

    // Calculate budget if not provided
    if (!monthlyBudget) {
        const { data: incomes } = await supabase
            .from('income_events')
            .select('amount')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id);

        const { data: expenses } = await supabase
            .from('essential_expenses')
            .select('budget_amount')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id);

        const totalIncome = (incomes || []).reduce((sum, i) => sum + Number(i.amount), 0);
        const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.budget_amount || 0), 0);
        monthlyBudget = Math.max(totalIncome - totalExpenses, 0);
    }

    const { hasAccess: canUseGoals } = await checkFeatureAccess('debtGoals');
    const { adjustedDebts } = applyDebtGoals(debts, canUseGoals);
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
