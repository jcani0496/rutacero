'use server';

import type { Debt } from '@/types';
import { requireUserTenant } from '@/lib/tenant/server';
import {
    getAlertsFor,
    getAlertSummaryFor,
    type Alert,
    type AlertSummary,
} from '@/lib/alerts/summary';

// NOTE: Re-exporting types from a `'use server'` module breaks Next's
// build-time server-action validator (it treats every export as a candidate
// action and fails because types aren't async functions). Consumers that
// need these types should `import type` directly from `@/lib/alerts/summary`.

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

    return getAlertsFor({ supabase, tenantId, userId: user.id });
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
//
// Thin wrapper around `getAlertSummaryFor` for callers that don't already
// have a resolved tenant context. Server components that already called
// `requireUserTenant()` should call `getAlertSummaryFor` directly to avoid
// a duplicate `supabase.auth.getUser()` round-trip per render.

export async function getAlertSummary(): Promise<AlertSummary> {
    const { supabase, user, tenantId } = await requireUserTenant();
    return getAlertSummaryFor({ supabase, tenantId, userId: user.id });
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
