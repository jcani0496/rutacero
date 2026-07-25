'use server';

import { and, count, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { debts, userNotifications } from '@/db/schema';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    mapUserNotificationRow,
    type UserNotificationMapped,
} from '@/lib/data/mappers';
import { createAdminClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';
import { requireUserTenant } from '@/lib/tenant/server';

export type UserNotificationType =
    | 'PAYMENT_REMINDER'
    | 'PAYMENT_DUE'
    | 'OVERDUE'
    | 'MILESTONE'
    | 'PLAN_NUDGE'
    | 'SYSTEM';

export type UserNotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export type UserNotification = UserNotificationMapped;

const NOTIFICATION_LOOKBACK_HOURS = 24;
const OVERDUE_WINDOW_DAYS = 3;
const REMINDER_DAYS = [7, 3, 1];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getNotificationsTable = (client: any) => client.from('user_notifications');

const toMetadata = (data: Record<string, unknown>): Json => {
    return data as Json;
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
};

const calculateDaysUntilDue = (dueDay: number, now: Date) => {
    const todayDay = now.getDate();
    let daysUntilDue = dueDay - todayDay;
    if (daysUntilDue < -15) {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysUntilDue = (daysInMonth - todayDay) + dueDay;
    }
    return daysUntilDue;
};

type SyncDebt = {
    id: string;
    creditor: string;
    balance: number;
    currency: string;
    min_payment: number;
    due_date: number | null;
};

function buildNotificationInserts(
    debtsList: SyncDebt[],
    tenantId: string,
    userId: string,
    existingKeys: Set<string>,
    now: Date,
): Array<Record<string, unknown>> {
    const inserts: Array<Record<string, unknown>> = [];

    debtsList.forEach((debt) => {
        const dueDay = debt.due_date;
        if (dueDay === null) return;

        const daysUntilDue = calculateDaysUntilDue(dueDay, now);
        const minPayment = Number(debt.min_payment || 0);
        const balance = Number(debt.balance || 0);
        const currency = debt.currency || 'GTQ';

        if (REMINDER_DAYS.includes(daysUntilDue)) {
            const severity: UserNotificationSeverity = daysUntilDue === 1 ? 'WARNING' : 'INFO';
            const key = `reminder:${debt.id}:${daysUntilDue}`;
            if (!existingKeys.has(key)) {
                inserts.push({
                    tenant_id: tenantId,
                    user_id: userId,
                    type: 'PAYMENT_REMINDER',
                    severity,
                    title: 'Pago próximo',
                    message: `${debt.creditor} vence en ${daysUntilDue} día${daysUntilDue === 1 ? '' : 's'}.`,
                    metadata: toMetadata({
                        notification_key: key,
                        debt_id: debt.id,
                        days_until_due: daysUntilDue,
                    }),
                });
                existingKeys.add(key);
            }
        }

        if (daysUntilDue === 0) {
            const key = `due:${debt.id}`;
            if (!existingKeys.has(key)) {
                inserts.push({
                    tenant_id: tenantId,
                    user_id: userId,
                    type: 'PAYMENT_DUE',
                    severity: 'CRITICAL',
                    title: 'Pago vence hoy',
                    message: `Hoy vence tu pago de ${debt.creditor} (${formatCurrency(minPayment, currency)}).`,
                    metadata: toMetadata({
                        notification_key: key,
                        debt_id: debt.id,
                        due_day: dueDay,
                    }),
                });
                existingKeys.add(key);
            }
        }

        if (daysUntilDue < 0 && daysUntilDue >= -OVERDUE_WINDOW_DAYS) {
            const key = `overdue:${debt.id}:${Math.abs(daysUntilDue)}`;
            if (!existingKeys.has(key)) {
                inserts.push({
                    tenant_id: tenantId,
                    user_id: userId,
                    type: 'OVERDUE',
                    severity: 'CRITICAL',
                    title: 'Pago vencido',
                    message: `${debt.creditor} está vencido por ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) === 1 ? '' : 's'}.`,
                    metadata: toMetadata({
                        notification_key: key,
                        debt_id: debt.id,
                        days_overdue: Math.abs(daysUntilDue),
                    }),
                });
                existingKeys.add(key);
            }
        }

        if (balance > 0 && minPayment > 0 && balance <= minPayment * 2) {
            const key = `milestone:low-balance:${debt.id}`;
            if (!existingKeys.has(key)) {
                inserts.push({
                    tenant_id: tenantId,
                    user_id: userId,
                    type: 'MILESTONE',
                    severity: 'SUCCESS',
                    title: '¡Casi libre!',
                    message: `Te faltan ${formatCurrency(balance, currency)} para liquidar ${debt.creditor}.`,
                    metadata: toMetadata({
                        notification_key: key,
                        debt_id: debt.id,
                    }),
                });
                existingKeys.add(key);
            }
        }
    });

    return inserts;
}

export async function getUnreadUserNotifications(): Promise<{
    notifications: UserNotification[];
    unreadCount: number;
}> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const where = and(
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, user.id),
            eq(userNotifications.read, false),
        );
        const [rows, [totalRow]] = await Promise.all([
            db
                .select({
                    id: userNotifications.id,
                    type: userNotifications.type,
                    severity: userNotifications.severity,
                    title: userNotifications.title,
                    message: userNotifications.message,
                    read: userNotifications.read,
                    createdAt: userNotifications.createdAt,
                    metadata: userNotifications.metadata,
                })
                .from(userNotifications)
                .where(where)
                .orderBy(desc(userNotifications.createdAt))
                .limit(10),
            db.select({ value: count() }).from(userNotifications).where(where),
        ]);

        return {
            notifications: rows.map(mapUserNotificationRow),
            unreadCount: totalRow?.value ?? 0,
        };
    }

    const { data: notifications, count: unreadCount } = await getNotificationsTable(supabase)
        .select('id, type, severity, title, message, read, created_at, metadata', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10);

    return {
        notifications: (notifications || []) as UserNotification[],
        unreadCount: unreadCount || 0,
    };
}

export async function getUserNotifications(limit: number = 30): Promise<UserNotification[]> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .select({
                id: userNotifications.id,
                type: userNotifications.type,
                severity: userNotifications.severity,
                title: userNotifications.title,
                message: userNotifications.message,
                read: userNotifications.read,
                createdAt: userNotifications.createdAt,
                metadata: userNotifications.metadata,
            })
            .from(userNotifications)
            .where(
                and(
                    eq(userNotifications.tenantId, tenantId),
                    eq(userNotifications.userId, user.id),
                ),
            )
            .orderBy(desc(userNotifications.createdAt))
            .limit(limit);

        return rows.map(mapUserNotificationRow);
    }

    const { data } = await getNotificationsTable(supabase)
        .select('id, type, severity, title, message, read, created_at, metadata')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    return (data || []) as UserNotification[];
}

export async function markUserNotificationAsRead(notificationId: string): Promise<boolean> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        const updated = await db
            .update(userNotifications)
            .set({ read: true })
            .where(
                and(
                    eq(userNotifications.id, notificationId),
                    eq(userNotifications.tenantId, tenantId),
                    eq(userNotifications.userId, user.id),
                ),
            )
            .returning({ id: userNotifications.id });
        return updated.length > 0;
    }

    const { error } = await getNotificationsTable(supabase)
        .update({ read: true })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    return !error;
}

export async function markAllUserNotificationsAsRead(): Promise<boolean> {
    const { supabase, user, tenantId } = await requireUserTenant();

    if (isDrizzleEnabled()) {
        const db = getDb();
        await db
            .update(userNotifications)
            .set({ read: true })
            .where(
                and(
                    eq(userNotifications.tenantId, tenantId),
                    eq(userNotifications.userId, user.id),
                    eq(userNotifications.read, false),
                ),
            );
        return true;
    }

    const { error } = await getNotificationsTable(supabase)
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('read', false);

    return !error;
}

export async function getUserNotificationSnapshot(userId: string, tenantId: string, limit: number = 8): Promise<{
    notifications: UserNotification[];
    unreadCount: number;
}> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const scope = and(
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
        );
        const [rows, [totalRow]] = await Promise.all([
            db
                .select({
                    id: userNotifications.id,
                    type: userNotifications.type,
                    severity: userNotifications.severity,
                    title: userNotifications.title,
                    message: userNotifications.message,
                    read: userNotifications.read,
                    createdAt: userNotifications.createdAt,
                    metadata: userNotifications.metadata,
                })
                .from(userNotifications)
                .where(scope)
                .orderBy(desc(userNotifications.createdAt))
                .limit(limit),
            db
                .select({ value: count() })
                .from(userNotifications)
                .where(and(scope, eq(userNotifications.read, false))),
        ]);

        return {
            notifications: rows.map(mapUserNotificationRow),
            unreadCount: totalRow?.value ?? 0,
        };
    }

    const adminClient = createAdminClient();
    const table = getNotificationsTable(adminClient);

    const { data: notifications } = await table
        .select('id, type, severity, title, message, read, created_at, metadata')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    const { count: unreadCount } = await table
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('read', false);

    return {
        notifications: (notifications || []) as UserNotification[],
        unreadCount: unreadCount || 0,
    };
}

export async function syncUserNotificationsForUser(userId: string, tenantId: string): Promise<{ created: number }> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const debtRows = await db
            .select({
                id: debts.id,
                creditor: debts.creditor,
                balance: debts.balance,
                currency: debts.currency,
                minPayment: debts.minPayment,
                dueDate: debts.dueDate,
            })
            .from(debts)
            .where(
                and(
                    eq(debts.tenantId, tenantId),
                    eq(debts.userId, userId),
                    eq(debts.status, 'ACTIVE'),
                ),
            );

        if (debtRows.length === 0) {
            return { created: 0 };
        }

        const since = new Date(Date.now() - NOTIFICATION_LOOKBACK_HOURS * 60 * 60 * 1000);
        const recentNotifications = await db
            .select({ metadata: userNotifications.metadata })
            .from(userNotifications)
            .where(
                and(
                    eq(userNotifications.tenantId, tenantId),
                    eq(userNotifications.userId, userId),
                    gte(userNotifications.createdAt, since),
                ),
            );

        const existingKeys = new Set<string>();
        recentNotifications.forEach((notification) => {
            const metadata =
                notification.metadata &&
                typeof notification.metadata === 'object' &&
                !Array.isArray(notification.metadata)
                    ? (notification.metadata as Record<string, unknown>)
                    : {};
            const key = typeof metadata.notification_key === 'string' ? metadata.notification_key : null;
            if (key) {
                existingKeys.add(key);
            }
        });

        const inserts = buildNotificationInserts(
            debtRows.map((debt) => ({
                id: debt.id,
                creditor: debt.creditor,
                balance: Number(debt.balance || 0),
                currency: debt.currency || 'GTQ',
                min_payment: Number(debt.minPayment || 0),
                due_date: debt.dueDate,
            })),
            tenantId,
            userId,
            existingKeys,
            new Date(),
        );

        if (inserts.length === 0) {
            return { created: 0 };
        }

        try {
            await db.insert(userNotifications).values(
                inserts.map((row) => ({
                    tenantId: String(row.tenant_id),
                    userId: String(row.user_id),
                    type: String(row.type),
                    severity: String(row.severity),
                    title: String(row.title),
                    message: (row.message as string | null) ?? null,
                    metadata: (row.metadata as Record<string, unknown>) ?? {},
                })),
            );
            return { created: inserts.length };
        } catch (err) {
            console.error('Error inserting user notifications:', err);
            return { created: 0 };
        }
    }

    const adminClient = createAdminClient();

    const { data: debtsData, error: debtError } = await adminClient
        .from('debts')
        .select('id, user_id, creditor, balance, currency, min_payment, due_date, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('status', 'ACTIVE');

    if (debtError) {
        console.error('Error fetching debts for notifications:', debtError?.message || debtError);
        return { created: 0 };
    }

    if (!debtsData || debtsData.length === 0) {
        return { created: 0 };
    }

    const since = new Date(Date.now() - NOTIFICATION_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await getNotificationsTable(adminClient)
        .select('id, metadata')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .gte('created_at', since);

    const existingKeys = new Set<string>();
    (recentNotifications || []).forEach((notification: { metadata: Record<string, unknown> | null }) => {
        const metadata = notification.metadata || {};
        const key = typeof metadata.notification_key === 'string' ? metadata.notification_key : null;
        if (key) {
            existingKeys.add(key);
        }
    });

    const inserts = buildNotificationInserts(
        (debtsData as Array<Database['public']['Tables']['debts']['Row']>).map((debt) => ({
            id: debt.id,
            creditor: debt.creditor,
            balance: Number(debt.balance || 0),
            currency: debt.currency || 'GTQ',
            min_payment: Number(debt.min_payment || 0),
            due_date: debt.due_date,
        })),
        tenantId,
        userId,
        existingKeys,
        new Date(),
    );

    if (inserts.length === 0) {
        return { created: 0 };
    }

    const { error: insertError } = await getNotificationsTable(adminClient).insert(inserts);
    if (insertError) {
        console.error('Error inserting user notifications:', insertError?.message || insertError);
        return { created: 0 };
    }

    return { created: inserts.length };
}
