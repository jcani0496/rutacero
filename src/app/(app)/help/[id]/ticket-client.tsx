'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ChatCircle,
    CheckCircle,
    Clock,
    Shield
} from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import type { SupportTicket, TicketMessage, TicketStatus } from '@/lib/actions/support';
import { addTicketMessage, setUserTicketStatus } from '@/lib/actions/support';

interface TicketClientProps {
    ticket: SupportTicket;
    messages: TicketMessage[];
}

const STATUS_LABELS: Record<TicketStatus, string> = {
    OPEN: 'Abierto',
    IN_PROGRESS: 'En progreso',
    WAITING_USER: 'Esperando tu respuesta',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
};

const CATEGORY_LABELS: Record<string, string> = {
    TECHNICAL: 'Técnico',
    BILLING: 'Facturación',
    ACCOUNT: 'Cuenta',
    FEATURE_REQUEST: 'Sugerencia',
    OTHER: 'Otro',
};

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
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

export function TicketClient({ ticket, messages }: TicketClientProps) {
    const router = useRouter();
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const isClosed = ticket.status === 'CLOSED';
    const isResolved = ticket.status === 'RESOLVED';

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

    const handleSendMessage = () => {
        startTransition(async () => {
            const result = await addTicketMessage(ticket.id, message);
            if (!result.success) {
                toast.error(result.error || 'No se pudo enviar el mensaje.');
                return;
            }
            setMessage('');
            router.refresh();
        });
    };

    const handleCloseTicket = () => {
        startTransition(async () => {
            const result = await setUserTicketStatus(ticket.id, 'CLOSED');
            if (!result.success) {
                toast.error(result.error || 'No se pudo cerrar el ticket.');
                return;
            }
            toast.success('Ticket cerrado.');
            router.refresh();
        });
    };

    const handleReopenTicket = () => {
        startTransition(async () => {
            const result = await setUserTicketStatus(ticket.id, 'OPEN');
            if (!result.success) {
                toast.error(result.error || 'No se pudo reabrir el ticket.');
                return;
            }
            toast.success('Ticket reabierto.');
            router.refresh();
        });
    };

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/help" aria-label="Volver a ayuda">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold sm:text-3xl">{ticket.subject}</h1>
                        <p className="text-muted-foreground">
                            Ticket #{ticket.id.slice(0, 8)} • Creado {formatDate(ticket.created_at)}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(isResolved || isClosed) ? (
                        <Button variant="outline" onClick={handleReopenTicket} disabled={isPending}>
                            Reabrir ticket
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={handleCloseTicket} disabled={isPending}>
                            Cerrar ticket
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
                        <Clock className="mr-2 h-4 w-4" />
                        Actualizar
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ChatCircle className="h-5 w-5 text-primary" />
                            Conversación
                        </CardTitle>
                        <CardDescription>
                            Compartí contexto adicional o respondé a las solicitudes del equipo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2 md:max-h-[480px]">
                            {messages.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                    Aún no hay mensajes en este ticket.
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isUser = msg.sender_type === 'USER';
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-soft ${isUser
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-100'
                                                    : 'bg-muted text-foreground'
                                                    }`}
                                            >
                                                <div className="mb-1 text-xs text-muted-foreground">
                                                    {isUser ? 'Tú' : 'Equipo RutaCero'} • {formatDate(msg.created_at)}
                                                </div>
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="space-y-3 border-t pt-4">
                            <LabelMessageState status={ticket.status} />
                            <Textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                placeholder="Escribí tu respuesta o agregá información adicional."
                                rows={4}
                                disabled={isClosed}
                            />
                            <div className="flex items-center justify-end gap-2">
                                <Button onClick={handleSendMessage} disabled={isPending || isClosed}>
                                    Enviar mensaje
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Detalles del ticket
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="space-y-2">
                            <p className="text-muted-foreground">Estado</p>
                            <Badge variant={statusVariant(ticket.status)} dot>
                                {STATUS_LABELS[ticket.status]}
                            </Badge>
                        </div>
                        <div className="space-y-2">
                            <p className="text-muted-foreground">Prioridad</p>
                            <Badge variant="outline">{PRIORITY_LABELS[ticket.priority]}</Badge>
                        </div>
                        <div className="space-y-2">
                            <p className="text-muted-foreground">Categoría</p>
                            <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
                        </div>
                        <div className="space-y-2">
                            <p className="text-muted-foreground">Última actualización</p>
                            <p className="font-medium">{formatDate(ticket.updated_at)}</p>
                        </div>
                        {ticket.resolved_at && (
                            <div className="space-y-2">
                                <p className="text-muted-foreground">Resuelto</p>
                                <p className="font-medium flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-success" />
                                    {formatDate(ticket.resolved_at)}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function LabelMessageState({ status }: { status: TicketStatus }) {
    if (status === 'CLOSED') {
        return (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600">
                Este ticket está cerrado. Reábrelo para enviar nuevos mensajes.
            </div>
        );
    }

    if (status === 'WAITING_USER') {
        return (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-xs text-primary">
                El equipo está esperando tu respuesta para continuar.
            </div>
        );
    }

    if (status === 'RESOLVED') {
        return (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600">
                Este ticket está marcado como resuelto. Si necesitás más ayuda, reabrilo.
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Compartí la información necesaria para que podamos ayudarte mejor.
        </div>
    );
}
