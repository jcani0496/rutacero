'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, PlusCircle, Clock, CheckCircle2, AlertTriangle, User, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '@/lib/actions/support';
import { createSupportTicket } from '@/lib/actions/support';

interface HelpClientProps {
    tickets: SupportTicket[];
}

const STATUS_LABELS: Record<TicketStatus, string> = {
    OPEN: 'Abierto',
    IN_PROGRESS: 'En progreso',
    WAITING_USER: 'Esperando tu respuesta',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
    TECHNICAL: 'Técnico',
    BILLING: 'Facturación',
    ACCOUNT: 'Cuenta',
    FEATURE_REQUEST: 'Sugerencia',
    OTHER: 'Otro',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
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

export function HelpClient({ tickets }: HelpClientProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'ALL' | TicketStatus>('ALL');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, startTransition] = useTransition();
    const [formError, setFormError] = useState<string | null>(null);
    const [form, setForm] = useState({
        subject: '',
        description: '',
        category: 'TECHNICAL' as TicketCategory,
        priority: 'MEDIUM' as TicketPriority,
    });

    const stats = useMemo(() => {
        return {
            open: tickets.filter((t) => t.status === 'OPEN').length,
            inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
            waiting: tickets.filter((t) => t.status === 'WAITING_USER').length,
            resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
        };
    }, [tickets]);

    const visibleTickets = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        return tickets.filter((ticket) => {
            const matchesFilter = filter === 'ALL' ? true : ticket.status === filter;
            const matchesSearch = !searchLower
                || ticket.subject.toLowerCase().includes(searchLower)
                || ticket.description.toLowerCase().includes(searchLower);
            return matchesFilter && matchesSearch;
        });
    }, [tickets, search, filter]);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-GT', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);

        startTransition(async () => {
            const result = await createSupportTicket({
                subject: form.subject,
                description: form.description,
                category: form.category,
                priority: form.priority,
            });

            if (!result.success || !result.ticket?.id) {
                setFormError(result.error || 'No se pudo crear el ticket.');
                return;
            }

            toast.success('Ticket creado correctamente.');
            setIsDialogOpen(false);
            setForm({
                subject: '',
                description: '',
                category: 'TECHNICAL',
                priority: 'MEDIUM',
            });
            router.push(`/help/${result.ticket.id}`);
        });
    };

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Centro de ayuda</h1>
                    <p className="text-muted-foreground">
                        Empezá por las respuestas self-serve. Los tickets son solo para fallos técnicos, facturación o cuenta — no coaching ni asesoría 1:1.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => router.refresh()} disabled={isSubmitting}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Actualizar
                    </Button>
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear ticket
                    </Button>
                </div>
            </div>

            <Card className="border-border/80 bg-muted/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Antes de abrir un ticket</CardTitle>
                    <CardDescription>
                        RutaCero es una herramienta de organización y planificación. No prometemos ahorro exacto ni libertad de deudas garantizada; los resultados dependen de tus pagos y de los datos que cargues.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                        <li>
                            <span className="text-foreground font-medium">Primera deuda → plan:</span>{' '}
                            desde Deudas agregá tu deuda y generá el plan; esa es la ruta principal sin soporte.
                        </li>
                        <li>
                            <span className="text-foreground font-medium">Precios y PRO:</span>{' '}
                            <Link href="/pricing" className="underline underline-offset-2 text-foreground">
                                /pricing
                            </Link>{' '}
                            (planes, cancelación, métodos de pago).
                        </li>
                        <li>
                            <span className="text-foreground font-medium">FAQ público:</span>{' '}
                            <Link href="/#faq" className="underline underline-offset-2 text-foreground">
                                preguntas frecuentes
                            </Link>{' '}
                            en la landing.
                        </li>
                        <li>
                            <span className="text-foreground font-medium">No cubrimos:</span>{' '}
                            acompañamiento emocional, coaching financiero personalizado ni asesoría legal/fiscal.
                        </li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        Si el FAQ no resuelve un problema de producto o cobro, abrí un ticket abajo. Respondemos según capacidad del equipo (sin promesa de chat 1:1 inmediato).
                    </p>
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            Abiertos
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.open}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 text-primary" />
                            En progreso
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.inProgress}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Esperando tu respuesta
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.waiting}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            Resueltos
                        </div>
                        <p className="mt-2 text-2xl font-semibold">{stats.resolved}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Tus tickets
                        </CardTitle>
                        <CardDescription>Todos tus casos activos y su estado.</CardDescription>
                    </div>
                    <Input
                        placeholder="Buscar por asunto o descripción"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="sm:max-w-xs"
                    />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs value={filter} onValueChange={(value) => setFilter(value as TicketStatus | 'ALL')}>
                        <TabsList className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
                            <TabsTrigger value="ALL">Todos</TabsTrigger>
                            <TabsTrigger value="OPEN">Abiertos</TabsTrigger>
                            <TabsTrigger value="IN_PROGRESS">En progreso</TabsTrigger>
                            <TabsTrigger value="WAITING_USER">Esperando respuesta</TabsTrigger>
                            <TabsTrigger value="RESOLVED">Resueltos</TabsTrigger>
                            <TabsTrigger value="CLOSED">Cerrados</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {visibleTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                            <MessageSquare className="h-10 w-10 opacity-60" />
                            <div>
                                <p className="text-base font-medium text-foreground">No hay tickets en esta vista</p>
                                <p className="text-sm">Revisá el FAQ arriba o creá un ticket solo si es un fallo de producto o facturación.</p>
                            </div>
                            <Button onClick={() => setIsDialogOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Crear ticket
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {visibleTickets.map((ticket) => (
                                <Card key={ticket.id} className="border border-border/60 bg-background/60">
                                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={statusVariant(ticket.status)} dot>
                                                    {STATUS_LABELS[ticket.status]}
                                                </Badge>
                                                <Badge variant={priorityVariant(ticket.priority)}>
                                                    {PRIORITY_LABELS[ticket.priority]}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {CATEGORY_LABELS[ticket.category]}
                                                </Badge>
                                            </div>
                                            <h3 className="text-base font-semibold text-foreground">
                                                {ticket.subject}
                                            </h3>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {ticket.description}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground sm:items-end">
                                            <span>Actualizado {formatDate(ticket.updated_at)}</span>
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/help/${ticket.id}`}>Ver ticket</Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Nuevo ticket</DialogTitle>
                        <DialogDescription>
                            Solo para fallos técnicos, facturación o cuenta. No es un canal de coaching ni asesoría financiera.
                            Describí pasos, errores y lo que esperabas; respondemos cuando haya capacidad.
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="ticket-subject">Asunto</Label>
                            <Input
                                id="ticket-subject"
                                value={form.subject}
                                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                                placeholder="Ej: Problema con pagos"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ticket-category">Categoría</Label>
                            <Select
                                value={form.category}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as TicketCategory }))}
                            >
                                <SelectTrigger id="ticket-category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TECHNICAL">Técnico</SelectItem>
                                    <SelectItem value="BILLING">Facturación</SelectItem>
                                    <SelectItem value="ACCOUNT">Cuenta</SelectItem>
                                    <SelectItem value="FEATURE_REQUEST">Sugerencia</SelectItem>
                                    <SelectItem value="OTHER">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ticket-priority">Prioridad</Label>
                            <Select
                                value={form.priority}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as TicketPriority }))}
                            >
                                <SelectTrigger id="ticket-priority">
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
                        <div className="space-y-2">
                            <Label htmlFor="ticket-description">Descripción</Label>
                            <Textarea
                                id="ticket-description"
                                value={form.description}
                                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                placeholder="Incluye pasos, mensajes de error y lo que esperabas que ocurriera."
                                rows={5}
                                required
                            />
                        </div>
                        {formError && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                                {formError}
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creando...' : 'Crear ticket'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
