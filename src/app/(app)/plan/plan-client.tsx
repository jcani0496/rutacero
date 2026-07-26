'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Calendar,
    CaretDown,
    CheckCircle,
    CircleNotch,
    Clock,
    CurrencyDollar,
    DownloadSimple,
    Lightning,
    Money,
    Scales,
    Sparkle,
    Target,
    Trash,
    TrendDown,
    WarningCircle
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';


import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import { generatePlan, setActivePlan, deletePlan } from '@/lib/actions/plans';
import { archiveCurrentPlan } from '@/lib/actions/plan-recalculation';
import { exportPlanReportCSV } from '@/lib/actions/export';
import { PlanTimeline } from '@/components/plan/PlanTimeline';
import { RationaleList } from '@/components/plan/RationaleCard';
import { RecalculationAlert } from '@/components/plan/RecalculationAlert';
import { WhatIfSimulator } from '@/components/features/what-if-simulator';
import { UpgradeLimitModal } from '@/components/features/upgrade-limit-modal';
import { DropoffCapture } from '@/components/funnel/dropoff-capture';
import { toast } from '@/components/ui/toast';
import type { Plan, PlanItem, Debt } from '@/types';
import type { PlanComparison, PayoffStrategy } from '@/lib/engine/types';
import type { BudgetShortfallIssue } from '@/lib/plans/contracts';
import {
    planCoverageCopy,
    resolveNextPlanPayment,
    type PlanPaymentCoverage,
} from '@/lib/plans/next-payment';

interface RecalculationStatus {
    needsRecalculation: boolean;
    reasons: string[];
    lastPlanDate: string | null;
    changedDebtsCount: number;
    changedIncomesCount: number;
}

interface PlanClientProps {
    plans: Plan[];
    comparison: PlanComparison | null;
    comparisonIssue?: BudgetShortfallIssue | null;
    hasDebts: boolean;
    userCurrency: string;
    planItems?: PlanItem[] | null;
    recalculationStatus?: RecalculationStatus;
    debts?: Debt[];
    isPro?: boolean;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    upgradeTitle?: string;
    upgradeDescription?: string;
    upgradeCtaLabel?: string;
    upgradeCtaHref?: string;
    upgradeBullets?: string[];
    upgradePricingHref?: string;
    /** Set when returning from Pagos after registering a plan payment. */
    initialPaymentStatus?: PlanPaymentCoverage | null;
}

const STRATEGIES = [
    {
        id: 'AVALANCHE' as PayoffStrategy,
        name: 'Avalancha',
        icon: TrendDown,
        description: 'Paga primero las deudas con mayor tasa de interés. Minimiza el interés total pagado.',
        pros: ['Menor interés total', 'Más eficiente matemáticamente'],
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
    },
    {
        id: 'SNOWBALL' as PayoffStrategy,
        name: 'Bola de Nieve',
        icon: Lightning,
        description: 'Paga primero las deudas más pequeñas. Genera momentum y motivación rápidamente.',
        pros: ['Victorias rápidas', 'Mayor motivación'],
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
    },
    {
        id: 'HYBRID' as PayoffStrategy,
        name: 'Híbrido',
        icon: Scales,
        description: 'Combina lo mejor de ambos métodos. Balancea eficiencia financiera con motivación.',
        pros: ['Equilibrio óptimo', 'Personalizable'],
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
    },
];

export function PlanClient({
    plans,
    comparison,
    comparisonIssue = null,
    hasDebts,
    userCurrency,
    planItems,
    recalculationStatus,
    debts = [],
    isPro = false,
    monthlyIncome,
    monthlyExpenses,
    upgradeTitle = 'Ya generaste el plan. PRO te ayuda a ejecutarlo mejor.',
    upgradeDescription = 'Subí a PRO si querés comparar estrategias, fijar metas por deuda y simular pagos extra antes de comprometerte.',
    upgradeCtaLabel = 'Activar PRO',
    upgradeCtaHref = '/checkout?cta_context=plan',
    upgradeBullets = [
        'Compará estrategias y escenarios antes de cambiar tu plan.',
        'Definí metas por deuda y dejá que el plan se ajuste.',
        'Exportá avances y tené más contexto para seguimiento.',
    ],
    upgradePricingHref = '/pricing',
    initialPaymentStatus = null,
}: PlanClientProps) {
    const router = useRouter();
    const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategy | null>(
        comparison?.recommendation ?? null,
    );
    const [isPending, startTransition] = useTransition();
    const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [paymentFeedback, setPaymentFeedback] = useState<PlanPaymentCoverage | null>(
        initialPaymentStatus,
    );

    const activePlan = plans.find(p => p.active);
    const debtGoals = debts.filter((debt) =>
        Number(debt.goal_extra_payment || 0) > 0 || debt.goal_target_date
    );
    const goalOverrides =
        activePlan?.assumptions &&
        typeof activePlan.assumptions === 'object' &&
        'goalOverrides' in activePlan.assumptions
            ? (activePlan.assumptions as {
                goalOverrides?: Record<string, {
                    extraPayment?: number;
                    targetDate?: string | null;
                    targetPayment?: number | null;
                    monthsToTarget?: number | null;
                }>;
            }).goalOverrides || {}
            : {};

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: userCurrency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-GT', {
            month: 'short',
            year: 'numeric',
        });
    };

    const focusDebtId =
        activePlan?.assumptions &&
        typeof activePlan.assumptions === 'object' &&
        'focusDebtId' in activePlan.assumptions
            ? (activePlan.assumptions as { focusDebtId?: string }).focusDebtId
            : undefined;

    const nextPlanPayment = useMemo(
        () => resolveNextPlanPayment(planItems, focusDebtId),
        [planItems, focusDebtId],
    );

    const registerPaymentHref = nextPlanPayment
        ? `/payments?debtId=${encodeURIComponent(nextPlanPayment.debtId)}&amount=${nextPlanPayment.suggestedAmount}&fromPlan=1`
        : '/payments';

    useEffect(() => {
        if (!initialPaymentStatus) return;
        const copy = planCoverageCopy(initialPaymentStatus);
        toast.success(copy.title, { description: copy.description });
        router.replace('/plan', { scroll: false });
    }, [initialPaymentStatus, router]);

    const getComparisonData = (strategyId: PayoffStrategy) => {
        if (!comparison) return null;
        switch (strategyId) {
            case 'AVALANCHE': return comparison.avalanche;
            case 'SNOWBALL': return comparison.snowball;
            case 'HYBRID': return comparison.hybrid;
        }
    };

    const handleGeneratePlan = (strategy: PayoffStrategy) => {
        startTransition(async () => {
            try {
                const result = await generatePlan({ strategy });
                if (!result.ok) {
                    if (result.issue.effectiveBudget <= 0) {
                        toast.error('Aún no registraste tus ingresos', {
                            description: 'Para calcular tu plan necesitamos saber cuánto te ingresa al mes. Agregalo en Finanzas y volvé a generar tu plan.',
                            action: {
                                label: 'Ir a Finanzas',
                                onClick: () => router.push('/finances'),
                            },
                        });
                    } else {
                        toast.error('Presupuesto insuficiente para tu plan', {
                            description: `Tu presupuesto efectivo (${formatCurrency(result.issue.effectiveBudget)}) no cubre los pagos mínimos (${formatCurrency(result.issue.requiredMinPayments)}). ` +
                                `Estás reservando ${result.issue.safetyBufferPct}% como buffer.`,
                        });
                    }
                    return;
                }

                await setActivePlan(result.data.id);
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'No se pudo generar el plan';
                toast.error('No se pudo generar el plan', { description: msg });
            }
        });
    };

    const handleDeletePlan = (planId: string) => {
        startTransition(async () => {
            try {
                await deletePlan(planId);
                setShowDeleteDialog(null);
            } catch (error) {
                const description = error instanceof Error ? error.message : 'Intenta nuevamente.';
                toast.error('No se pudo eliminar el plan', { description });
            }
        });
    };

    const handleExportPlan = async () => {
        if (!isPro) {
            setShowUpgradeModal(true);
            return;
        }

        setIsExporting(true);
        try {
            const result = await exportPlanReportCSV();
            if (result.success && result.data) {
                const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `plan_rutacero_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(link.href);
                toast.success('Reporte exportado', {
                    description: 'Tu plan avanzado se descargó correctamente.',
                });
            } else if (result.requiresUpgrade) {
                setShowUpgradeModal(true);
            } else if (result.error) {
                toast.error('No se pudo exportar', { description: result.error });
            }
        } catch {
            toast.error('No se pudo exportar', { description: 'Intenta nuevamente.' });
        } finally {
            setIsExporting(false);
        }
    };

    // No debts view
    if (!hasDebts) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Tu Plan de Pagos
                    </h1>
                    <p className="text-muted-foreground">
                        Creá un plan personalizado para salir de deudas
                    </p>
                </div>

                <Alert>
                    <WarningCircle className="h-4 w-4" />
                    <AlertTitle>Sin deudas registradas</AlertTitle>
                    <AlertDescription>
                        Para generar un plan de pagos, primero necesitás agregar tus deudas.
                    </AlertDescription>
                </Alert>

                <Button asChild>
                    <Link href="/debts">
                        Ir a Deudas
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
        );
    }

    // No active plan - show strategy selection
    if (!activePlan) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Selecciona tu Estrategia
                    </h1>
                    <p className="text-muted-foreground">
                        Compará los métodos y elegí el que mejor se adapte a tu situación
                    </p>
                </div>

                {comparisonIssue && (
                    comparisonIssue.effectiveBudget <= 0 ? (
                        <Alert>
                            <WarningCircle className="h-4 w-4" />
                            <AlertTitle>Aún no registraste tus ingresos</AlertTitle>
                            <AlertDescription>
                                <div className="space-y-3">
                                    <p>
                                        Para calcular tu plan necesitamos saber cuánto te ingresa al mes.
                                        Agregalo en Finanzas y volvé a generar tu plan.
                                    </p>
                                    <Button size="sm" asChild>
                                        <Link href="/finances">
                                            Ir a Finanzas
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="destructive">
                            <WarningCircle className="h-4 w-4" />
                            <AlertTitle>Presupuesto insuficiente</AlertTitle>
                            <AlertDescription>
                                Tu presupuesto efectivo ({formatCurrency(comparisonIssue.effectiveBudget)}) no cubre los pagos mínimos
                                ({formatCurrency(comparisonIssue.requiredMinPayments)}). Actualmente reservamos{' '}
                                {comparisonIssue.safetyBufferPct}% como buffer de seguridad. Ajusta ingresos/gastos o reduce el buffer en configuración.
                            </AlertDescription>
                        </Alert>
                    )
                )}

                {comparison && (
                    <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
                        <Sparkle className="h-4 w-4 text-emerald-500" />
                        <AlertTitle className="text-emerald-700 dark:text-emerald-400">
                            Según lo que elegiste: {STRATEGIES.find(s => s.id === comparison.recommendation)?.name || comparison.recommendation}
                        </AlertTitle>
                        <AlertDescription className="text-emerald-600 dark:text-emerald-300">
                            <div className="space-y-2">
                                <p className="text-xs italic opacity-90">
                                    Este resultado proviene de un cálculo determinístico sobre los datos que tú ingresaste. No es una recomendación profesional.
                                </p>
                                <p>{comparison.recommendationReason}</p>
                                {comparison.recommendationMeta?.drivers?.length ? (
                                    <ul className="list-disc pl-4">
                                        {comparison.recommendationMeta.drivers.slice(0, 3).map((d) => (
                                            <li key={d}>{d}</li>
                                        ))}
                                    </ul>
                                ) : null}
                                {typeof comparison.recommendationMeta?.confidence === 'number' ? (
                                    <p className="text-xs opacity-90">
                                        Confiabilidad estimada: {Math.round(comparison.recommendationMeta.confidence * 100)}%
                                    </p>
                                ) : null}
                                {comparison.recommendationRange ? (
                                    <p className="text-xs opacity-90">
                                        Rango (según día de pago): {comparison.recommendationRange.monthsToPayoff.min}-
                                        {comparison.recommendationRange.monthsToPayoff.max} meses, interés{' '}
                                        {formatCurrency(comparison.recommendationRange.totalInterest.min)}-
                                        {formatCurrency(comparison.recommendationRange.totalInterest.max)}.
                                    </p>
                                ) : null}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {comparison && (
                    <Collapsible className="rounded-lg border border-border/60 bg-muted/30">
                        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/50">
                            <span>¿Cómo funciona este cálculo?</span>
                            <CaretDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="border-t border-border/60 px-4 py-4 text-sm text-muted-foreground space-y-3">
                            <p>
                                Este plan se calcula con un algoritmo determinístico sobre los
                                datos que tú ingresaste manualmente.
                            </p>
                            <div>
                                <p className="font-medium text-foreground mb-2">
                                    Supuestos del cálculo:
                                </p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <li>
                                        <strong>Tasa de interés constante:</strong> la tasa que
                                        tú indicaste se aplica durante toda la simulación.
                                    </li>
                                    <li>
                                        <strong>Pagos puntuales:</strong> el plan asume que pagas
                                        en la fecha indicada cada mes.
                                    </li>
                                    <li>
                                        <strong>No incluye eventos extras:</strong> comisiones,
                                        cargos por mora, cambios de tasa por parte del acreedor,
                                        o promociones de tu institución NO están incluidos.
                                    </li>
                                    <li>
                                        <strong>No consulta tu buró de crédito:</strong> los
                                        cálculos no reflejan tu historial crediticio real.
                                    </li>
                                </ul>
                            </div>
                            <p>
                                Si el plan muestra Q1,234 de interés total y la realidad termina
                                siendo distinta, la diferencia se debe a estos supuestos. La
                                información de tu acreedor siempre prevalece sobre la de
                                RutaCero.
                            </p>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    {STRATEGIES.map((strategy) => {
                        const Icon = strategy.icon;
                        const isSelected = selectedStrategy === strategy.id;
                        const data = getComparisonData(strategy.id);
                        const isRecommended = comparison?.recommendation === strategy.id;

                        return (
                            <Card
                                key={strategy.id}
                                className={cn(
                                    'relative cursor-pointer transition-all hover:shadow-lg',
                                    isSelected && 'border-primary ring-2 ring-primary/20',
                                    isRecommended && !isSelected && 'border-emerald-500/50'
                                )}
                                onClick={() => setSelectedStrategy(strategy.id)}
                            >
                                {isRecommended && (
                                    <div className="absolute -top-3 left-4">
                                        <Badge className="bg-emerald-500 text-white">
                                            Sugerida
                                        </Badge>
                                    </div>
                                )}
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'flex size-12 items-center justify-center rounded-xl',
                                            strategy.bgColor
                                        )}>
                                            <Icon className={cn('size-6', strategy.color)} />
                                        </div>
                                        <div>
                                            <CardTitle>{strategy.name}</CardTitle>
                                            {isSelected && (
                                                <Badge variant="secondary" className="mt-1">
                                                    Seleccionado
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        {strategy.description}
                                    </p>

                                    {data && (
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div className="rounded-xl bg-muted/50 p-3">
                                                <p className="text-lg font-semibold">
                                                    {data.monthsToPayoff}
                                                </p>
                                                <p className="text-xs text-muted-foreground">meses</p>
                                            </div>
                                            <div className="rounded-xl bg-muted/50 p-3">
                                                <p className="text-lg font-semibold">
                                                    {formatCurrency(data.totalInterest)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    interés total
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                            Ventajas:
                                        </p>
                                        <ul className="space-y-1">
                                            {strategy.pros.map((pro, i) => (
                                                <li
                                                    key={i}
                                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                                >
                                                    <CheckCircle className="size-3 text-emerald-500" />
                                                    {pro}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={isSelected ? 'default' : 'outline'}
                                        disabled={isPending || !!comparisonIssue}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleGeneratePlan(strategy.id);
                                        }}
                                    >
                                        {isPending && selectedStrategy === strategy.id ? (
                                            <>
                                                <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                                                Generando...
                                            </>
                                        ) : isSelected ? (
                                            'Activar Plan'
                                        ) : (
                                            'Seleccionar'
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Active plan view
    const strategyInfo = STRATEGIES.find(s => s.id === activePlan.strategy);
    const etaDate = new Date(activePlan.eta_debt_free);
    const monthsRemaining = Math.max(0, Math.ceil(
        (etaDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    ));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Mi Plan de Pagos
                    </h1>
                    <p className="text-muted-foreground">
                        Estrategia {strategyInfo?.name || activePlan.strategy} · Activo desde{' '}
                        {new Date(activePlan.created_at).toLocaleDateString('es-GT', {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPlan}
                        disabled={isExporting}
                    >
                        {isExporting ? (
                            <CircleNotch {...ICON} className="mr-2 size-4 animate-spin" />
                        ) : (
                            <DownloadSimple className="mr-2 size-4" />
                        )}
                        Exportar Plan
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteDialog(activePlan.id)}
                    >
                        <Trash className="mr-2 size-4" />
                        Eliminar Plan
                    </Button>
                </div>
            </div>

            {/* Recalculation Alert */}
            {recalculationStatus && recalculationStatus.needsRecalculation && (
                <RecalculationAlert
                    needsRecalculation={recalculationStatus.needsRecalculation}
                    reasons={recalculationStatus.reasons}
                    lastPlanDate={recalculationStatus.lastPlanDate}
                    onRecalculate={async () => {
                        // Archive current plan and delete to trigger new plan selection
                        await archiveCurrentPlan();
                        // Page will refresh showing strategy selection
                        window.location.reload();
                    }}
                />
            )}

            {paymentFeedback && (
                <Alert className="border-primary/30 bg-primary/5">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <AlertTitle>{planCoverageCopy(paymentFeedback).title}</AlertTitle>
                    <AlertDescription>
                        {planCoverageCopy(paymentFeedback).description}
                    </AlertDescription>
                </Alert>
            )}

            {nextPlanPayment && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                                <Money className="size-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">Próximo pago del plan</p>
                                <p className="text-xl font-bold text-foreground">
                                    {formatCurrency(nextPlanPayment.suggestedAmount)}
                                    {nextPlanPayment.creditor ? (
                                        <span className="ml-2 text-base font-medium text-muted-foreground">
                                            · {nextPlanPayment.creditor}
                                        </span>
                                    ) : null}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Monto sugerido para este período. Registralo cuando lo hayas pagado.
                                </p>
                            </div>
                        </div>
                        <Button asChild className="w-full sm:w-auto">
                            <Link href={registerPaymentHref}>
                                <Calendar className="mr-2 size-4" />
                                Registrar este pago
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
                            <Target className="size-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Libre de deudas</p>
                            <p className="text-xl font-bold text-primary">
                                {etaDate.toLocaleDateString('es-GT', {
                                    month: 'short',
                                    year: 'numeric',
                                })}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/70">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                            <Clock className="size-6 text-foreground" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tiempo restante</p>
                            <p className="text-xl font-bold text-foreground">
                                {monthsRemaining} meses
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/70">
                    <CardContent className="flex items-center gap-4 pt-6">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                            <CurrencyDollar className="size-6 text-foreground" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pago promedio</p>
                            <p className="text-xl font-bold text-foreground">
                                {formatCurrency(Number(activePlan.avg_payment))}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {!isPro && activePlan && (
                <Card className="border-primary/25 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5">
                    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <CardTitle className="flex items-center gap-2">
                                <Sparkle className="size-5 text-primary" />
                                {upgradeTitle}
                            </CardTitle>
                            <CardDescription>
                                {upgradeDescription}
                            </CardDescription>
                        </div>
                        <Button asChild>
                            <Link href={upgradeCtaHref}>
                                <Sparkle className="mr-2 size-4" />
                                {upgradeCtaLabel}
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                                <p className="text-xs text-muted-foreground">Tu fecha libre de deudas</p>
                                <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {etaDate.toLocaleDateString('es-GT', { month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                                <p className="text-xs text-muted-foreground">Interés estimado del plan</p>
                                <p className="mt-1 text-lg font-bold text-foreground">
                                    {formatCurrency(Number(activePlan.interest_estimate || 0))}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                                <p className="text-xs text-muted-foreground">Pago promedio mensual</p>
                                <p className="mt-1 text-lg font-bold text-foreground">
                                    {formatCurrency(Number(activePlan.avg_payment || 0))}
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {upgradeBullets.map((item) => (
                                <div key={item} className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground">Desbloqueo inmediato</p>
                                    <p className="mt-2">{item}</p>
                                </div>
                            ))}
                        </div>
                        <DropoffCapture surface="plan" className="bg-background/80" />
                    </CardContent>
                </Card>
            )}

            {(debtGoals.length > 0 || isPro) && (
                <Card className="border-border/60">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkle className="size-5 text-amber-500" />
                                Metas activas
                            </CardTitle>
                            <CardDescription>
                                {debtGoals.length > 0
                                    ? 'Estas metas están ajustando tu plan actual.'
                                    : 'Activá metas por deuda para acelerar tu plan.'}
                            </CardDescription>
                        </div>
                        <Badge variant="secondary">PRO</Badge>
                    </CardHeader>
                    <CardContent>
                        {debtGoals.length === 0 ? (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Define pagos extra o fechas objetivo por deuda.
                                </p>
                                <Button size="sm" variant="outline" asChild>
                                    <Link href="/debts">Configurar metas</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    <span>{debtGoals.length} meta{debtGoals.length !== 1 ? 's' : ''} activa{debtGoals.length !== 1 ? 's' : ''}</span>
                                    <Badge variant="secondary">
                                        Extra total {formatCurrency(debtGoals.reduce((sum, d) => sum + Number(d.goal_extra_payment || 0), 0))}
                                    </Badge>
                                    {!isPro && (
                                        <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                                            Solo lectura
                                        </Badge>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {debtGoals.slice(0, 4).map((debt) => {
                                        const override = goalOverrides[debt.id];
                                        const targetPayment = override?.targetPayment ?? null;
                                        const targetDate = override?.targetDate ?? debt.goal_target_date ?? null;
                                        const monthsToTarget = override?.monthsToTarget ?? null;
                                        const statusLabel = monthsToTarget && monthsToTarget <= 6
                                            ? 'Meta cercana'
                                            : targetDate
                                                ? 'Meta programada'
                                                : 'Pago extra';

                                        return (
                                            <div key={debt.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="font-medium text-foreground">{debt.creditor}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {debt.goal_extra_payment ? `Extra ${formatCurrency(Number(debt.goal_extra_payment))}` : 'Sin extra'}
                                                        {targetDate ? ` · Meta ${formatDate(targetDate)}` : ''}
                                                        {targetPayment ? ` · Pago objetivo ${formatCurrency(Math.round(Number(targetPayment)))}` : ''}
                                                    </p>
                                                </div>
                                                <Badge variant={statusLabel === 'Meta cercana' ? 'destructive' : 'secondary'}>
                                                    {statusLabel}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-end">
                                    {isPro ? (
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href="/debts">Editar metas</Link>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={upgradePricingHref}>Actualizar a PRO</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {strategyInfo && <strategyInfo.icon className={cn('size-5', strategyInfo.color)} />}
                        Método {strategyInfo?.name}
                    </CardTitle>
                    <CardDescription>
                        {strategyInfo?.description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                        <p className="text-sm text-muted-foreground mb-1">Interés estimado</p>
                        <p className="text-2xl font-bold">
                            {formatCurrency(Number(activePlan.interest_estimate))}
                        </p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="text-sm text-muted-foreground mb-1">Períodos del plan</p>
                        <p className="text-2xl font-bold">
                            {activePlan.horizon_periods} meses
                        </p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                        <Link href={registerPaymentHref}>
                            <Calendar className="mr-2 size-4" />
                            {nextPlanPayment ? 'Registrar este pago' : 'Registrar pago'}
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            {/* Payment Calendar Timeline */}
            {planItems && planItems.length > 0 && (
                <PlanTimeline
                    items={planItems}
                    currency={userCurrency}
                    focusDebtId={activePlan.assumptions && typeof activePlan.assumptions === 'object' && 'focusDebtId' in activePlan.assumptions
                        ? (activePlan.assumptions as { focusDebtId?: string }).focusDebtId
                        : undefined}
                />
            )}

            {/* Rationale Explanation */}
            {planItems && planItems.length > 0 && (() => {
                // Extract unique debts with their priority and rationale from first period
                const seenDebtIds = new Set<string>();
                const debtsWithPriority = planItems
                    .filter(item => {
                        if (seenDebtIds.has(item.debt_id)) return false;
                        seenDebtIds.add(item.debt_id);
                        return true;
                    })
                    .sort((a, b) => a.priority_order - b.priority_order)
                    .map((item, index) => ({
                        id: item.debt_id,
                        creditor: item.debt?.creditor || `Deuda ${item.debt_id.slice(0, 8)}`,
                        priorityOrder: index + 1,
                        rationale: item.rationale && typeof item.rationale === 'object' && 'factors' in item.rationale
                            ? item.rationale as { factors: Array<{ name: string; value: string; weight: number; impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'; explanation: string }>; summary: string }
                            : undefined,
                    }));

                return debtsWithPriority.some(d => d.rationale) ? (
                    <RationaleList debts={debtsWithPriority} />
                ) : null;
            })()}

            {/* Delete Dialog */}
            <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este plan?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Podrás generar un nuevo plan después.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => showDeleteDialog && handleDeletePlan(showDeleteDialog)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isPending ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* What-If Simulator - PRO Feature */}
            {hasDebts && (
                <WhatIfSimulator
                    debts={debts}
                    userCurrency={userCurrency}
                    isPro={isPro}
                    monthlyIncome={monthlyIncome}
                    monthlyExpenses={monthlyExpenses}
                />
            )}

            <UpgradeLimitModal
                open={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureType="export"
            />
        </div>
    );
}
