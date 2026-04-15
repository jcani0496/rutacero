'use client';

import { useMemo, useState, useTransition } from 'react';
import { Download, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmpty } from '@/components/ui/table';
import { getAuditLogs, type AuditLogEntry } from '@/lib/actions/admin-audit';

interface AuditClientProps {
    initialLogs: AuditLogEntry[];
    admins: Array<{ id: string; label: string }>;
}

const ACTION_LABELS: Record<string, string> = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    CREATE_SAVED_VIEW: 'Crear vista',
    DELETE_SAVED_VIEW: 'Eliminar vista',
    UPDATE_SUPPORT_SETTINGS: 'Actualizar soporte',
    SLA_ESCALATION: 'Escalar SLA',
    AUTO_ASSIGN_TICKETS: 'Auto-asignar',
    STALE_REASSIGN: 'Reasignar',
};

const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-GT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const getActionBadge = (action: string) => {
    if (action.includes('LOGIN')) return <Badge variant="outline">Login</Badge>;
    if (action.includes('LOGOUT')) return <Badge variant="secondary">Logout</Badge>;
    if (action.includes('CREATE')) return <Badge className="bg-emerald-500">Crear</Badge>;
    if (action.includes('UPDATE')) return <Badge variant="warning">Actualizar</Badge>;
    if (action.includes('DELETE')) return <Badge variant="destructive">Eliminar</Badge>;
    return <Badge variant="outline">{ACTION_LABELS[action] || action}</Badge>;
};

export function AuditClient({ initialLogs, admins }: AuditClientProps) {
    const [logs, setLogs] = useState(initialLogs);
    const [action, setAction] = useState('ALL');
    const [adminId, setAdminId] = useState('ALL');
    const [entityType, setEntityType] = useState('ALL');
    const [entityId, setEntityId] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [isPending, startTransition] = useTransition();

    const availableActions = useMemo(() => {
        const actions = new Set(logs.map((log) => log.action));
        return Array.from(actions).sort();
    }, [logs]);

    const availableEntityTypes = useMemo(() => {
        const types = new Set(logs.map((log) => log.entity_type));
        return Array.from(types).sort();
    }, [logs]);

    const handleApplyFilters = () => {
        startTransition(async () => {
            const data = await getAuditLogs({
                action,
                adminId,
                entityType,
                entityId: entityId.trim() || undefined,
                from: fromDate || undefined,
                to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
                limit: 300,
            });
            setLogs(data);
        });
    };

    const handleReset = () => {
        setAction('ALL');
        setAdminId('ALL');
        setEntityType('ALL');
        setEntityId('');
        setFromDate('');
        setToDate('');
        startTransition(async () => {
            const data = await getAuditLogs({ limit: 200 });
            setLogs(data);
        });
    };

    const handleExport = () => {
        const header = ['Fecha', 'Accion', 'Administrador', 'Entidad', 'Entity ID'];
        const rows = logs.map((log) => [
            formatDate(log.created_at),
            log.action,
            log.admin_name || log.admin_id,
            log.entity_type,
            log.entity_id || '',
        ]);

        const csv = [header, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/\"/g, '"')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Auditoría</h1>
                <p className="text-muted-foreground">Revisa acciones administrativas y cambios críticos.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                    <CardDescription>Refina los resultados para revisar casos específicos.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                    <Select value={action} onValueChange={setAction}>
                        <SelectTrigger>
                            <SelectValue placeholder="Acción" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas las acciones</SelectItem>
                            {availableActions.map((item) => (
                                <SelectItem key={item} value={item}>
                                    {ACTION_LABELS[item] || item}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={adminId} onValueChange={setAdminId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Administrador" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            {admins.map((admin) => (
                                <SelectItem key={admin.id} value={admin.id}>
                                    {admin.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={entityType} onValueChange={setEntityType}>
                        <SelectTrigger>
                            <SelectValue placeholder="Entidad" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas las entidades</SelectItem>
                            {availableEntityTypes.map((item) => (
                                <SelectItem key={item} value={item}>
                                    {item}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="Entity ID"
                        value={entityId}
                        onChange={(event) => setEntityId(event.target.value)}
                    />
                    <Input
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                    />
                    <Input
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2 md:col-span-3">
                        <Button onClick={handleApplyFilters} disabled={isPending}>
                            {isPending ? 'Filtrando...' : 'Aplicar filtros'}
                        </Button>
                        <Button variant="outline" onClick={handleReset} disabled={isPending}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Limpiar
                        </Button>
                        <Button variant="outline" onClick={handleExport} disabled={logs.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Exportar CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Logs recientes</CardTitle>
                    <CardDescription>{logs.length} eventos cargados</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Acción</TableHead>
                                <TableHead>Entidad</TableHead>
                                <TableHead>Admin</TableHead>
                                <TableHead>Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableEmpty
                                    title="Sin registros"
                                    description="No hay logs que coincidan con el filtro actual."
                                />
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getActionBadge(log.action)}
                                                <span className="text-xs text-muted-foreground">{ACTION_LABELS[log.action] || log.action}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono truncate">
                                                {log.entity_id || 'N/A'}
                                            </p>
                                        </TableCell>
                                        <TableCell>{log.entity_type}</TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{log.admin_name || log.admin_id.slice(0, 8)}</div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{formatDate(log.created_at)}</TableCell>
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
