'use server';

import { getUserPlan } from '@/lib/utils/feature-access';
import type { Debt } from '@/types';
import { requireUserTenant } from '@/lib/tenant/server';

// ============================================
// ALERT TYPES
// ============================================

export type AlertType = 'PAYMENT_DUE' | 'LOW_BALANCE' | 'RISK_WARNING' | 'MILESTONE' | 'OVERDUE' | 'GOAL_DEVIATION';

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

// ============================================
// GENERATE ALERTS
// ============================================

export async function getAlerts(): Promise<Alert[]> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return [];
    }

    // Get user's debts
    // PERF-011: Select specific fields instead of *
    const { data: debts } = await supabase
        .from('debts')
        .select('id, user_id, type, creditor, balance, currency, apr, min_payment, statement_date, due_date, next_payment_date, installment_count, installments_left, fixed_payment, goal_extra_payment, goal_target_date, status, notes, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    if (!debts || debts.length === 0) {
        return [];
    }

    const alerts: Alert[] = [];
    const today = new Date();
    const todayDay = today.getDate();

    const { isPro } = await getUserPlan();

    for (const debt of debts as Debt[]) {
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
                                1
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
    const severityOrder = { 'CRITICAL': 0, 'WARNING': 1, 'INFO': 2, 'SUCCESS': 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
}

// ============================================
// GET PAYMENT REMINDERS
// ============================================

export async function getUpcomingPayments(): Promise<{
    today: Alert[];
    thisWeek: Alert[];
    nextWeek: Alert[];
}> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { today: [], thisWeek: [], nextWeek: [] };
    }

    // PERF-011: Select specific fields instead of *
    const { data: debts } = await supabase
        .from('debts')
        .select('id, user_id, type, creditor, balance, currency, apr, min_payment, statement_date, due_date, next_payment_date, installment_count, installments_left, fixed_payment, status, notes, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    if (!debts || debts.length === 0) {
        return { today: [], thisWeek: [], nextWeek: [] };
    }

    const today = new Date();
    const todayDay = today.getDate();
    const todayAlerts: Alert[] = [];
    const thisWeekAlerts: Alert[] = [];
    const nextWeekAlerts: Alert[] = [];

    for (const debt of debts as Debt[]) {
        const dueDay = debt.due_date;
        if (dueDay === null) continue; // Skip debts without due date
        let daysUntilDue = dueDay - todayDay;

        // Handle month wrap-around
        if (daysUntilDue < -15) {
            // Due date is in next month
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            daysUntilDue = (daysInMonth - todayDay) + dueDay;
        }

        const alert: Alert = {
            id: `reminder-${debt.id}`,
            type: 'PAYMENT_DUE',
            title: debt.creditor,
            message: `Pago mínimo: ${formatCurrency(Number(debt.min_payment))}`,
            severity: daysUntilDue <= 0 ? 'CRITICAL' : daysUntilDue <= 3 ? 'WARNING' : 'INFO',
            debtId: debt.id,
            creditor: debt.creditor,
            amount: Number(debt.min_payment),
            dueDate: new Date(today.getFullYear(), today.getMonth(), dueDay),
            createdAt: today,
            dismissed: false,
        };

        if (daysUntilDue === 0) {
            todayAlerts.push(alert);
        } else if (daysUntilDue > 0 && daysUntilDue <= 7) {
            thisWeekAlerts.push(alert);
        } else if (daysUntilDue > 7 && daysUntilDue <= 14) {
            nextWeekAlerts.push(alert);
        }
    }

    return {
        today: todayAlerts,
        thisWeek: thisWeekAlerts,
        nextWeek: nextWeekAlerts,
    };
}

// ============================================
// GET ALERT SUMMARY FOR DASHBOARD
// ============================================

export async function getAlertSummary(): Promise<{
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topAlert: Alert | null;
}> {
    const alerts = await getAlerts();

    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
    const infoCount = alerts.filter(a => a.severity === 'INFO' || a.severity === 'SUCCESS').length;
    const topAlert = alerts.length > 0 ? alerts[0] : null;

    return {
        criticalCount,
        warningCount,
        infoCount,
        topAlert,
    };
}

// ============================================
// HELPER
// ============================================

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 0,
    }).format(amount);
}
