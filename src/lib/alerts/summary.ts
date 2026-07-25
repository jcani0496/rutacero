/**
 * Tenant-scoped alert computation helpers.
 *
 * These are deliberately NOT server actions. They accept an already-resolved
 * tenant/user context so callers (e.g. the dashboard page) that have already
 * gone through `requireUserTenant()` can avoid a redundant auth round-trip.
 *
 * Dual-path behind DATA_PROVIDER: with drizzle, debts/subscriptions are read
 * via getDb(); with supabase (default), PostgREST is used.
 *
 * The `'use server'` versions in `@/lib/actions/alerts` become thin wrappers
 * around these helpers.
 */

import { and, eq } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDb } from '@/db/client';
import { debts, subscriptions } from '@/db/schema';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { mapDebtRow } from '@/lib/data/mappers';
import type { Database } from '@/types/supabase';
import type { Debt } from '@/types';

// ============================================
// ALERT TYPES (re-exported by the action module)
// ============================================

export type AlertType =
    | 'PAYMENT_DUE'
    | 'LOW_BALANCE'
    | 'RISK_WARNING'
    | 'MILESTONE'
    | 'OVERDUE'
    | 'GOAL_DEVIATION';

export interface Alert {
    id: string;
    type: AlertType;
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
    debtId?: string;
    creditor?: string;
    amount?: number;
    dueDate?: Date;
    createdAt: Date;
    dismissed: boolean;
}

export interface AlertSummary {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topAlert: Alert | null;
}

export interface AlertContext {
    /** Required for the Supabase PostgREST path; ignored when DATA_PROVIDER=drizzle. */
    supabase?: SupabaseClient<Database>;
    tenantId: string;
    userId: string;
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 0,
    }).format(amount);
}

async function resolveIsPro(
    ctx: AlertContext,
): Promise<boolean> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const [subscription] = await db
            .select({
                planCode: subscriptions.planCode,
                status: subscriptions.status,
            })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.tenantId, ctx.tenantId),
                    eq(subscriptions.status, 'ACTIVE'),
                ),
            )
            .limit(1);

        const planCode = subscription?.planCode || 'FREE';
        return planCode === 'PRO' || planCode === 'BUSINESS';
    }

    if (!ctx.supabase) {
        return false;
    }

    // Mirrors `getUserPlan()` semantics but uses the already-authenticated
    // supabase client, avoiding another `auth.getUser()` round-trip.
    const { data: subscription } = await ctx.supabase
        .from('subscriptions')
        .select('plan_code, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'ACTIVE')
        .single();

    const planCode = subscription?.plan_code || 'FREE';
    return planCode === 'PRO' || planCode === 'BUSINESS';
}

async function loadActiveDebts(ctx: AlertContext): Promise<Debt[]> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select()
            .from(debts)
            .where(
                and(
                    eq(debts.tenantId, ctx.tenantId),
                    eq(debts.userId, ctx.userId),
                    eq(debts.status, 'ACTIVE'),
                ),
            );
        return rows.map(mapDebtRow);
    }

    if (!ctx.supabase) {
        return [];
    }

    // PERF-011: Select specific fields instead of *
    const { data } = await ctx.supabase
        .from('debts')
        .select(
            'id, user_id, type, creditor, balance, currency, apr, min_payment, statement_date, due_date, next_payment_date, installment_count, installments_left, fixed_payment, goal_extra_payment, goal_target_date, status, notes, created_at, updated_at',
        )
        .eq('tenant_id', ctx.tenantId)
        .eq('user_id', ctx.userId)
        .eq('status', 'ACTIVE');

    return (data || []) as Debt[];
}

function buildAlertsFromDebts(debtList: Debt[], isPro: boolean, today: Date): Alert[] {
    const alerts: Alert[] = [];
    const todayDay = today.getDate();

    for (const debt of debtList) {
        const dueDay = debt.due_date;
        if (dueDay === null) continue; // Skip debts without due date
        const daysUntilDue = dueDay - todayDay;

        // Payment due in 3 days or less
        if (daysUntilDue > 0 && daysUntilDue <= 3) {
            alerts.push({
                id: `due-${debt.id}`,
                type: 'PAYMENT_DUE',
                title: 'Pago Próximo',
                message: `Pago de ${debt.creditor} vence en ${daysUntilDue} día${daysUntilDue === 1 ? '' : 's'}`,
                severity: daysUntilDue === 1 ? 'WARNING' : 'INFO',
                debtId: debt.id,
                creditor: debt.creditor,
                amount: Number(debt.min_payment),
                dueDate: new Date(today.getFullYear(), today.getMonth(), dueDay),
                createdAt: today,
                dismissed: false,
            });
        }

        // Payment due today
        if (daysUntilDue === 0) {
            alerts.push({
                id: `today-${debt.id}`,
                type: 'PAYMENT_DUE',
                title: 'Pago Hoy',
                message: `¡Hoy vence el pago de ${debt.creditor}!`,
                severity: 'CRITICAL',
                debtId: debt.id,
                creditor: debt.creditor,
                amount: Number(debt.min_payment),
                dueDate: today,
                createdAt: today,
                dismissed: false,
            });
        }

        // Overdue payment
        if (daysUntilDue < 0 && daysUntilDue >= -7) {
            alerts.push({
                id: `overdue-${debt.id}`,
                type: 'OVERDUE',
                title: 'Pago Vencido',
                message: `Pago de ${debt.creditor} está vencido por ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) === 1 ? '' : 's'}`,
                severity: 'CRITICAL',
                debtId: debt.id,
                creditor: debt.creditor,
                amount: Number(debt.min_payment),
                dueDate: new Date(today.getFullYear(), today.getMonth(), dueDay),
                createdAt: today,
                dismissed: false,
            });
        }

        // Low balance warning (close to paying off)
        if (Number(debt.balance) > 0 && Number(debt.balance) <= Number(debt.min_payment) * 2) {
            alerts.push({
                id: `low-${debt.id}`,
                type: 'LOW_BALANCE',
                title: '¡Casi Libre!',
                message: `Solo te faltan ${formatCurrency(Number(debt.balance))} para liquidar ${debt.creditor}`,
                severity: 'SUCCESS',
                debtId: debt.id,
                creditor: debt.creditor,
                amount: Number(debt.balance),
                createdAt: today,
                dismissed: false,
            });
        }

        // High interest warning
        if (Number(debt.apr) >= 40) {
            alerts.push({
                id: `high-apr-${debt.id}`,
                type: 'RISK_WARNING',
                title: 'Alta Tasa de Interés',
                message: `${debt.creditor} tiene ${debt.apr}% APR. Prioriza esta deuda.`,
                severity: 'WARNING',
                debtId: debt.id,
                creditor: debt.creditor,
                createdAt: today,
                dismissed: false,
            });
        }
        if (isPro) {
            const goalDateRaw = debt.goal_target_date;
            if (goalDateRaw) {
                const goalDate = new Date(goalDateRaw);
                if (!Number.isNaN(goalDate.getTime())) {
                    const isOverdue = goalDate < today;
                    if (isOverdue && Number(debt.balance) > 0) {
                        alerts.push({
                            id: `goal-overdue-${debt.id}`,
                            type: 'GOAL_DEVIATION',
                            title: 'Meta vencida',
                            message: `La meta de ${debt.creditor} ya venció y aún hay saldo pendiente.`,
                            severity: 'CRITICAL',
                            debtId: debt.id,
                            creditor: debt.creditor,
                            amount: Number(debt.balance),
                            dueDate: goalDate,
                            createdAt: today,
                            dismissed: false,
                        });
                    } else if (!isOverdue) {
                        const monthsToTarget = Math.max(
                            1,
                            (goalDate.getFullYear() - today.getFullYear()) * 12 +
                                (goalDate.getMonth() - today.getMonth()) +
                                1,
                        );
                        const apr = Number(debt.apr || 0);
                        const monthlyRate = apr > 0 ? apr / 100 / 12 : 0;
                        const balance = Number(debt.balance);
                        const requiredPayment = monthlyRate > 0
                            ? (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -monthsToTarget))
                            : balance / monthsToTarget;
                        const extraPayment = Number(debt.goal_extra_payment || 0);
                        const committedPayment = Number(debt.min_payment) + extraPayment;

                        if (Number.isFinite(requiredPayment) && requiredPayment > committedPayment * 1.05) {
                            alerts.push({
                                id: `goal-risk-${debt.id}`,
                                type: 'GOAL_DEVIATION',
                                title: 'Meta en riesgo',
                                message: `Para llegar a tiempo en ${debt.creditor} necesitas ${formatCurrency(Math.round(requiredPayment))} al mes.`,
                                severity: 'WARNING',
                                debtId: debt.id,
                                creditor: debt.creditor,
                                amount: Math.round(requiredPayment),
                                dueDate: goalDate,
                                createdAt: today,
                                dismissed: false,
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort by severity
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2, SUCCESS: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
}

// ============================================
// CORE: GET ALERTS FOR A TENANT/USER
// ============================================

export async function getAlertsFor({
    supabase,
    tenantId,
    userId,
}: AlertContext): Promise<Alert[]> {
    const ctx = { supabase, tenantId, userId };
    const debtList = await loadActiveDebts(ctx);

    if (debtList.length === 0) {
        return [];
    }

    const today = new Date();
    const isPro = await resolveIsPro(ctx);
    return buildAlertsFromDebts(debtList, isPro, today);
}

// ============================================
// CORE: ALERT SUMMARY FOR DASHBOARD
// ============================================

export async function getAlertSummaryFor(ctx: AlertContext): Promise<AlertSummary> {
    const alerts = await getAlertsFor(ctx);

    const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;
    const infoCount = alerts.filter(
        (a) => a.severity === 'INFO' || a.severity === 'SUCCESS',
    ).length;
    const topAlert = alerts.length > 0 ? alerts[0] : null;

    return {
        criticalCount,
        warningCount,
        infoCount,
        topAlert,
    };
}
