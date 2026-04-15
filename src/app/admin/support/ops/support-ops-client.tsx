'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, Clock, MessageSquare, User, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableEmpty,
} from '@/components/ui/table';
import { getSlaState } from '@/lib/support/sla';
import type {
    AdminTicket,
    SupportAgentMetric,
    SupportMetrics,
    TicketMessageStats,
    TicketPriority,
    TicketStatus,
} from '@/lib/actions/admin-support';
import { SupportNav } from '../support-nav';

interface SupportOpsClientProps {
    tickets: AdminTicket[];
    messageStats: Record<string, TicketMessageStats>;
    metrics: SupportMetrics;
    agentMetrics: SupportAgentMetric[];
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

export function SupportOpsClient({ tickets, messageStats, metrics, agentMetrics }: SupportOpsClientProps) {
    const statusCounts = useMemo(() => {
        const counts: Record<TicketStatus, number> = {
            OPEN: 0,
            IN_PROGRESS: 0,
            WAITING_USER: 0,
            RESOLVED: 0,
            CLOSED: 0,
        };
        tickets.forEach((ticket) => {
            counts[ticket.status] += 1;
        });
        return counts;
    }, [tickets]);

    const unassignedActive = useMemo(() => {
        return tickets.filter((ticket) =>
            ['OPEN', 'IN_PROGRESS'].includes(ticket.status) && !ticket.assigned_admin_id
        );
    }, [tickets]);

    const waitingOnTeam = useMemo(() => {
        return tickets
            .filter((ticket) => ['OPEN', 'IN_PROGRESS'].includes(ticket.status))
            .map((ticket) => {
                const stats = messageStats[ticket.id];
                const sla = getSlaState({
                    priority: ticket.priority,
                    status: ticket.status,
                    lastUserAt: stats?.last_user_at || null,
                    lastAdminAt: stats?.last_admin_at || null,
                });
                return { ticket, sla };
            })
            .filter(({ sla }) => sla.status === 'OVERDUE' || sla.status === 'AT_RISK')
            .sort((a, b) => a.sla.remainingHours - b.sla.remainingHours)
            .slice(0, 6);
    }, [tickets, messageStats]);

    const formatAverage = (minutes: number | null) => {
        if (minutes === null) return 'Sin datos';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        return `${hours} h ${remainder} min`;
    };

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Operaciones de soporte</h1>
                <p className="text-muted-foreground">
                    Vista diaria para balancear carga y priorizar tickets activos.
                </p>
            </div>

            <SupportNav />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Backlog activo</CardTitle>
                        <CardDescription>Tickets abiertos + en progreso</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{statusCounts.OPEN + statusCounts.IN_PROGRESS}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Sin incluir cerrados.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Sin asignar</CardTitle>
                        <CardDescription>Necesitan responsable</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-500">{unassignedActive.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">SLA en riesgo</CardTitle>
                        <CardDescription>Respuestas urgentes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-500">{metrics.sla_at_risk}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">SLA vencidos</CardTitle>
                        <CardDescription>Prioridad inmediata</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-destructive">{metrics.sla_overdue}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Atención inmediata
                        </CardTitle>
                        <CardDescription>
                            Tickets con SLA vencido o en riesgo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {waitingOnTeam.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <Activity className="h-10 w-10 mb-2 opacity-50" />
                                <p className="text-sm">Sin tickets críticos.</p>
                            </div>
                        ) : (
                            waitingOnTeam.map(({ ticket, sla }) => (
                                <div key={ticket.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                                    <Badge variant={sla.status === 'OVERDUE' ? 'destructive' : 'warning'}>
                                        {sla.status === 'OVERDUE' ? 'Vencido' : 'En riesgo'}
                                    </Badge>
                                    <Link
                                        href={`/admin/support/${ticket.id}`}
                                        className="flex-1 truncate text-sm font-medium hover:text-primary"
                                    >
                                        {ticket.subject}
                                    </Link>
                                    <Badge variant="outline">{PRIORITY_LABELS[ticket.priority]}</Badge>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserCheck className="h-5 w-5" />
                            Distribución por estado
                        </CardTitle>
                        <CardDescription>Resumen operativo actual.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.entries(statusCounts).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{STATUS_LABELS[status as TicketStatus]}</span>
                                <Badge variant="outline">{count}</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Backlog sin asignar
                        </CardTitle>
                        <CardDescription>Prioriza reasignaciones rápidas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ticket</TableHead>
                                    <TableHead>Prioridad</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {unassignedActive.length === 0 ? (
                                    <TableEmpty
                                        title="Todo asignado"
                                        description="No hay tickets abiertos sin responsable."
                                    />
                                ) : (
                                    unassignedActive.slice(0, 6).map((ticket) => (
                                        <TableRow key={ticket.id}>
                                            <TableCell>
                                                <Link
                                                    href={`/admin/support/${ticket.id}`}
                                                    className="font-medium hover:text-primary"
                                                >
                                                    {ticket.subject}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{PRIORITY_LABELS[ticket.priority]}</TableCell>
                                            <TableCell>{STATUS_LABELS[ticket.status]}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Tiempo promedio de respuesta
                        </CardTitle>
                        <CardDescription>Primera respuesta del equipo</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-2xl font-bold">{formatAverage(metrics.avg_first_response_minutes)}</p>
                        <div className="space-y-2">
                            {Object.entries(metrics.active_by_priority).map(([priority, count]) => (
                                <div key={priority} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{PRIORITY_LABELS[priority as TicketPriority]}</span>
                                    <Badge variant="outline">{count}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Carga por agente
                    </CardTitle>
                    <CardDescription>Backlog actual y SLA por persona.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Agente</TableHead>
                                <TableHead>Backlog</TableHead>
                                <TableHead>Asignados</TableHead>
                                <TableHead>1ra respuesta</TableHead>
                                <TableHead>SLA vencido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agentMetrics.length === 0 ? (
                                <TableEmpty
                                    title="Sin agentes disponibles"
                                    description="No hay métricas registradas aún."
                                />
                            ) : (
                                agentMetrics.map((agent) => (
                                    <TableRow key={agent.id}>
                                        <TableCell>
                                            <div className="font-medium">{agent.display_name || agent.email}</div>
                                            <div className="text-xs text-muted-foreground">{agent.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={agent.active_total > 0 ? 'warning' : 'secondary'}>
                                                {agent.active_total}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{agent.assigned_total}</TableCell>
                                        <TableCell>{formatAverage(agent.avg_first_response_minutes)}</TableCell>
                                        <TableCell>
                                            <Badge variant={agent.sla_overdue > 0 ? 'destructive' : 'secondary'}>
                                                {agent.sla_overdue}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
