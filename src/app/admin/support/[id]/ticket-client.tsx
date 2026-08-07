'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Clock,
    ChatCircle,
    Shield,
    CheckCircle,
    UserCheck,
    Warning,
    X,
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { getSlaState, type SlaState } from '@/lib/support/sla';
import type {
    AdminAssignee,
    AdminTicket,
    SupportTicketLabel,
    ReplyTemplate,
    TicketHistoryEntry,
    TicketMessage,
    TicketPriority,
    TicketStatus,
} from '@/lib/actions/admin-support';
import {
    addAdminTicketMessage,
    addAdminTicketLabel,
    assignAdminTicket,
    removeAdminTicketLabel,
    updateAdminTicketPriority,
    updateAdminTicketStatus,
} from '@/lib/actions/admin-support';

interface AdminTicketClientProps {
    ticket: AdminTicket;
    messages: TicketMessage[];
    userEmail: string | null;
    assignees: AdminAssignee[];
    canAssign: boolean;
    adminId: string;
    labels: SupportTicketLabel[];
    history: TicketHistoryEntry[];
    templates: ReplyTemplate[];
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

const HISTORY_LABELS: Record<string, string> = {
    ASSIGN_TICKET: 'Asignacion actualizada',
    UPDATE_TICKET_STATUS: 'Cambio de estado',
    UPDATE_TICKET_PRIORITY: 'Cambio de prioridad',
    REPLY_TICKET: 'Respuesta enviada',
    ADD_INTERNAL_NOTE: 'Nota interna agregada',
    ADD_TICKET_LABEL: 'Etiqueta agregada',
    REMOVE_TICKET_LABEL: 'Etiqueta removida',
};

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

const SLA_LABELS: Record<SlaState['status'], string> = {
    OK: 'En tiempo',
    AT_RISK: 'En riesgo',
    OVERDUE: 'Vencido',
    PAUSED: 'En pausa',
};

const SLA_VARIANTS: Record<SlaState['status'], 'success' | 'warning' | 'destructive' | 'secondary'> = {
    OK: 'success',
    AT_RISK: 'warning',
    OVERDUE: 'destructive',
    PAUSED: 'secondary',
};

export function AdminTicketClient({
    ticket,
    messages,
    userEmail,
    assignees,
    canAssign,
    adminId,
    labels,
    history,
    templates,
}: AdminTicketClientProps) {
    const router = useRouter();
    const [reply, setReply] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [status, setStatus] = useState<TicketStatus>(ticket.status);
    const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
    const [assignedId, setAssignedId] = useState<string>(ticket.assigned_admin_id || 'unassigned');
    const [isPending, startTransition] = useTransition();
    const [labelInput, setLabelInput] = useState('');
    const [isMetaPending, startMetaTransition] = useTransition();
    const [selectedTemplateId, setSelectedTemplateId] = useState('none');
    const [historyOpen, setHistoryOpen] = useState(false);

    const adminMap = useMemo(() => {
        return new Map(assignees.map((admin) => [admin.id, admin.display_name || admin.email]));
    }, [assignees]);

    const slaInfo = useMemo(() => {
        let lastUserAt: string | null = null;
        let lastAdminAt: string | null = null;

        messages.forEach((message) => {
            if (message.sender_type === 'USER') {
                if (!lastUserAt || new Date(message.created_at).getTime() > new Date(lastUserAt).getTime()) {
                    lastUserAt = message.created_at;
                }
            }
            if (message.sender_type === 'ADMIN') {
                if (!lastAdminAt || new Date(message.created_at).getTime() > new Date(lastAdminAt).getTime()) {
                    lastAdminAt = message.created_at;
                }
            }
        });

        return getSlaState({
            priority,
            status,
            lastUserAt,
            lastAdminAt,
        });
    }, [messages, priority, status]);

    const formatDate = (date: string | null) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatSlaCountdown = (sla: SlaState) => {
        if (sla.status === 'PAUSED') return null;
        const hours = Math.ceil(Math.abs(sla.remainingHours));
        if (sla.status === 'OVERDUE') {
            return `Vencido hace ${hours} h`;
        }
        return `Vence en ${hours} h`;
    };

    const slaCountdown = formatSlaCountdown(slaInfo);
    const slaCountdownClass = slaInfo.status === 'OVERDUE'
        ? 'text-destructive'
        : slaInfo.status === 'AT_RISK'
            ? 'text-warning'
            : 'text-foreground';

    const handleSend = () => {
        startTransition(async () => {
            const result = await addAdminTicketMessage(ticket.id, reply, isInternal);
            if (!result.success) {
                toast.error(result.error || 'No se pudo enviar la respuesta.');
                return;
            }
            toast.success(isInternal ? 'Nota interna agregada.' : 'Respuesta enviada.');
            setReply('');
            setIsInternal(false);
            router.refresh();
        });
    };

    const handleTemplateInsert = () => {
        if (selectedTemplateId === 'none') return;
        const template = templates.find((item) => item.id === selectedTemplateId);
        if (!template) return;
        setReply((prev) => (prev ? `${prev}\n\n${template.body}` : template.body));
    };

    const handleStatusChange = (value: TicketStatus) => {
        setStatus(value);
        startTransition(async () => {
            const result = await updateAdminTicketStatus(ticket.id, value);
            if (!result.success) {
                toast.error(result.error || 'No se pudo actualizar el estado.');
                return;
            }
            toast.success('Estado actualizado.');
            router.refresh();
        });
    };

    const handlePriorityChange = (value: TicketPriority) => {
        setPriority(value);
        startTransition(async () => {
            const result = await updateAdminTicketPriority(ticket.id, value);
            if (!result.success) {
                toast.error(result.error || 'No se pudo actualizar la prioridad.');
                return;
            }
            toast.success('Prioridad actualizada.');
            router.refresh();
        });
    };

    const handleAssign = (value: string) => {
        setAssignedId(value);
        startTransition(async () => {
            const result = await assignAdminTicket(ticket.id, value === 'unassigned' ? null : value);
            if (!result.success) {
                toast.error(result.error || 'No se pudo asignar el ticket.');
                return;
            }
            toast.success('Asignación actualizada.');
            router.refresh();
        });
    };

    const handleAssignMe = () => {
        handleAssign(adminId);
    };

    const handleAddLabel = () => {
        startMetaTransition(async () => {
            const result = await addAdminTicketLabel(ticket.id, labelInput);
            if (!result.success) {
                toast.error(result.error || 'No se pudo agregar la etiqueta.');
                return;
            }
            toast.success('Etiqueta agregada.');
            setLabelInput('');
            router.refresh();
        });
    };

    const handleRemoveLabel = (labelId: string) => {
        startMetaTransition(async () => {
            const result = await removeAdminTicketLabel(labelId);
            if (!result.success) {
                toast.error(result.error || 'No se pudo eliminar la etiqueta.');
                return;
            }
            toast.success('Etiqueta eliminada.');
            router.refresh();
        });
    };

    const formatHistoryDetail = (entry: TicketHistoryEntry) => {
        if (!entry.details) return null;
        if (entry.action === 'UPDATE_TICKET_STATUS' && typeof entry.details.status === 'string') {
            return `Estado: ${entry.details.status}`;
        }
        if (entry.action === 'UPDATE_TICKET_PRIORITY' && typeof entry.details.priority === 'string') {
            return `Prioridad: ${entry.details.priority}`;
        }
        if (entry.action === 'ASSIGN_TICKET' && typeof entry.details.assigned_admin_id === 'string') {
            const adminName = adminMap.get(entry.details.assigned_admin_id) || 'Admin';
            return `Asignado a: ${adminName}`;
        }
        if (entry.action === 'ADD_TICKET_LABEL' && typeof entry.details.label === 'string') {
            return `Etiqueta: ${entry.details.label}`;
        }
        if (entry.action === 'REMOVE_TICKET_LABEL' && typeof entry.details.label === 'string') {
            return `Etiqueta: ${entry.details.label}`;
        }
        return null;
    };

    const isClosed = ticket.status === 'CLOSED';

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/support" aria-label="Volver a tickets de soporte">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold sm:text-3xl">{ticket.subject}</h1>
                        <p className="text-muted-foreground">
                            Ticket #{ticket.id.slice(0, 8)} • {formatDate(ticket.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(ticket.status)} dot>
                        {STATUS_LABELS[ticket.status]}
                    </Badge>
                    <Badge variant="outline">{PRIORITY_LABELS[ticket.priority]}</Badge>
                    <Badge variant="outline">{ticket.category}</Badge>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ChatCircle {...ICON} className="h-5 w-5 text-primary" />
                            Conversación
                        </CardTitle>
                        <CardDescription>
                            Responde al usuario o deja notas internas para el equipo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2 md:max-h-[520px]">
                            {messages.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                    Aún no hay mensajes en este ticket.
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isAdmin = msg.sender_type === 'ADMIN';
                                    const senderName = isAdmin
                                        ? adminMap.get(msg.sender_id) || 'Admin'
                                        : userEmail || 'Usuario';
                                    return (
                                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-soft ${isAdmin
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-muted text-foreground'
                                                    } ${msg.is_internal ? 'border border-warning/30 bg-warning/10 text-warning' : ''}`}
                                            >
                                                <div className="mb-1 text-xs text-muted-foreground">
                                                    {senderName} • {formatDate(msg.created_at)}
                                                    {msg.is_internal && (
                                                        <span className="ml-2 inline-flex items-center gap-1 text-warning">
                                                            <Warning {...ICON} className="h-3 w-3" />
                                                            Nota interna
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="space-y-3 border-t pt-4">
                            {templates.length > 0 && (
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                                        <p className="text-sm text-muted-foreground">Plantillas rápidas</p>
                                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona una plantilla" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sin plantilla</SelectItem>
                                                {templates.map((template) => (
                                                    <SelectItem key={template.id} value={template.id}>
                                                        {template.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTemplateInsert}
                                        disabled={selectedTemplateId === 'none' || isClosed}
                                    >
                                        Insertar
                                    </Button>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border border-border accent-[var(--warning)]"
                                        checked={isInternal}
                                        onChange={(event) => setIsInternal(event.target.checked)}
                                    />
                                    Marcar como nota interna
                                </label>
                                {isClosed && (
                                    <span className="text-xs text-warning">
                                        Reabre el ticket para responder.
                                    </span>
                                )}
                            </div>
                            <Textarea
                                value={reply}
                                onChange={(event) => setReply(event.target.value)}
                                placeholder="Escribe tu respuesta para el usuario."
                                rows={4}
                                disabled={isClosed}
                            />
                            <div className="flex items-center justify-end gap-2">
                                <Button onClick={handleSend} disabled={isPending || isClosed}>
                                    Enviar respuesta
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="lg:sticky lg:top-24 lg:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                Panel del ticket
                            </CardTitle>
                            <CardDescription>
                                Gestiona el caso sin perder la conversación de vista.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                                <div className="grid gap-3">
                                    <div>
                                        <p className="text-muted-foreground">Cliente</p>
                                        <p className="font-medium">{userEmail || 'No disponible'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">User ID</p>
                                        <p className="font-medium">{ticket.user_id}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Última actualización</p>
                                        <p className="font-medium flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            {formatDate(ticket.updated_at)}
                                        </p>
                                        {ticket.resolved_at && (
                                            <p className="mt-1 flex items-center gap-2 text-success">
                                                <CheckCircle {...ICON} className="h-4 w-4" />
                                                Resuelto {formatDate(ticket.resolved_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">Herramientas rápidas</p>
                                <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            Ver historial
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="right" className="max-w-lg">
                                        <SheetHeader>
                                            <SheetTitle>Historial del ticket</SheetTitle>
                                            <SheetDescription>
                                                Cambios recientes y acciones registradas por el equipo.
                                            </SheetDescription>
                                        </SheetHeader>
                                        <SheetBody>
                                            {history.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">
                                                    No hay cambios registrados.
                                                </p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {history.map((entry) => {
                                                        const detail = formatHistoryDetail(entry);
                                                        return (
                                                            <div key={entry.id} className="rounded-lg border border-border p-3">
                                                                <p className="text-sm font-medium">
                                                                    {HISTORY_LABELS[entry.action] || entry.action}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {entry.admin_name || 'Admin'} • {formatDate(entry.created_at)}
                                                                </p>
                                                                {detail && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {detail}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </SheetBody>
                                    </SheetContent>
                                </Sheet>
                            </div>

                            <Tabs defaultValue="gestion" className="space-y-4">
                                <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
                                    <TabsTrigger value="gestion" className="text-xs">Gestión</TabsTrigger>
                                    <TabsTrigger value="sla" className="text-xs">SLA</TabsTrigger>
                                    <TabsTrigger value="etiquetas" className="text-xs">Etiquetas</TabsTrigger>
                                </TabsList>

                                <TabsContent value="gestion" className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm">
                                    <div className="space-y-2">
                                        <p className="text-muted-foreground">Estado</p>
                                        <Select value={status} onValueChange={(value) => handleStatusChange(value as TicketStatus)}>
                                            <SelectTrigger>
                                                <SelectValue />
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
                                    <div className="space-y-2">
                                        <p className="text-muted-foreground">Prioridad</p>
                                        <Select value={priority} onValueChange={(value) => handlePriorityChange(value as TicketPriority)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LOW">Baja</SelectItem>
                                                <SelectItem value="MEDIUM">Media</SelectItem>
                                                <SelectItem value="HIGH">Alta</SelectItem>
                                                <SelectItem value="URGENT">Urgente</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {canAssign ? (
                                        <div className="space-y-2">
                                            <p className="text-muted-foreground">Asignación</p>
                                            <Select value={assignedId} onValueChange={handleAssign}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                                                    {assignees.map((admin) => (
                                                        <SelectItem key={admin.id} value={admin.id}>
                                                            {admin.display_name || admin.email}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={handleAssignMe}
                                                disabled={isPending || assignedId === adminId}
                                            >
                                                <UserCheck className="mr-2 h-4 w-4" />
                                                Asignarme
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                            No tienes permisos para asignar tickets.
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="sla" className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Estado</span>
                                        <Badge variant={SLA_VARIANTS[slaInfo.status]}>
                                            {SLA_LABELS[slaInfo.status]}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Objetivo</span>
                                        <span className="font-medium">{slaInfo.targetHours} h</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Conteo</span>
                                        {slaCountdown ? (
                                            <span className={`font-medium ${slaCountdownClass}`}>
                                                {slaCountdown}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">En pausa</span>
                                        )}
                                    </div>
                                    {slaInfo.dueAt && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Vence</span>
                                            <span className="font-medium">{formatDate(slaInfo.dueAt)}</span>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="etiquetas" className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm">
                                    {labels.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">
                                            Sin etiquetas internas.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {labels.map((label) => (
                                                <span key={label.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                                                    {label.label}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLabel(label.id)}
                                                        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                                                        disabled={isMetaPending}
                                                        aria-label="Eliminar etiqueta"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Input
                                            value={labelInput}
                                            onChange={(event) => setLabelInput(event.target.value)}
                                            placeholder="Nueva etiqueta"
                                        />
                                        <Button
                                            onClick={handleAddLabel}
                                            disabled={isMetaPending || !labelInput.trim()}
                                        >
                                            Agregar
                                        </Button>
                                    </div>
                                    {isMetaPending && (
                                        <p className="text-xs text-muted-foreground">Actualizando etiquetas...</p>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
