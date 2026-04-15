'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    AlertCircle,
    Bell,
    Check,
    CreditCard,
    Download,
    RefreshCw,
    User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AdminNotification } from '@/lib/actions/admin-notifications';

interface AdminNotificationsClientProps {
    adminId: string;
    initialNotifications: AdminNotification[];
    initialUnreadCount: number;
}

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

type TypeFilter = 'ALL' | AdminNotification['type'];

const TYPE_LABELS: Record<AdminNotification['type'], string> = {
    NEW_USER: 'Nuevo usuario',
    NEW_SUBSCRIPTION: 'Nueva suscripcion',
    SYSTEM_ALERT: 'Alerta del sistema',
    EXPORT_COMPLETED: 'Exportacion lista',
};

const TYPE_ICONS: Record<AdminNotification['type'], React.ReactNode> = {
    NEW_USER: <User className="h-4 w-4" />,
    NEW_SUBSCRIPTION: <CreditCard className="h-4 w-4" />,
    SYSTEM_ALERT: <AlertCircle className="h-4 w-4" />,
    EXPORT_COMPLETED: <Download className="h-4 w-4" />,
};

const TYPE_STYLES: Record<AdminNotification['type'], string> = {
    NEW_USER: 'bg-primary/10 text-primary',
    NEW_SUBSCRIPTION: 'bg-success/10 text-success',
    SYSTEM_ALERT: 'bg-warning/10 text-warning',
    EXPORT_COMPLETED: 'bg-secondary text-secondary-foreground',
};

const typeBadgeVariant = (type: AdminNotification['type']) => {
    switch (type) {
        case 'NEW_SUBSCRIPTION':
            return 'success';
        case 'SYSTEM_ALERT':
            return 'warning';
        case 'EXPORT_COMPLETED':
            return 'secondary';
        default:
            return 'active';
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

export function AdminNotificationsClient({
    adminId,
    initialNotifications,
    initialUnreadCount,
}: AdminNotificationsClientProps) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const supabase = useMemo(() => createClient(), []);

    const stats = useMemo(() => {
        const unread = notifications.filter((notification) => !notification.read).length;
        const alerts = notifications.filter((notification) => notification.type === 'SYSTEM_ALERT').length;
        const newUsers = notifications.filter((notification) => notification.type === 'NEW_USER').length;
        return { unread, alerts, newUsers };
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
            const { getAllNotifications, getUnreadNotifications } = await import('@/lib/actions/admin-notifications');
            const [allNotifications, unreadSnapshot] = await Promise.all([
                getAllNotifications(60),
                getUnreadNotifications(),
            ]);
            setNotifications(allNotifications);
            setUnreadCount(unreadSnapshot.unreadCount);
        });
    };

    const handleMarkAsRead = (notificationId: string) => {
        startTransition(async () => {
            const { markNotificationAsRead } = await import('@/lib/actions/admin-notifications');
            const success = await markNotificationAsRead(notificationId);
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
            const { markAllNotificationsAsRead } = await import('@/lib/actions/admin-notifications');
            const success = await markAllNotificationsAsRead();
            if (success) {
                setNotifications((current) =>
                    current.map((notification) => ({ ...notification, read: true }))
                );
                setUnreadCount(0);
            }
        });
    };

    useEffect(() => {
        if (!adminId) return;

        const channel = supabase
            .channel(`admin-notifications-feed:${adminId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'admin_notifications',
                    filter: `admin_id=eq.${adminId}`,
                },
                (payload) => {
                    const notification = payload.new as AdminNotification;
                    setNotifications((prev) => {
                        if (prev.find((item) => item.id === notification.id)) return prev;
                        return [notification, ...prev].slice(0, 60);
                    });
                    if (!notification.read) {
                        setUnreadCount((prev) => prev + 1);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'admin_notifications',
                    filter: `admin_id=eq.${adminId}`,
                },
                (payload) => {
                    const notification = payload.new as AdminNotification;
                    const previous = payload.old as AdminNotification | undefined;
                    setNotifications((prev) =>
                        prev.map((item) => (item.id === notification.id ? notification : item))
                    );
                    if (notification.read && !previous?.read) {
                        setUnreadCount((prev) => Math.max(0, prev - 1));
                    } else if (!notification.read && previous?.read) {
                        setUnreadCount((prev) => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [adminId, supabase]);

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Notificaciones</h1>
                    <p className="text-muted-foreground">
                        Alertas del sistema, soporte y cambios relevantes.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={refreshNotifications} disabled={isPending}>
                        <RefreshCw className="mr-2 h-4 w-4" />
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
                            <AlertCircle className="h-4 w-4 text-warning" />
                            Alertas activas
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.alerts}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4 text-primary" />
                            Nuevos usuarios
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.newUsers}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Historial de notificaciones</CardTitle>
                        <CardDescription>
                            Filtra y revisa eventos recientes del panel.
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
                            <SelectTrigger className="w-[220px]">
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
                                        <Badge variant={typeBadgeVariant(notification.type)}>
                                            {TYPE_LABELS[notification.type]}
                                        </Badge>
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
