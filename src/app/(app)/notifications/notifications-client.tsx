'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    ArrowClockwise,
    Bell,
    Calendar,
    Check,
    Sparkle,
    Trophy,
    WarningCircle
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { UserNotification, UserNotificationSeverity, UserNotificationType } from '@/lib/actions/user-notifications';
import { USER_NOTIFICATION_POLL_MS } from '@/components/notifications/user-notification-bell';

interface NotificationsClientProps {
    userId: string;
    initialNotifications: UserNotification[];
    initialUnreadCount: number;
}

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

type TypeFilter = 'ALL' | UserNotificationType;

const TYPE_LABELS: Record<UserNotificationType, string> = {
    PAYMENT_REMINDER: 'Recordatorio de pago',
    PAYMENT_DUE: 'Pago vence hoy',
    OVERDUE: 'Pago vencido',
    MILESTONE: 'Hito alcanzado',
    PLAN_NUDGE: 'Sugerencia de plan',
    SYSTEM: 'Sistema',
};

const TYPE_ICONS: Record<UserNotificationType, React.ReactNode> = {
    PAYMENT_REMINDER: <Calendar className="h-4 w-4" />,
    PAYMENT_DUE: <WarningCircle className="h-4 w-4" />,
    OVERDUE: <WarningCircle className="h-4 w-4" />,
    MILESTONE: <Trophy className="h-4 w-4" />,
    PLAN_NUDGE: <Sparkle className="h-4 w-4" />,
    SYSTEM: <Bell className="h-4 w-4" />,
};

const TYPE_STYLES: Record<UserNotificationType, string> = {
    PAYMENT_REMINDER: 'bg-primary/10 text-primary',
    PAYMENT_DUE: 'bg-destructive/10 text-destructive',
    OVERDUE: 'bg-destructive/10 text-destructive',
    MILESTONE: 'bg-success/10 text-success',
    PLAN_NUDGE: 'bg-warning/10 text-warning',
    SYSTEM: 'bg-muted text-muted-foreground',
};

const severityVariant = (severity: UserNotificationSeverity) => {
    switch (severity) {
        case 'SUCCESS':
            return 'success';
        case 'WARNING':
            return 'warning';
        case 'CRITICAL':
            return 'destructive';
        default:
            return 'secondary';
    }
};

const formatRelative = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.round(diffHours / 24);
    return `Hace ${diffDays} d`;
};

export function NotificationsClient({
    userId,
    initialNotifications,
    initialUnreadCount,
}: NotificationsClientProps) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();

    const stats = useMemo(() => {
        const unread = notifications.filter((notification) => !notification.read).length;
        const reminders = notifications.filter((notification) =>
            ['PAYMENT_REMINDER', 'PAYMENT_DUE', 'OVERDUE'].includes(notification.type)
        ).length;
        const milestones = notifications.filter((notification) => notification.type === 'MILESTONE').length;
        return { unread, reminders, milestones };
    }, [notifications]);

    const filteredNotifications = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        return notifications.filter((notification) => {
            if (readFilter === 'UNREAD' && notification.read) return false;
            if (readFilter === 'READ' && !notification.read) return false;
            if (typeFilter !== 'ALL' && notification.type !== typeFilter) return false;
            if (!searchLower) return true;
            const haystack = `${notification.title} ${notification.message || ''}`.toLowerCase();
            return haystack.includes(searchLower);
        });
    }, [notifications, readFilter, typeFilter, search]);

    const refreshNotifications = () => {
        startTransition(async () => {
            const { getUserNotifications, getUnreadUserNotifications } = await import('@/lib/actions/user-notifications');
            const [allNotifications, unreadSnapshot] = await Promise.all([
                getUserNotifications(60),
                getUnreadUserNotifications(),
            ]);
            setNotifications(allNotifications);
            setUnreadCount(unreadSnapshot.unreadCount);
        });
    };

    const handleMarkAsRead = (notificationId: string) => {
        startTransition(async () => {
            const { markUserNotificationAsRead } = await import('@/lib/actions/user-notifications');
            const success = await markUserNotificationAsRead(notificationId);
            if (success) {
                setNotifications((current) =>
                    current.map((notification) =>
                        notification.id === notificationId
                            ? { ...notification, read: true }
                            : notification
                    )
                );
                setUnreadCount((current) => Math.max(0, current - 1));
            }
        });
    };

    const handleMarkAll = () => {
        startTransition(async () => {
            const { markAllUserNotificationsAsRead } = await import('@/lib/actions/user-notifications');
            const success = await markAllUserNotificationsAsRead();
            if (success) {
                setNotifications((current) =>
                    current.map((notification) => ({ ...notification, read: true }))
                );
                setUnreadCount(0);
            }
        });
    };

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        const poll = () => {
            startTransition(async () => {
                const { getUserNotifications, getUnreadUserNotifications } = await import(
                    '@/lib/actions/user-notifications'
                );
                const [allNotifications, unreadSnapshot] = await Promise.all([
                    getUserNotifications(60),
                    getUnreadUserNotifications(),
                ]);
                if (cancelled) return;
                setNotifications(allNotifications);
                setUnreadCount(unreadSnapshot.unreadCount);
            });
        };

        poll();
        const interval = setInterval(poll, USER_NOTIFICATION_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [userId]);

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Notificaciones</h1>
                    <p className="text-muted-foreground">
                        Mantenete al tanto de pagos, hitos y recomendaciones.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={refreshNotifications} disabled={isPending}>
                        <ArrowClockwise className="mr-2 h-4 w-4" />
                        Actualizar
                    </Button>
                    {unreadCount > 0 && (
                        <Button onClick={handleMarkAll} disabled={isPending}>
                            <Check className="mr-2 h-4 w-4" />
                            Marcar todo
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Bell className="h-4 w-4 text-primary" />
                            No leidas
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{unreadCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4 text-warning" />
                            Pagos en seguimiento
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.reminders}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Trophy className="h-4 w-4 text-success" />
                            Hitos recientes
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.milestones}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Historial de notificaciones</CardTitle>
                        <CardDescription>
                            Revisa alertas anteriores y su estado.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Tabs value={readFilter} onValueChange={(value) => setReadFilter(value as ReadFilter)}>
                            <TabsList>
                                <TabsTrigger value="ALL">Todas</TabsTrigger>
                                <TabsTrigger value="UNREAD">No leidas</TabsTrigger>
                                <TabsTrigger value="READ">Leidas</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos los tipos</SelectItem>
                                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Buscar notificacion"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="sm:max-w-[220px]"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {filteredNotifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No hay notificaciones para mostrar.
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className="rounded-xl border border-border bg-background/40 p-4 transition-colors"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TYPE_STYLES[notification.type]}`}>
                                            {TYPE_ICONS[notification.type]}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold">{notification.title}</p>
                                                {!notification.read && (
                                                    <Badge variant="active" dot>
                                                        Nuevo
                                                    </Badge>
                                                )}
                                            </div>
                                            {notification.message && (
                                                <p className="text-sm text-muted-foreground">
                                                    {notification.message}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {formatRelative(notification.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                        <Badge variant={severityVariant(notification.severity)}>
                                            {notification.severity}
                                        </Badge>
                                        <Badge variant="outline">{TYPE_LABELS[notification.type]}</Badge>
                                        {!notification.read && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                disabled={isPending}
                                            >
                                                Marcar leida
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
