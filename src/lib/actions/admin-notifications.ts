'use server';

import { createAdminClient } from '@/lib/supabase/server';
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

// Helper to get untyped DB access (table not in generated types yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getNotificationsTable = (client: any) => client.from('admin_notifications');

// ============================================
// GET NOTIFICATIONS
// ============================================

export async function getUnreadNotifications(): Promise<{
    notifications: AdminNotification[];
    unreadCount: number;
}> {
    const session = await getAdminSession();
    if (!session) return { notifications: [], unreadCount: 0 };

    const adminClient = createAdminClient();

    // Get unread notifications for this admin
    const { data: notifications, count } = await getNotificationsTable(adminClient)
        .select('*', { count: 'exact' })
        .eq('admin_id', session.adminId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10);

    return {
        notifications: (notifications || []) as AdminNotification[],
        unreadCount: count || 0,
    };
}

export async function getAllNotifications(limit: number = 20): Promise<AdminNotification[]> {
    const session = await getAdminSession();
    if (!session) return [];

    const adminClient = createAdminClient();

    // PERF-011: Select specific fields instead of *
    const { data } = await getNotificationsTable(adminClient)
        .select('id, type, title, message, read, admin_id, created_at, metadata')
        .eq('admin_id', session.adminId)
        .order('created_at', { ascending: false })
        .limit(limit);

    return (data || []) as AdminNotification[];
}

// ============================================
// MARK AS READ
// ============================================

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
    const session = await getAdminSession();
    if (!session) return false;

    const adminClient = createAdminClient();

    const { error } = await getNotificationsTable(adminClient)
        .update({ read: true })
        .eq('id', notificationId)
        .eq('admin_id', session.adminId);

    return !error;
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
    const session = await getAdminSession();
    if (!session) return false;

    const adminClient = createAdminClient();

    const { error } = await getNotificationsTable(adminClient)
        .update({ read: true })
        .eq('admin_id', session.adminId)
        .eq('read', false);

    return !error;
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
    const adminClient = createAdminClient();

    const { error } = await getNotificationsTable(adminClient)
        .insert({
            admin_id: adminId,
            type,
            title,
            message: message || null,
            metadata: metadata || {},
        });

    return !error;
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
    const adminClient = createAdminClient();

    // Get all active admins
    const { data: admins } = await adminClient
        .from('admin_users')
        .select('id')
        .eq('is_active', true);

    if (!admins?.length) return;

    // Create notification for each admin
    const notifications = admins.map(admin => ({
        admin_id: admin.id,
        type,
        title,
        message: message || null,
        metadata: metadata || {},
    }));

    await getNotificationsTable(adminClient).insert(notifications);
}

