'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  WarningCircle,
  Calendar,
  Trophy,
} from '@phosphor-icons/react';
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
import type { UserNotification, UserNotificationType } from '@/lib/actions/user-notifications';
import { ICON } from '@/components/icons/phosphor';

export const USER_NOTIFICATION_POLL_MS = 30_000;

interface UserNotificationBellProps {
    initialNotifications?: UserNotification[];
    initialUnreadCount?: number;
}

const typeIcons: Record<UserNotificationType, React.ReactNode> = {
    PAYMENT_REMINDER: <Calendar {...ICON} className="h-4 w-4 text-primary" />,
    PAYMENT_DUE: <WarningCircle {...ICON} className="h-4 w-4 text-destructive" />,
    OVERDUE: <WarningCircle {...ICON} className="h-4 w-4 text-destructive" />,
    MILESTONE: <Trophy {...ICON} className="h-4 w-4 text-emerald-500" />,
    PLAN_NUDGE: <Bell {...ICON} className="h-4 w-4 text-warning" />,
    SYSTEM: <Bell {...ICON} className="h-4 w-4 text-muted-foreground" />,
};

export const getNotificationTriggerLabel = (unreadCount: number) => {
    if (unreadCount < 1) return 'Abrir notificaciones';
    if (unreadCount > 9) return 'Abrir notificaciones: 9 o mas sin leer';
    return `Abrir notificaciones: ${unreadCount} sin leer`;
};

export function UserNotificationBell({
    initialNotifications = [],
    initialUnreadCount = 0,
}: UserNotificationBellProps) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const triggerLabel = getNotificationTriggerLabel(unreadCount);

    useEffect(() => {
        let cancelled = false;

        const refreshNotifications = async () => {
            const { getUnreadUserNotifications } = await import('@/lib/actions/user-notifications');
            const data = await getUnreadUserNotifications();
            if (cancelled) return;
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        };

        void refreshNotifications();
        const interval = setInterval(refreshNotifications, USER_NOTIFICATION_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const handleMarkAsRead = async (notificationId: string) => {
        startTransition(async () => {
            const { markUserNotificationAsRead } = await import('@/lib/actions/user-notifications');
            const success = await markUserNotificationAsRead(notificationId);
            if (success) {
                setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        });
    };

    const handleMarkAllAsRead = async () => {
        startTransition(async () => {
            const { markAllUserNotificationsAsRead } = await import('@/lib/actions/user-notifications');
            const success = await markAllUserNotificationsAsRead();
            if (success) {
                setNotifications([]);
                setUnreadCount(0);
            }
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const diffMs = Date.now() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        return `Hace ${diffDays}d`;
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={triggerLabel}>
                    <Bell {...ICON} className="h-5 w-5" />
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
                            <Check {...ICON} className="h-3 w-3 mr-1" />
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
                    <Link href="/notifications" className="text-xs text-muted-foreground">
                        Ver todas las notificaciones
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
