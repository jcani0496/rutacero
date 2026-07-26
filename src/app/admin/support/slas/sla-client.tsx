'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { WarningCircle, CircleNotch, ChatCircle, User } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableEmpty,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { applySlaEscalations } from '@/lib/actions/admin-support';
import { getSlaState, type SlaState } from '@/lib/support/sla';
import type {
    AdminTicket,
    SupportAgentMetric,
    SupportMetrics,
    TicketMessageStats,
    TicketPriority,
} from '@/lib/actions/admin-support';
import { SupportNav } from '../support-nav';

interface SupportSlaClientProps {
    tickets: AdminTicket[];
    messageStats: Record<string, TicketMessageStats>;
    metrics: SupportMetrics;
    agentMetrics: SupportAgentMetric[];
    canEscalate: boolean;
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
};

export function SupportSlaClient({
    tickets,
    messageStats,
    metrics,
    agentMetrics,
    canEscalate,
}: SupportSlaClientProps) {
    const [ticketState, setTicketState] = useState(tickets);
    const [isEscalationPending, startEscalation] = useTransition();

    const formatAverage = (minutes: number | null) => {
        if (minutes === null) {
            return 'Sin datos';
        }
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        return `${hours} h ${remainder} min`;
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

    const slaAlerts = useMemo(() => {
        return ticketState
            .map((ticket) => {
                const stats = messageStats[ticket.id];
                const sla = getSlaInfo(ticket, stats);
                if (sla.status !== 'OVERDUE' && sla.status !== 'AT_RISK') {
                    return null;
                }
                return {
                    ticket,
                    sla,
                    countdown: formatSlaCountdown(sla),
                };
            })
            .filter((item): item is { ticket: AdminTicket; sla: SlaState; countdown: string | null } => Boolean(item))
            .sort((a, b) => {
                if (a.sla.status !== b.sla.status) {
                    return a.sla.status === 'OVERDUE' ? -1 : 1;
                }
                return a.sla.remainingHours - b.sla.remainingHours;
            })
            .slice(0, 8);
    }, [ticketState, messageStats]);

    const sortedAgentMetrics = useMemo(() => {
        return [...agentMetrics].sort((a, b) => b.active_total - a.active_total);
    }, [agentMetrics]);

    const handleSlaEscalation = () => {
        startEscalation(async () => {
            const result = await applySlaEscalations({ force: true });
            if (!result.success) {
                toast.error(result.error || 'No se pudo aplicar el escalamiento.');
                return;
            }
            if (result.updates?.length) {
                setTicketState((current) =>
                    current.map((ticket) => {
                        const update = result.updates?.find((item) => item.id === ticket.id);
                        return update ? { ...ticket, priority: update.priority } : ticket;
                    })
                );
            }
            toast.success(`Escalados ${result.updated || 0} tickets.`);
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold sm:text-3xl">SLAs y rendimiento</h1>
                <p className="text-muted-foreground">
                    Monitorea cumplimiento y tiempos de respuesta del equipo.
                </p>
            </div>

            <SupportNav showSla />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Tiempo promedio</CardTitle>
                        <CardDescription>Primera respuesta admin</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{formatAverage(metrics.avg_first_response_minutes)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Basado en tickets con respuesta registrada.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">SLA en riesgo</CardTitle>
                        <CardDescription>Tickets activos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-500">{metrics.sla_at_risk}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">SLA vencidos</CardTitle>
                        <CardDescription>Tickets activos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-destructive">{metrics.sla_overdue}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Backlog activo</CardTitle>
                        <CardDescription>Total en seguimiento</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{metrics.active_total}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <WarningCircle {...ICON} className="h-5 w-5 text-amber-500" />
                                Alertas SLA
                            </CardTitle>
                            <CardDescription>
                                Tickets con riesgo o vencidos.
                            </CardDescription>
                        </div>
                        {canEscalate && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSlaEscalation}
                                disabled={isEscalationPending}
                            >
                                {isEscalationPending ? (
                                    <>
                                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                                        Escalando
                                    </>
                                ) : (
                                    'Escalar vencidos'
                                )}
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {slaAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <ChatCircle {...ICON} className="h-10 w-10 mb-3 opacity-50" />
                                <p className="text-sm">No hay alertas activas.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {slaAlerts.map(({ ticket, sla, countdown }) => (
                                    <div key={ticket.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                                        <Badge variant={sla.status === 'OVERDUE' ? 'destructive' : 'warning'}>
                                            {countdown || (sla.status === 'OVERDUE' ? 'Vencido' : 'En riesgo')}
                                        </Badge>
                                        <Link
                                            href={`/admin/support/${ticket.id}`}
                                            className="flex-1 truncate text-sm font-medium hover:text-primary"
                                        >
                                            {ticket.subject}
                                        </Link>
                                        <Badge variant="outline">
                                            {PRIORITY_LABELS[ticket.priority]}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Prioridades activas</CardTitle>
                        <CardDescription>Backlog actual por prioridad</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.entries(metrics.active_by_priority).map(([priority, count]) => (
                            <div key={priority} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{PRIORITY_LABELS[priority as TicketPriority]}</span>
                                <Badge variant="outline">{count}</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Métricas por agente
                    </CardTitle>
                    <CardDescription>
                        Rendimiento del equipo en los últimos 30 días.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Agente</TableHead>
                                <TableHead>Backlog</TableHead>
                                <TableHead>Asignados</TableHead>
                                <TableHead>Resueltos 30d</TableHead>
                                <TableHead>1ra respuesta</TableHead>
                                <TableHead>SLA vencido</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAgentMetrics.length === 0 ? (
                                <TableEmpty
                                    title="Sin métricas disponibles"
                                    description="No hay agentes activos con tickets asignados."
                                />
                            ) : (
                                sortedAgentMetrics.map((agent) => (
                                    <TableRow key={agent.id}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {agent.display_name || agent.email}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {agent.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={agent.active_total > 0 ? 'warning' : 'secondary'}>
                                                {agent.active_total}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{agent.assigned_total}</TableCell>
                                        <TableCell>{agent.resolved_30d}</TableCell>
                                        <TableCell>{formatAverage(agent.avg_first_response_minutes)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={agent.sla_overdue > 0 ? 'destructive' : 'secondary'}>
                                                    {agent.sla_overdue}
                                                </Badge>
                                                {agent.sla_at_risk > 0 && (
                                                    <Badge variant="warning">
                                                        {agent.sla_at_risk} en riesgo
                                                    </Badge>
                                                )}
                                            </div>
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
