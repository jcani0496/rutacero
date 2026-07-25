import { redirect } from 'next/navigation';
import { getAppUser } from '@/lib/auth/session';
import { getUnreadUserNotifications, getUserNotifications } from '@/lib/actions/user-notifications';
import { NotificationsClient } from './notifications-client';

export const metadata = {
    title: 'Notificaciones | RutaCero',
    description: 'Alertas y recordatorios para tu progreso financiero.',
};

export default async function NotificationsPage() {
    const user = await getAppUser();

    if (!user) {
        redirect('/login');
    }

    const [notifications, unreadSnapshot] = await Promise.all([
        getUserNotifications(60),
        getUnreadUserNotifications(),
    ]);

    return (
        <NotificationsClient
            userId={user.id}
            initialNotifications={notifications}
            initialUnreadCount={unreadSnapshot.unreadCount}
        />
    );
}
