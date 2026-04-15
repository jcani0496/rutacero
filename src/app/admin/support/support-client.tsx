'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    Clock,
    Loader2,
    Lock,
    MessageSquare,
    Search,
    User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import {
    assignAdminTicket,
    bulkUpdateTickets,
    createAdminSavedView,
    deleteAdminSavedView,
    updateAdminTicketPriority,
    updateAdminTicketStatus,
} from '@/lib/actions/admin-support';
import { getSlaState, type SlaState } from '@/lib/support/sla';
import type {
    AdminAssignee,
    AdminTicket,
    AdminSavedView,
    SavedViewFilters,
    TicketMessageStats,
    TicketPriority,
    TicketStatus,
} from '@/lib/actions/admin-support';
import { SupportNav } from './support-nav';

interface AdminSupportClientProps {
    tickets: AdminTicket[];
    messageStats: Record<string, TicketMessageStats>;
    adminId: string;
    assignees: AdminAssignee[];
    canAssign: boolean;
    canManageTemplates: boolean;
    savedViews: AdminSavedView[];
    showSlaTab: boolean;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
    OPEN: 'Abierto',
    IN_PROGRESS: 'En progreso',
    WAITING_USER: 'Esperando usuario',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
};

type QueueFilter = 'ALL' | 'UNASSIGNED' | 'SLA_OVERDUE' | 'WAITING_USER';

const statusVariant = (status: TicketStatus) => {
    switch (status) {
        case 'OPEN':
            return 'warning';
        case 'IN_PROGRESS':
            return 'active';
        case 'WAITING_USER':
            return 'secondary';
        case 'RESOLVED':
            return 'success';
        case 'CLOSED':
            return 'inactive';
        default:
            return 'outline';
    }
};

const priorityVariant = (priority: TicketPriority) => {
    switch (priority) {
        case 'URGENT':
            return 'destructive';
        case 'HIGH':
            return 'warning';
        case 'MEDIUM':
            return 'secondary';
        case 'LOW':
            return 'outline';
        default:
            return 'outline';
    }
};

export function AdminSupportClient({
    tickets,
    messageStats,
    adminId,
    assignees,
    canAssign,
    canManageTemplates,
    savedViews,
    showSlaTab,
}: AdminSupportClientProps) {
    const [search, setSearch] = useState('');
    const [ticketState, setTicketState] = useState(tickets);
    const [pending, setPending] = useState<{ id: string; field: 'status' | 'priority' | 'assignee' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<'NONE' | TicketStatus>('NONE');
    const [bulkPriority, setBulkPriority] = useState<'NONE' | TicketPriority>('NONE');
    const [bulkAssignee, setBulkAssignee] = useState<'NONE' | 'ME' | 'UNASSIGNED' | string>('NONE');
    const [isBulkPending, startBulkTransition] = useTransition();
    const [isSavingView, startSavingView] = useTransition();
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');
    const [assigneeFilter, setAssigneeFilter] = useState<'ALL' | 'ME' | 'UNASSIGNED'>('ALL');
    const [savedViewsState, setSavedViewsState] = useState<AdminSavedView[]>(savedViews);
    const [savedViewName, setSavedViewName] = useState('');
    const canManageViews = canManageTemplates;
    const [nowTs, setNowTs] = useState<number>(0);

    useEffect(() => {
        // Keep "relative time" labels deterministic during render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNowTs(Date.now());
        const id = setInterval(() => setNowTs(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const updateTicketState = (ticketId: string, updates: Partial<AdminTicket>) => {
        setTicketState((current) =>
            current.map((ticket) =>
                ticket.id === ticketId ? { ...ticket, ...updates } : ticket
            )
        );
    };

    const formatRelative = (date: string) => {
        if (!nowTs) return '';
        const diffMs = nowTs - new Date(date).getTime();
        const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
        if (diffMinutes < 60) {
            return `Hace ${diffMinutes} min`;
        }
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) {
            return `Hace ${diffHours} h`;
        }
        const diffDays = Math.round(diffHours / 24);
        return `Hace ${diffDays} d`;
    };

    const formatSlaCountdown = (slaInfo: SlaState) => {
        if (slaInfo.status === 'PAUSED') {
            return null;
        }
        const hours = Math.ceil(Math.abs(slaInfo.remainingHours));
        if (slaInfo.status === 'OVERDUE') {
            return `Vencido hace ${hours} h`;
        }
        return `Vence en ${hours} h`;
    };

    const getSlaInfo = (ticket: AdminTicket, stats?: TicketMessageStats) => {
        return getSlaState({
            priority: ticket.priority,
            status: ticket.status,
            lastUserAt: stats?.last_user_at || null,
            lastAdminAt: stats?.last_admin_at || null,
        });
    };

    const filteredTickets = useMemo(() => {
        const searchLower = search.trim().toLowerCase();

        return ticketState.filter((ticket) => {
            const stats = messageStats[ticket.id];
            const matchesQueue = queueFilter === 'ALL'
                ? true
                : queueFilter === 'UNASSIGNED'
                    ? ticket.assigned_admin_id === null
                    : queueFilter === 'WAITING_USER'
                        ? ticket.status === 'WAITING_USER'
                        : getSlaInfo(ticket, stats).status === 'OVERDUE';
            const matchesStatus = statusFilter === 'ALL' ? true : ticket.status === statusFilter;
            const matchesPriority = priorityFilter === 'ALL' ? true : ticket.priority === priorityFilter;
            const matchesAssignee = assigneeFilter === 'ALL'
                ? true
                : assigneeFilter === 'ME'
                    ? ticket.assigned_admin_id === adminId
                    : ticket.assigned_admin_id === null;
            const matchesSearch = !searchLower
                || ticket.subject.toLowerCase().includes(searchLower)
                || ticket.description.toLowerCase().includes(searchLower)
                || ticket.user_id.toLowerCase().includes(searchLower);

            return matchesQueue && matchesStatus && matchesPriority && matchesAssignee && matchesSearch;
        });
    }, [ticketState, statusFilter, priorityFilter, assigneeFilter, search, adminId, queueFilter, messageStats]);

    const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
        setPending({ id: ticketId, field: 'status' });
        const result = await updateAdminTicketStatus(ticketId, status);
        if (!result.success) {
            toast.error(result.error || 'No se pudo actualizar el estado.');
            setPending(null);
            return;
        }
        updateTicketState(ticketId, { status });
        toast.success('Estado actualizado.');
        setPending(null);
    };

    const handlePriorityChange = async (ticketId: string, priority: TicketPriority) => {
        setPending({ id: ticketId, field: 'priority' });
        const result = await updateAdminTicketPriority(ticketId, priority);
        if (!result.success) {
            toast.error(result.error || 'No se pudo actualizar la prioridad.');
            setPending(null);
            return;
        }
        updateTicketState(ticketId, { priority });
        toast.success('Prioridad actualizada.');
        setPending(null);
    };

    const handleAssigneeChange = async (ticketId: string, assigneeId: string | null) => {
        const resolvedAssignee = assigneeId === 'ME' ? adminId : assigneeId;
        setPending({ id: ticketId, field: 'assignee' });
        const result = await assignAdminTicket(ticketId, resolvedAssignee);
        if (!result.success) {
            toast.error(result.error || 'No se pudo asignar el ticket.');
            setPending(null);
            return;
        }
        updateTicketState(ticketId, { assigned_admin_id: resolvedAssignee });
        toast.success('Asignacion actualizada.');
        setPending(null);
    };

    const queueCounts = useMemo(() => {
        const counts = {
            all: ticketState.length,
            unassigned: 0,
            waitingUser: 0,
            slaOverdue: 0,
        };

        ticketState.forEach((ticket) => {
            if (ticket.assigned_admin_id === null) {
                counts.unassigned += 1;
            }
            if (ticket.status === 'WAITING_USER') {
                counts.waitingUser += 1;
            }
            if (getSlaInfo(ticket, messageStats[ticket.id]).status === 'OVERDUE') {
                counts.slaOverdue += 1;
            }
        });

        return counts;
    }, [ticketState, messageStats]);

    const handleSaveView = () => {
        const filters: SavedViewFilters = {
            queueFilter,
            statusFilter,
            priorityFilter,
            assigneeFilter,
            search: search.trim() ? search.trim() : undefined,
        };

        startSavingView(async () => {
            const result = await createAdminSavedView({
                name: savedViewName,
                filters,
            });
            if (!result.success || !result.view) {
                toast.error(result.error || 'No se pudo guardar la vista.');
                return;
            }
            setSavedViewsState((current) => [result.view as AdminSavedView, ...current]);
            setSavedViewName('');
            toast.success('Vista guardada.');
        });
    };

    const handleDeleteView = (viewId: string) => {
        startSavingView(async () => {
            const result = await deleteAdminSavedView(viewId);
            if (!result.success) {
                toast.error(result.error || 'No se pudo eliminar la vista.');
                return;
            }
            setSavedViewsState((current) => current.filter((view) => view.id !== viewId));
            toast.success('Vista eliminada.');
        });
    };

    const applySavedView = (view: AdminSavedView) => {
        setQueueFilter((view.filters.queueFilter as QueueFilter) || 'ALL');
        setStatusFilter((view.filters.statusFilter as TicketStatus | 'ALL') || 'ALL');
        setPriorityFilter((view.filters.priorityFilter as TicketPriority | 'ALL') || 'ALL');
        setAssigneeFilter((view.filters.assigneeFilter as 'ALL' | 'ME' | 'UNASSIGNED') || 'ALL');
        setSearch(view.filters.search || '');
    };

    const selectedCount = selectedIds.size;
    const allFilteredSelected = filteredTickets.length > 0
        && filteredTickets.every((ticket) => selectedIds.has(ticket.id));

    const toggleSelect = (ticketId: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(ticketId)) {
                next.delete(ticketId);
            } else {
                next.add(ticketId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (allFilteredSelected) {
                filteredTickets.forEach((ticket) => next.delete(ticket.id));
                return next;
            }
            filteredTickets.forEach((ticket) => next.add(ticket.id));
            return next;
        });
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const applyBulkActions = () => {
        const ticketIds = Array.from(selectedIds);
        if (!ticketIds.length) return;

        const payload: {
            ticketIds: string[];
            status?: TicketStatus;
            priority?: TicketPriority;
            assigned_admin_id?: string | null;
        } = { ticketIds };

        if (bulkStatus !== 'NONE') {
            payload.status = bulkStatus;
        }
        if (bulkPriority !== 'NONE') {
            payload.priority = bulkPriority;
        }
        if (bulkAssignee !== 'NONE') {
            payload.assigned_admin_id = bulkAssignee === 'ME'
                ? adminId
                : bulkAssignee === 'UNASSIGNED'
                    ? null
                    : bulkAssignee;
        }

        startBulkTransition(async () => {
            const result = await bulkUpdateTickets(payload);
            if (!result.success) {
                toast.error(result.error || 'No se pudieron aplicar los cambios.');
                return;
            }

            ticketIds.forEach((id) => {
                const updates: Partial<AdminTicket> = {};
                if (payload.status) updates.status = payload.status;
                if (payload.priority) updates.priority = payload.priority;
                if (typeof payload.assigned_admin_id !== 'undefined') {
                    updates.assigned_admin_id = payload.assigned_admin_id;
                }
                updateTicketState(id, updates);
            });

            toast.success(`Actualizados ${result.updated || ticketIds.length} tickets.`);
            setBulkStatus('NONE');
            setBulkPriority('NONE');
            setBulkAssignee('NONE');
            clearSelection();
        });
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Soporte</h1>
                    <p className="text-muted-foreground">
                        Gestiona los tickets de soporte de los usuarios
                    </p>
                </div>
                {canManageTemplates && (
                    <Button asChild variant="outline">
                        <Link href="/admin/support/templates">Plantillas de respuesta</Link>
                    </Button>
                )}
            </div>

            <SupportNav showSla={showSlaTab} />

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Vistas guardadas</CardTitle>
                    <CardDescription>
                        Guarda combinaciones de filtros para reutilizarlas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs text-muted-foreground">Nombre de la vista</Label>
                        <div className="flex gap-2">
                            <Input
                                value={savedViewName}
                                onChange={(event) => setSavedViewName(event.target.value)}
                                placeholder="Ej. Prioridad urgente"
                                disabled={!canManageViews}
                            />
                            <Button
                                type="button"
                                onClick={handleSaveView}
                                disabled={isSavingView || !savedViewName.trim() || !canManageViews}
                            >
                                Guardar
                            </Button>
                        </div>
                    </div>
                    {savedViewsState.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Aún no tienes vistas guardadas.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {savedViewsState.map((view) => (
                                <div
                                    key={view.id}
                                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                                >
                                    <button
                                        type="button"
                                        className="text-left text-sm font-medium hover:text-primary"
                                        onClick={() => applySavedView(view)}
                                    >
                                        {view.name}
                                    </button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteView(view.id)}
                                        disabled={isSavingView || !canManageViews}
                                    >
                                        Eliminar
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Tickets
                    </CardTitle>
                    <CardDescription>
                        Filtra y responde solicitudes de los usuarios.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {selectedCount > 0 && (
                        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3 text-sm">
                            <div className="flex items-center gap-2 font-medium">
                                {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={toggleSelectAll}
                            >
                                {allFilteredSelected ? 'Quitar selección' : 'Seleccionar todos'}
                            </Button>
                            <div className="flex w-[180px] flex-col gap-1">
                                <Label className="text-xs text-muted-foreground">Estado</Label>
                                <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as TicketStatus | 'NONE')}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Sin cambio</SelectItem>
                                        <SelectItem value="OPEN">Abierto</SelectItem>
                                        <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                                        <SelectItem value="WAITING_USER">Esperando usuario</SelectItem>
                                        <SelectItem value="RESOLVED">Resuelto</SelectItem>
                                        <SelectItem value="CLOSED">Cerrado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex w-[180px] flex-col gap-1">
                                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                                <Select value={bulkPriority} onValueChange={(value) => setBulkPriority(value as TicketPriority | 'NONE')}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Prioridad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Sin cambio</SelectItem>
                                        <SelectItem value="LOW">Baja</SelectItem>
                                        <SelectItem value="MEDIUM">Media</SelectItem>
                                        <SelectItem value="HIGH">Alta</SelectItem>
                                        <SelectItem value="URGENT">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {canAssign && (
                                <div className="flex w-[220px] flex-col gap-1">
                                    <Label className="text-xs text-muted-foreground">Asignación</Label>
                                    <Select value={bulkAssignee} onValueChange={(value) => setBulkAssignee(value)}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Asignación" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">Sin cambio</SelectItem>
                                            <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                                            <SelectItem value="ME">Asignarme</SelectItem>
                                            {assignees.map((assignee) => (
                                                <SelectItem key={assignee.id} value={assignee.id}>
                                                    {assignee.display_name || assignee.email}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={applyBulkActions}
                                    disabled={isBulkPending || (bulkStatus === 'NONE' && bulkPriority === 'NONE' && bulkAssignee === 'NONE')}
                                >
                                    {isBulkPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Aplicando
                                        </>
                                    ) : (
                                        'Aplicar'
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={clearSelection}
                                    disabled={isBulkPending}
                                >
                                    Limpiar
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={queueFilter === 'ALL' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setQueueFilter('ALL')}
                        >
                            Todos
                            <span className="ml-2 text-xs text-muted-foreground">{queueCounts.all}</span>
                        </Button>
                        <Button
                            variant={queueFilter === 'UNASSIGNED' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setQueueFilter('UNASSIGNED')}
                        >
                            Sin asignar
                            <span className="ml-2 text-xs text-muted-foreground">{queueCounts.unassigned}</span>
                        </Button>
                        <Button
                            variant={queueFilter === 'WAITING_USER' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setQueueFilter('WAITING_USER')}
                        >
                            Esperando usuario
                            <span className="ml-2 text-xs text-muted-foreground">{queueCounts.waitingUser}</span>
                        </Button>
                        <Button
                            variant={queueFilter === 'SLA_OVERDUE' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setQueueFilter('SLA_OVERDUE')}
                        >
                            SLA vencido
                            <span className="ml-2 text-xs text-muted-foreground">{queueCounts.slaOverdue}</span>
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex min-w-[240px] flex-1 flex-col gap-2">
                            <Label htmlFor="support-search">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="support-search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Asunto, descripcion o user ID"
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="flex w-[190px] flex-col gap-2">
                            <Label>Estado</Label>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TicketStatus | 'ALL')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos los estados</SelectItem>
                                    <SelectItem value="OPEN">Abiertos</SelectItem>
                                    <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                                    <SelectItem value="WAITING_USER">Esperando usuario</SelectItem>
                                    <SelectItem value="RESOLVED">Resueltos</SelectItem>
                                    <SelectItem value="CLOSED">Cerrados</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-[190px] flex-col gap-2">
                            <Label>Prioridad</Label>
                            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TicketPriority | 'ALL')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Prioridad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas las prioridades</SelectItem>
                                    <SelectItem value="LOW">Baja</SelectItem>
                                    <SelectItem value="MEDIUM">Media</SelectItem>
                                    <SelectItem value="HIGH">Alta</SelectItem>
                                    <SelectItem value="URGENT">Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-[210px] flex-col gap-2">
                            <Label>Asignacion</Label>
                            <Select value={assigneeFilter} onValueChange={(value) => setAssigneeFilter(value as 'ALL' | 'ME' | 'UNASSIGNED')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Asignacion" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas las asignaciones</SelectItem>
                                    <SelectItem value="ME">Asignados a mi</SelectItem>
                                    <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Sin tickets</p>
                            <p className="text-sm">
                                No hay tickets que coincidan con estos filtros
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredTickets.map((ticket) => {
                                const stats = messageStats[ticket.id];
                                const slaInfo = getSlaInfo(ticket, stats);
                                const isSelected = selectedIds.has(ticket.id);
                                const totalMessages = stats?.total ?? 0;
                                const internalMessages = stats?.internal ?? 0;
                                const lastSender = stats?.last_sender_type === 'USER'
                                    ? 'Usuario'
                                    : stats?.last_sender_type === 'ADMIN'
                                        ? 'Admin'
                                        : 'Sin actividad';
                                const waitingLabel = ticket.status === 'WAITING_USER'
                                    ? 'En espera de usuario'
                                    : stats?.last_sender_type === 'USER'
                                        && ticket.status !== 'RESOLVED'
                                        && ticket.status !== 'CLOSED'
                                        ? 'En espera de admin'
                                        : null;
                                const lastAt = stats?.last_at || ticket.updated_at;
                                const slaBadge = slaInfo.status === 'OVERDUE'
                                    ? { label: 'SLA vencido', variant: 'destructive' as const }
                                    : slaInfo.status === 'AT_RISK'
                                        ? { label: 'SLA en riesgo', variant: 'warning' as const }
                                        : null;
                                const slaCountdown = formatSlaCountdown(slaInfo);
                                const slaCountdownClass = slaInfo.status === 'OVERDUE'
                                    ? 'text-destructive'
                                    : slaInfo.status === 'AT_RISK'
                                        ? 'text-amber-500'
                                        : 'text-muted-foreground';

                                return (
                                <div
                                    key={ticket.id}
                                    className={`flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${isSelected ? 'border-primary/50 bg-primary/5' : ''}`}
                                >
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(ticket.id)}
                                                className="h-4 w-4 accent-primary"
                                                aria-label="Seleccionar ticket"
                                            />
                                            <Badge variant={statusVariant(ticket.status)} dot>
                                                {STATUS_LABELS[ticket.status]}
                                            </Badge>
                                            <Badge variant={priorityVariant(ticket.priority)}>
                                                {PRIORITY_LABELS[ticket.priority]}
                                            </Badge>
                                            <Badge variant="outline">{ticket.category}</Badge>
                                            {waitingLabel && (
                                                <Badge variant="secondary">{waitingLabel}</Badge>
                                            )}
                                            {slaBadge && (
                                                <Badge variant={slaBadge.variant}>{slaBadge.label}</Badge>
                                            )}
                                        </div>
                                        <h3 className="font-medium truncate">{ticket.subject}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {ticket.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {ticket.user_id.slice(0, 8)}...
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDate(ticket.updated_at)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatRelative(lastAt)}
                                            </span>
                                            {slaCountdown && (
                                                <span className={`flex items-center gap-1 ${slaCountdownClass}`}>
                                                    <Clock className="h-3 w-3" />
                                                    {slaCountdown}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Ultimo: {lastSender}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="h-3 w-3" />
                                                {totalMessages} mensajes
                                            </span>
                                            {internalMessages > 0 && (
                                                <span className="flex items-center gap-1 text-amber-500">
                                                    <Lock className="h-3 w-3" />
                                                    {internalMessages} internos
                                                </span>
                                            )}
                                            {ticket.assigned_admin_id && (
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    Asignado
                                                </span>
                                            )}
                                            {!ticket.assigned_admin_id && (
                                                <span className="flex items-center gap-1 text-amber-500">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Sin asignar
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-4 text-sm">
                                        <div className="flex w-[180px] flex-col gap-2">
                                            <Label className="text-xs text-muted-foreground">Estado</Label>
                                            <Select
                                                value={ticket.status}
                                                onValueChange={(value) => handleStatusChange(ticket.id, value as TicketStatus)}
                                                disabled={pending?.id === ticket.id && pending.field === 'status'}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Estado" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="OPEN">Abierto</SelectItem>
                                                    <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                                                    <SelectItem value="WAITING_USER">Esperando usuario</SelectItem>
                                                    <SelectItem value="RESOLVED">Resuelto</SelectItem>
                                                    <SelectItem value="CLOSED">Cerrado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex w-[180px] flex-col gap-2">
                                            <Label className="text-xs text-muted-foreground">Prioridad</Label>
                                            <Select
                                                value={ticket.priority}
                                                onValueChange={(value) => handlePriorityChange(ticket.id, value as TicketPriority)}
                                                disabled={pending?.id === ticket.id && pending.field === 'priority'}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Prioridad" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Baja</SelectItem>
                                                    <SelectItem value="MEDIUM">Media</SelectItem>
                                                    <SelectItem value="HIGH">Alta</SelectItem>
                                                    <SelectItem value="URGENT">Urgente</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex w-[220px] flex-col gap-2">
                                            <Label className="text-xs text-muted-foreground">Asignacion</Label>
                                            <Select
                                                value={ticket.assigned_admin_id ?? 'UNASSIGNED'}
                                                onValueChange={(value) => handleAssigneeChange(ticket.id, value === 'UNASSIGNED' ? null : value)}
                                                disabled={!canAssign || (pending?.id === ticket.id && pending.field === 'assignee')}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Asignacion" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                                                    <SelectItem value="ME">Asignarme</SelectItem>
                                                    {assignees.map((assignee) => (
                                                        <SelectItem key={assignee.id} value={assignee.id}>
                                                            {assignee.display_name || assignee.email}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex w-[160px] flex-col gap-2">
                                            <Label className="text-xs text-muted-foreground">Accion</Label>
                                            <Button asChild variant="outline" size="sm" className="w-full">
                                                <Link href={`/admin/support/${ticket.id}`}>Ver detalle</Link>
                                            </Button>
                                        </div>
                                        {pending?.id === ticket.id && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Actualizando...
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
