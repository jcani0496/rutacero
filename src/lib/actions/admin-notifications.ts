'use server';

import { and, count, desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@/db/client';
import { getAdminSession } from './admin-auth';

// ============================================
// TYPES
// ============================================

export interface AdminNotification {
    id: string;
    type: 'NEW_USER' | 'NEW_SUBSCRIPTION' | 'SYSTEM_ALERT' | 'EXPORT_COMPLETED';
    title: string;
    message: string | null;
    read: boolean;
    created_at: string;
    metadata: Record<string, unknown>;
}

function mapRow(row: typeof schema.adminNotifications.$inferSelect): AdminNotification {
    return {
        id: row.id,
        type: row.type as AdminNotification['type'],
        title: row.title,
        message: row.message,
        read: Boolean(row.read),
        created_at: row.createdAt?.toISOString() ?? new Date().toISOString(),
        metadata: (row.metadata as Record<string, unknown>) || {},
    };
}

// ============================================
// GET NOTIFICATIONS
// ============================================

export async function getUnreadNotifications(): Promise<{
    notifications: AdminNotification[];
    unreadCount: number;
}> {
    const session = await getAdminSession();
    if (!session) return { notifications: [], unreadCount: 0 };

    const db = getDb();
    const where = and(
        eq(schema.adminNotifications.adminId, session.adminId),
        eq(schema.adminNotifications.read, false),
    );

    const [rows, [total]] = await Promise.all([
        db
            .select()
            .from(schema.adminNotifications)
            .where(where)
            .orderBy(desc(schema.adminNotifications.createdAt))
            .limit(10),
        db.select({ value: count() }).from(schema.adminNotifications).where(where),
    ]);

    return {
        notifications: rows.map(mapRow),
        unreadCount: total?.value ?? 0,
    };
}

export async function getAllNotifications(limit: number = 20): Promise<AdminNotification[]> {
    const session = await getAdminSession();
    if (!session) return [];

    const db = getDb();
    const rows = await db
        .select()
        .from(schema.adminNotifications)
        .where(eq(schema.adminNotifications.adminId, session.adminId))
        .orderBy(desc(schema.adminNotifications.createdAt))
        .limit(limit);

    return rows.map(mapRow);
}

// ============================================
// MARK AS READ
// ============================================

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
    const session = await getAdminSession();
    if (!session) return false;

    const db = getDb();
    try {
        await db
            .update(schema.adminNotifications)
            .set({ read: true })
            .where(
                and(
                    eq(schema.adminNotifications.id, notificationId),
                    eq(schema.adminNotifications.adminId, session.adminId),
                ),
            );
        return true;
    } catch {
        return false;
    }
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
    const session = await getAdminSession();
    if (!session) return false;

    const db = getDb();
    try {
        await db
            .update(schema.adminNotifications)
            .set({ read: true })
            .where(
                and(
                    eq(schema.adminNotifications.adminId, session.adminId),
                    eq(schema.adminNotifications.read, false),
                ),
            );
        return true;
    } catch {
        return false;
    }
}

// ============================================
// CREATE NOTIFICATION (for internal use)
// ============================================

export async function createNotification(
    adminId: string,
    type: AdminNotification['type'],
    title: string,
    message?: string,
    metadata?: Record<string, unknown>
): Promise<boolean> {
    const db = getDb();
    try {
        await db.insert(schema.adminNotifications).values({
            adminId,
            type,
            title,
            message: message || null,
            metadata: metadata || {},
        });
        return true;
    } catch {
        return false;
    }
}

// ============================================
// NOTIFY ALL ADMINS
// ============================================

export async function notifyAllAdmins(
    type: AdminNotification['type'],
    title: string,
    message?: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    const db = getDb();
    const admins = await db
        .select({ id: schema.adminUsers.id })
        .from(schema.adminUsers)
        .where(eq(schema.adminUsers.isActive, true));

    if (!admins.length) return;

    await db.insert(schema.adminNotifications).values(
        admins.map((admin) => ({
            adminId: admin.id,
            type,
            title,
            message: message || null,
            metadata: metadata || {},
        })),
    );
}
