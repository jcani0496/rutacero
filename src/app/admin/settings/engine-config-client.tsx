'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleNotch, Cpu, FloppyDisk, Lightning, Plus } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    activateEngineConfig,
    createDraftEngineConfig,
    updateDraftEngineConfig,
    type EngineConfigRow,
    type EngineConfigSummary,
} from '@/lib/actions/admin-engine-config';
import type { EngineConstraints, HybridEngineWeights } from '@/lib/engine/config';

interface EngineConfigClientProps {
    summary: EngineConfigSummary;
    canManage: boolean;
}

const WEIGHT_LABELS: Record<keyof HybridEngineWeights, string> = {
    w_rate: 'Tasa (APR)',
    w_balance: 'Saldo',
    w_due: 'Urgencia de vencimiento',
    w_momentum: 'Ritmo de pago',
    w_type: 'Tipo de deuda',
};

const CONSTRAINT_LABELS: Record<keyof EngineConstraints, string> = {
    max_apr_cap: 'Tope APR (%)',
    urgency_window_days: 'Ventana urgencia (días)',
    max_simulation_periods: 'Máx. periodos simulación',
    min_cash_buffer: 'Buffer mínimo efectivo',
};

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function ConfigWeightsGrid({ weights }: { weights: HybridEngineWeights }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(WEIGHT_LABELS) as (keyof HybridEngineWeights)[]).map((key) => (
                <div key={key} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">{WEIGHT_LABELS[key]}</p>
                    <p className="font-medium tabular-nums">{formatPercent(weights[key])}</p>
                </div>
            ))}
        </div>
    );
}

function ConfigConstraintsGrid({ constraints }: { constraints: EngineConstraints }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(CONSTRAINT_LABELS) as (keyof EngineConstraints)[]).map((key) => (
                <div key={key} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">{CONSTRAINT_LABELS[key]}</p>
                    <p className="font-medium tabular-nums">{constraints[key]}</p>
                </div>
            ))}
        </div>
    );
}

function DraftEditor({
    draft,
    onSaved,
}: {
    draft: EngineConfigRow;
    onSaved: () => void;
}) {
    const [version, setVersion] = useState(draft.version);
    const [weights, setWeights] = useState<HybridEngineWeights>(draft.weights);
    const [constraints, setConstraints] = useState<EngineConstraints>(draft.constraints);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isActivating, startActivate] = useTransition();

    const weightSum = useMemo(
        () => Object.values(weights).reduce((sum, value) => sum + Number(value), 0),
        [weights],
    );

    const handleSave = () => {
        setError(null);
        startTransition(async () => {
            const result = await updateDraftEngineConfig({
                id: draft.id,
                version,
                weights,
                constraints,
            });
            if (!result.success) {
                setError(result.error || 'No se pudo guardar');
                return;
            }
            onSaved();
        });
    };

    const handleActivate = () => {
        setError(null);
        startActivate(async () => {
            const saveResult = await updateDraftEngineConfig({
                id: draft.id,
                version,
                weights,
                constraints,
            });
            if (!saveResult.success) {
                setError(saveResult.error || 'No se pudo guardar antes de activar');
                return;
            }

            const result = await activateEngineConfig(draft.id);
            if (!result.success) {
                setError(result.error || 'No se pudo activar');
                return;
            }
            onSaved();
        });
    };

    return (
        <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="font-medium">Borrador: {draft.version}</p>
                    <p className="text-xs text-muted-foreground">
                        Creado {new Date(draft.created_at).toLocaleString('es-GT')}
                    </p>
                </div>
                <Badge variant="outline">DRAFT</Badge>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <Label htmlFor={`version-${draft.id}`}>Versión</Label>
                <Input
                    id={`version-${draft.id}`}
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    disabled={isPending || isActivating}
                />
            </div>

            <div className="space-y-3">
                <p className="text-sm font-medium">Pesos HYBRID (suma: {weightSum.toFixed(2)})</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(Object.keys(WEIGHT_LABELS) as (keyof HybridEngineWeights)[]).map((key) => (
                        <div key={key} className="space-y-1">
                            <Label htmlFor={`${draft.id}-${key}`}>{WEIGHT_LABELS[key]}</Label>
                            <Input
                                id={`${draft.id}-${key}`}
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={weights[key]}
                                onChange={(e) =>
                                    setWeights((prev) => ({
                                        ...prev,
                                        [key]: Number(e.target.value),
                                    }))
                                }
                                disabled={isPending || isActivating}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-sm font-medium">Restricciones</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {(Object.keys(CONSTRAINT_LABELS) as (keyof EngineConstraints)[]).map((key) => (
                        <div key={key} className="space-y-1">
                            <Label htmlFor={`${draft.id}-c-${key}`}>{CONSTRAINT_LABELS[key]}</Label>
                            <Input
                                id={`${draft.id}-c-${key}`}
                                type="number"
                                min={0}
                                value={constraints[key]}
                                onChange={(e) =>
                                    setConstraints((prev) => ({
                                        ...prev,
                                        [key]: Number(e.target.value),
                                    }))
                                }
                                disabled={isPending || isActivating}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSave} disabled={isPending || isActivating}>
                    {isPending ? (
                        <>
                            <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        <>
                            <FloppyDisk className="mr-2 h-4 w-4" />
                            Guardar borrador
                        </>
                    )}
                </Button>
                <Button
                    type="button"
                    variant="default"
                    onClick={handleActivate}
                    disabled={isPending || isActivating}
                >
                    {isActivating ? (
                        <>
                            <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                            Activando…
                        </>
                    ) : (
                        <>
                            <Lightning className="mr-2 h-4 w-4" />
                            Activar
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

export function EngineConfigClient({ summary, canManage }: EngineConfigClientProps) {
    const router = useRouter();
    const [drafts, setDrafts] = useState(summary.drafts);
    const [error, setError] = useState<string | null>(null);
    const [isCreating, startCreate] = useTransition();

    const refresh = () => router.refresh();

    const handleCreateDraft = () => {
        setError(null);
        startCreate(async () => {
            const result = await createDraftEngineConfig();
            if (!result.success || !result.config) {
                setError(result.error || 'No se pudo crear el borrador');
                return;
            }
            setDrafts((prev) => [result.config!, ...prev]);
            refresh();
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Cpu {...ICON} className="h-5 w-5" />
                    Motor de cálculo (HYBRID)
                </CardTitle>
                <CardDescription>
                    Configuración activa del motor de priorización. Solo los cinco pesos HYBRID
                    implementados están expuestos aquí.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">Configuración activa</p>
                        <Badge variant="success">ACTIVE</Badge>
                        <Badge variant="outline">v{summary.active.version}</Badge>
                        {summary.active.source === 'default' && (
                            <Badge variant="secondary">Hardcoded fallback</Badge>
                        )}
                    </div>
                    {summary.active.activated_at && (
                        <p className="text-xs text-muted-foreground">
                            Activada: {new Date(summary.active.activated_at).toLocaleString('es-GT')}
                        </p>
                    )}
                    <ConfigWeightsGrid weights={summary.active.weights} />
                    <ConfigConstraintsGrid constraints={summary.active.constraints} />
                </div>

                {canManage && (
                    <div className="space-y-4 border-t pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="font-medium">Borradores</p>
                                <p className="text-sm text-muted-foreground">
                                    Solo SUPER_ADMIN puede crear, editar y activar configuraciones.
                                </p>
                            </div>
                            <Button type="button" variant="outline" onClick={handleCreateDraft} disabled={isCreating}>
                                {isCreating ? (
                                    <>
                                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                                        Creando…
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nuevo borrador
                                    </>
                                )}
                            </Button>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {drafts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No hay borradores. Crea uno para ajustar pesos y restricciones antes de activar.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {drafts.map((draft) => (
                                    <DraftEditor key={draft.id} draft={draft} onSaved={refresh} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
