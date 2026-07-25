'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Bell, Check, User, AlertCircle, Download, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminNotification } from '@/lib/actions/admin-notifications';

/** Poll interval for unread badge refresh (replaces Supabase realtime). */
export const ADMIN_NOTIFICATION_POLL_MS = 30_000;

interface NotificationBellProps {
    initialNotifications?: AdminNotification[];
    initialUnreadCount?: number;
}

const typeIcons: Record<AdminNotification['type'], React.ReactNode> = {
    NEW_USER: <User className="h-4 w-4 text-primary" />,
    NEW_SUBSCRIPTION: <CreditCard className="h-4 w-4 text-success" />,
    SYSTEM_ALERT: <AlertCircle className="h-4 w-4 text-warning" />,
    EXPORT_COMPLETED: <Download className="h-4 w-4 text-chart-2" />,
};

export const getNotificationTriggerLabel = (unreadCount: number) => {
    if (unreadCount < 1) return 'Abrir notificaciones del panel de administracion';
    if (unreadCount > 9) return 'Abrir notificaciones del panel de administracion: 9 o mas sin leer';
    return `Abrir notificaciones del panel de administracion: ${unreadCount} sin leer`;
};

export function NotificationBell({
    initialNotifications = [],
    initialUnreadCount = 0
}: NotificationBellProps) {
    const [mounted, setMounted] = useState(false);
    const [notifications, setNotifications] = useState(initialNotifications);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const triggerLabel = getNotificationTriggerLabel(unreadCount);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const refreshNotifications = async () => {
            const { getUnreadNotifications } = await import('@/lib/actions/admin-notifications');
            const data = await getUnreadNotifications();
            if (cancelled) return;
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        };

        void refreshNotifications();
        const interval = setInterval(refreshNotifications, ADMIN_NOTIFICATION_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const handleMarkAsRead = async (notificationId: string) => {
        startTransition(async () => {
            const { markNotificationAsRead } = await import('@/lib/actions/admin-notifications');
            const success = await markNotificationAsRead(notificationId);
            if (success) {
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        });
    };

    const handleMarkAllAsRead = async () => {
        startTransition(async () => {
            const { markAllNotificationsAsRead } = await import('@/lib/actions/admin-notifications');
            const success = await markAllNotificationsAsRead();
            if (success) {
                setNotifications([]);
                setUnreadCount(0);
            }
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        return `Hace ${diffDays}d`;
    };

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="relative" aria-label={triggerLabel} disabled>
                <Bell className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={triggerLabel}>
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notificaciones</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto text-xs py-1"
                            onClick={handleMarkAllAsRead}
                            disabled={isPending}
                        >
                            <Check className="h-3 w-3 mr-1" />
                            Marcar todo
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {notifications.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        No hay notificaciones nuevas
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <DropdownMenuItem
                            key={notification.id}
                            className="flex items-start gap-3 p-3 cursor-pointer"
                            onClick={() => handleMarkAsRead(notification.id)}
                        >
                            <div className="shrink-0 mt-0.5">
                                {typeIcons[notification.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{notification.title}</p>
                                {notification.message && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        {notification.message}
                                    </p>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {formatTime(notification.created_at)}
                                </p>
                            </div>
                        </DropdownMenuItem>
                    ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/admin/notifications" className="text-xs text-muted-foreground">
                        Ver todas las notificaciones
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
