'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Sliders, Zap, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import {
    autoAssignSupportTickets,
    applySlaEscalations,
    createSupportAutomationRule,
    deleteSupportAutomationRule,
    reassignStaleTickets,
    toggleSupportAutomationRule,
    updateAdminSupportSettings,
} from '@/lib/actions/admin-support';
import type { AdminRole } from '@/lib/actions/admin-auth';
import type { AdminSupportSettings, SupportAutomationRule, TicketCategory, TicketPriority } from '@/lib/actions/admin-support';

interface SupportSettingsClientProps {
    settings: AdminSupportSettings;
    rules: SupportAutomationRule[];
    canManageRules: boolean;
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
    TECHNICAL: 'Técnico',
    BILLING: 'Facturación',
    ACCOUNT: 'Cuenta',
    FEATURE_REQUEST: 'Sugerencia',
    OTHER: 'Otro',
};

const ROLE_LABELS: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    SUPPORT: 'Soporte',
    ANALYST: 'Analista',
};

export function SupportSettingsClient({ settings, rules, canManageRules }: SupportSettingsClientProps) {
    const [autoAssignEnabled, setAutoAssignEnabled] = useState(settings.auto_assign_enabled);
    const [autoAssignStrategy, setAutoAssignStrategy] = useState<AdminSupportSettings['auto_assign_strategy']>(
        settings.auto_assign_strategy
    );
    const [autoAssignPriorities, setAutoAssignPriorities] = useState<Set<TicketPriority>>(
        new Set(settings.auto_assign_priorities as TicketPriority[])
    );
    const [slaEscalationEnabled, setSlaEscalationEnabled] = useState(settings.sla_escalation_enabled);
    const [staleReassignEnabled, setStaleReassignEnabled] = useState(settings.stale_reassign_enabled);
    const [staleReassignHours, setStaleReassignHours] = useState<number>(settings.stale_reassign_hours || 24);
    const [isSettingsPending, startSettingsUpdate] = useTransition();
    const [isAutoAssignPending, startAutoAssign] = useTransition();
    const [isAutomationPending, startAutomation] = useTransition();
    const [rulesState, setRulesState] = useState<SupportAutomationRule[]>(rules);
    const [isRulePending, startRuleTransition] = useTransition();
    const [newRule, setNewRule] = useState({
        name: '',
        category: 'TECHNICAL' as TicketCategory,
        plan_code: 'ALL',
        set_priority: 'NONE',
        assign_role: 'NONE',
    });

    const canEditRules = useMemo(() => canManageRules, [canManageRules]);

    const togglePriority = (priority: TicketPriority) => {
        setAutoAssignPriorities((current) => {
            const next = new Set(current);
            if (next.has(priority)) {
                next.delete(priority);
            } else {
                next.add(priority);
            }
            return next;
        });
    };

    const handleSaveSettings = () => {
        if (autoAssignPriorities.size === 0) {
            toast.error('Selecciona al menos una prioridad para auto-asignar.');
            return;
        }
        startSettingsUpdate(async () => {
            const result = await updateAdminSupportSettings({
                auto_assign_enabled: autoAssignEnabled,
                auto_assign_strategy: autoAssignStrategy,
                auto_assign_priorities: Array.from(autoAssignPriorities),
                sla_escalation_enabled: slaEscalationEnabled,
                stale_reassign_enabled: staleReassignEnabled,
                stale_reassign_hours: staleReassignHours,
            });
            if (!result.success) {
                toast.error(result.error || 'No se pudo guardar la configuración.');
                return;
            }
            if (result.settings) {
                setAutoAssignEnabled(result.settings.auto_assign_enabled);
                setAutoAssignStrategy(result.settings.auto_assign_strategy);
                setAutoAssignPriorities(new Set(result.settings.auto_assign_priorities as TicketPriority[]));
                setSlaEscalationEnabled(result.settings.sla_escalation_enabled);
                setStaleReassignEnabled(result.settings.stale_reassign_enabled);
                setStaleReassignHours(result.settings.stale_reassign_hours);
            }
            toast.success('Configuración actualizada.');
        });
    };

    const handleAutoAssign = () => {
        if (autoAssignPriorities.size === 0) {
            toast.error('Selecciona al menos una prioridad para auto-asignar.');
            return;
        }
        startAutoAssign(async () => {
            const result = await autoAssignSupportTickets({
                priorities: Array.from(autoAssignPriorities),
                strategy: autoAssignStrategy,
                force: true,
            });
            if (!result.success) {
                toast.error(result.error || 'No se pudo auto-asignar.');
                return;
            }
            toast.success(`Auto-asignados ${result.updated || 0} tickets.`);
        });
    };

    const handleRunEscalation = () => {
        startAutomation(async () => {
            const result = await applySlaEscalations({ force: true });
            if (!result.success) {
                toast.error(result.error || 'No se pudo aplicar el escalamiento.');
                return;
            }
            toast.success(`Escalados ${result.updated || 0} tickets.`);
        });
    };

    const handleRunReassign = () => {
        startAutomation(async () => {
            const result = await reassignStaleTickets({ force: true, thresholdHours: staleReassignHours });
            if (!result.success) {
                toast.error(result.error || 'No se pudo reasignar.');
                return;
            }
            toast.success(`Reasignados ${result.updated || 0} tickets.`);
        });
    };

    const handleCreateRule = () => {
        if (!newRule.name.trim()) {
            toast.error('Ingresa un nombre para la regla.');
            return;
        }
        if (newRule.set_priority === 'NONE' && newRule.assign_role === 'NONE') {
            toast.error('Define una prioridad o un rol a asignar.');
            return;
        }

        startRuleTransition(async () => {
            const result = await createSupportAutomationRule({
                name: newRule.name,
                category: newRule.category,
                plan_code: newRule.plan_code === 'ALL' ? null : newRule.plan_code,
                set_priority: newRule.set_priority === 'NONE' ? null : (newRule.set_priority as TicketPriority),
                assign_role: newRule.assign_role === 'NONE' ? null : (newRule.assign_role as AdminRole),
            });

            if (!result.success || !result.rule) {
                toast.error(result.error || 'No se pudo crear la regla.');
                return;
            }

            setRulesState((prev) => [result.rule!, ...prev]);
            setNewRule({
                name: '',
                category: 'TECHNICAL',
                plan_code: 'ALL',
                set_priority: 'NONE',
                assign_role: 'NONE',
            });
            toast.success('Regla creada.');
        });
    };

    const handleToggleRule = (ruleId: string, nextValue: boolean) => {
        startRuleTransition(async () => {
            const result = await toggleSupportAutomationRule(ruleId, nextValue);
            if (!result.success) {
                toast.error(result.error || 'No se pudo actualizar la regla.');
                return;
            }
            setRulesState((prev) =>
                prev.map((rule) => (rule.id === ruleId ? { ...rule, is_active: nextValue } : rule))
            );
        });
    };

    const handleDeleteRule = (ruleId: string) => {
        startRuleTransition(async () => {
            const result = await deleteSupportAutomationRule(ruleId);
            if (!result.success) {
                toast.error(result.error || 'No se pudo eliminar la regla.');
                return;
            }
            setRulesState((prev) => prev.filter((rule) => rule.id !== ruleId));
            toast.success('Regla eliminada.');
        });
    };

    return (
        <div className="space-y-6">
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sliders className="h-5 w-5" />
                    Auto-asignación de tickets
                </CardTitle>
                <CardDescription>
                    Distribuye tickets nuevos sin asignar según carga y prioridad.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Estado</p>
                        <p className="text-xs text-muted-foreground">
                            {autoAssignEnabled ? 'Activo' : 'Desactivado'}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant={autoAssignEnabled ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setAutoAssignEnabled((prev) => !prev)}
                    >
                        {autoAssignEnabled ? 'Desactivar' : 'Activar'}
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Estrategia</Label>
                    <Select value={autoAssignStrategy} onValueChange={(value) => setAutoAssignStrategy(value as AdminSupportSettings['auto_assign_strategy'])}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Estrategia" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="LOAD_BALANCED">Balanceo por carga</SelectItem>
                            <SelectItem value="ROUND_ROBIN">Round robin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Prioridades a asignar</Label>
                    <div className="flex flex-wrap gap-2">
                        {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TicketPriority[]).map((priority) => (
                            <Button
                                key={priority}
                                type="button"
                                size="sm"
                                variant={autoAssignPriorities.has(priority) ? 'secondary' : 'outline'}
                                onClick={() => togglePriority(priority)}
                            >
                                {PRIORITY_LABELS[priority]}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        onClick={handleSaveSettings}
                        disabled={isSettingsPending}
                    >
                        {isSettingsPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando
                            </>
                        ) : (
                            'Guardar cambios'
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoAssign}
                        disabled={isAutoAssignPending}
                    >
                        {isAutoAssignPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Asignando
                            </>
                        ) : (
                            'Auto-asignar ahora'
                        )}
                    </Button>
                </div>
            </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Automatizaciones de soporte
                </CardTitle>
                <CardDescription>
                    Escalamiento por SLA y reasignación de tickets estancados.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Escalamiento SLA</p>
                        <p className="text-xs text-muted-foreground">
                            Sube la prioridad cuando el SLA se vence.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant={slaEscalationEnabled ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setSlaEscalationEnabled((prev) => !prev)}
                    >
                        {slaEscalationEnabled ? 'Activo' : 'Inactivo'}
                    </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="font-medium">Reasignación por inactividad</p>
                        <p className="text-xs text-muted-foreground">
                            Reasigna si el usuario espera demasiado.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant={staleReassignEnabled ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setStaleReassignEnabled((prev) => !prev)}
                    >
                        {staleReassignEnabled ? 'Activo' : 'Inactivo'}
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Horas sin respuesta</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={1}
                            value={staleReassignHours}
                            onChange={(event) => setStaleReassignHours(Number(event.target.value))}
                            className="h-9 w-28"
                        />
                        <span className="text-xs text-muted-foreground">horas</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleRunEscalation}
                        disabled={isAutomationPending}
                    >
                        {isAutomationPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Ejecutando
                            </>
                        ) : (
                            <>
                                <Zap className="mr-2 h-4 w-4" />
                                Escalar ahora
                            </>
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleRunReassign}
                        disabled={isAutomationPending}
                    >
                        {isAutomationPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Ejecutando
                            </>
                        ) : (
                            <>
                                <Clock className="mr-2 h-4 w-4" />
                                Reasignar estancados
                            </>
                        )}
                    </Button>
                </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        Reglas por categoría
                    </CardTitle>
                    <CardDescription>
                        Aplica prioridad o asignación automática según categoría y plan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {!canEditRules ? (
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            No tienes permisos para gestionar reglas.
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                                    <Input
                                        value={newRule.name}
                                        onChange={(event) => setNewRule((prev) => ({ ...prev, name: event.target.value }))}
                                        placeholder="Ej: Facturación crítica"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Categoría</Label>
                                    <Select
                                        value={newRule.category}
                                        onValueChange={(value) => setNewRule((prev) => ({ ...prev, category: value as TicketCategory }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Plan</Label>
                                    <Select
                                        value={newRule.plan_code}
                                        onValueChange={(value) => setNewRule((prev) => ({ ...prev, plan_code: value }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Todos</SelectItem>
                                            <SelectItem value="FREE">Free</SelectItem>
                                            <SelectItem value="PRO">Pro</SelectItem>
                                            <SelectItem value="BUSINESS">Business</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Prioridad</Label>
                                    <Select
                                        value={newRule.set_priority}
                                        onValueChange={(value) => setNewRule((prev) => ({ ...prev, set_priority: value }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">Sin cambio</SelectItem>
                                            {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs text-muted-foreground">Asignar a rol</Label>
                                    <Select
                                        value={newRule.assign_role}
                                        onValueChange={(value) => setNewRule((prev) => ({ ...prev, assign_role: value }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">Sin asignación</SelectItem>
                                            {(['SUPPORT', 'ADMIN', 'SUPER_ADMIN'] as AdminRole[]).map((role) => (
                                                <SelectItem key={role} value={role}>
                                                    {ROLE_LABELS[role]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handleCreateRule}
                                disabled={isRulePending}
                            >
                                {isRulePending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando
                                    </>
                                ) : (
                                    'Crear regla'
                                )}
                            </Button>

                            <div className="space-y-3">
                                {rulesState.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                                        No hay reglas configuradas.
                                    </div>
                                ) : (
                                    rulesState.map((rule) => (
                                        <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">{rule.name}</p>
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span>{CATEGORY_LABELS[rule.category]}</span>
                                                    {rule.plan_code && <span>Plan {rule.plan_code}</span>}
                                                    {rule.set_priority && <span>Prioridad: {PRIORITY_LABELS[rule.set_priority]}</span>}
                                                    {rule.assign_role && <span>Rol: {ROLE_LABELS[rule.assign_role as AdminRole] || rule.assign_role}</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={rule.is_active ? 'secondary' : 'outline'}
                                                    onClick={() => handleToggleRule(rule.id, !rule.is_active)}
                                                    disabled={isRulePending}
                                                >
                                                    {rule.is_active ? 'Activa' : 'Inactiva'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    disabled={isRulePending}
                                                >
                                                    Eliminar
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
