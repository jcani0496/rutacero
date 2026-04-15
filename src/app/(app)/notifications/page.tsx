import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUnreadUserNotifications, getUserNotifications } from '@/lib/actions/user-notifications';
import { NotificationsClient } from './notifications-client';

export const metadata = {
    title: 'Notificaciones | RutaCero',
    description: 'Alertas y recordatorios para tu progreso financiero.',
};

export default async function NotificationsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
