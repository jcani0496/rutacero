import { redirect } from 'next/navigation';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import { getAllNotifications, getUnreadNotifications } from '@/lib/actions/admin-notifications';
import { syncSupportAlerts } from '@/lib/actions/admin-support';
import { AdminNotificationsClient } from './notifications-client';

export const metadata = {
    title: 'Notificaciones | Admin RutaCero',
};

export default async function AdminNotificationsPage() {
    const session = await getAdminSession();

    if (!session) {
        redirect('/admin/login');
    }

    const canRead = await roleHasPermission(session.role, 'notifications:read');
    if (!canRead) {
        redirect('/admin/dashboard');
    }

    await syncSupportAlerts();

    const [notifications, unreadSnapshot] = await Promise.all([
        getAllNotifications(60),
        getUnreadNotifications(),
    ]);

    return (
        <AdminNotificationsClient
            adminId={session.adminId}
            initialNotifications={notifications}
            initialUnreadCount={unreadSnapshot.unreadCount}
        />
    );
}
