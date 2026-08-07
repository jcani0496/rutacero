'use client';

import { useMemo, useState, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    ChartLine,
    Tray,
    Info,
    Scales,
    TrendDown,
    TrendUp
} from '@phosphor-icons/react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FinancialDisclaimer } from '@/components/legal/financial-disclaimer';
import { cn } from '@/lib/utils';
import {
    DEFAULT_GRANULARITY,
    GRANULARITIES,
    formatCurrency,
    granularityLabel,
    periodLabel,
    type Granularity,
    type MovimientosBucket,
    type MovimientosResult,
} from '@/lib/movimientos';
import { getMovimientosAggregates } from '@/lib/actions/movimientos';

const INCOME_COLOR = 'var(--chart-2)'; // theme-aware green
const EXPENSE_COLOR = 'var(--muted-foreground)'; // theme-aware slate
const BALANCE_COLOR = 'var(--chart-1)'; // theme-aware sky
const EMPTY_COLOR = 'var(--border)'; // theme-aware placeholder

interface MovimientosClientProps {
    initialResult: MovimientosResult;
}

interface ChartRow extends MovimientosBucket {
    incomeDisplay: number;
    expenseDisplay: number;
    incomeIsEmpty: boolean;
    expenseIsEmpty: boolean;
}

function nonEmptyCount(result: MovimientosResult): number {
    return result.buckets.filter((b) => !b.isEmpty).length;
}

function detectMissingSeries(result: MovimientosResult): Array<'income' | 'expense'> {
    if (!result.hasData) return [];
    const missing: Array<'income' | 'expense'> = [];
    if (result.totals.income === 0) missing.push('income');
    if (result.totals.expense === 0) missing.push('expense');
    return missing;
}

function buildChartRows(buckets: MovimientosBucket[]): ChartRow[] {
    return buckets.map((b) => {
        // Recharts hides bars with value 0 — to show an "empty" placeholder
        // we feed a tiny synthetic height (rendered slate-200) so the user
        // sees the bucket exists.
        const incomeIsEmpty = b.income === 0;
        const expenseIsEmpty = b.expense === 0;
        return {
            ...b,
            incomeDisplay: b.income,
            expenseDisplay: b.expense,
            incomeIsEmpty,
            expenseIsEmpty,
        };
    });
}

interface MovimientosTooltipProps {
    active?: boolean;
    payload?: Array<{ payload?: ChartRow }>;
    currency: string;
}

function MovimientosTooltip({
    active,
    payload,
    currency,
}: MovimientosTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    const datum = payload[0]?.payload;
    if (!datum) return null;

    const noData = datum.isEmpty;

    return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md min-w-[180px]">
            <p className="font-semibold mb-1">{datum.longLabel}</p>
            {noData ? (
                <p className="text-muted-foreground">Sin datos registrados en este periodo.</p>
            ) : (
                <ul className="space-y-0.5">
                    <li className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="inline-block h-2 w-2 rounded-sm"
                                style={{ backgroundColor: INCOME_COLOR }}
                            />
                            Ingresos
                        </span>
                        <span className="font-medium">{formatCurrency(datum.income, currency)}</span>
                    </li>
                    <li className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="inline-block h-2 w-2 rounded-sm"
                                style={{ backgroundColor: EXPENSE_COLOR }}
                            />
                            Gastos
                        </span>
                        <span className="font-medium">{formatCurrency(datum.expense, currency)}</span>
                    </li>
                    <li className="flex items-center justify-between gap-3 border-t border-border/60 pt-1 mt-1">
                        <span className="flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="inline-block h-2 w-2 rounded-sm"
                                style={{ backgroundColor: BALANCE_COLOR }}
                            />
                            Balance
                        </span>
                        <span
                            className={cn(
                                'font-semibold',
                                datum.balance >= 0 ? 'text-[var(--rc-teal-text)]' : 'text-warning',
                            )}
                        >
                            {formatCurrency(datum.balance, currency)}
                        </span>
                    </li>
                </ul>
            )}
        </div>
    );
}

export function MovimientosClient({ initialResult }: MovimientosClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [result, setResult] = useState<MovimientosResult>(initialResult);
    const [isPending, startTransition] = useTransition();

    const granularity: Granularity = result.granularity;
    const currency = result.currency;
    const nonEmpty = nonEmptyCount(result);
    const missing = detectMissingSeries(result);

    const chartRows = useMemo(() => buildChartRows(result.buckets), [result.buckets]);

    const handleGranularityChange = useCallback(
        (next: string) => {
            const value = (GRANULARITIES as readonly string[]).includes(next)
                ? (next as Granularity)
                : DEFAULT_GRANULARITY;

            // Push the new URL — the server component will re-fetch on
            // navigation, but the client component already has the data; we
            // also kick off a server-action fetch so the result is fresh
            // (caching keeps it cheap).
            const params = new URLSearchParams(searchParams?.toString() ?? '');
            params.set('granularity', value);
            router.push(`?${params.toString()}`, { scroll: false });

            startTransition(async () => {
                try {
                    const next = await getMovimientosAggregates({ granularity: value });
                    setResult(next);
                } catch (err) {
                    console.error('[movimientos] failed to load granularity', err);
                }
            });
        },
        [router, searchParams],
    );

    const period = periodLabel(granularity);
    const balanceColorClass = result.totals.balance >= 0 ? 'text-[var(--rc-teal-text)]' : 'text-warning';

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link
                            href="/finances"
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            Finanzas
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Movimientos
                    </h1>
                    <p className="text-muted-foreground">
                        Visualizá cómo se distribuyen tus ingresos y gastos en distintos periodos.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5 sm:items-end">
                    <label
                        htmlFor="movimientos-granularity"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Granularidad
                    </label>
                    <Select value={granularity} onValueChange={handleGranularityChange}>
                        <SelectTrigger
                            id="movimientos-granularity"
                            className="w-[180px]"
                            aria-label="Seleccioná la granularidad temporal"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {GRANULARITIES.map((g) => (
                                <SelectItem key={g} value={g}>
                                    {granularityLabel(g)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Ingreso de {period}
                        </CardTitle>
                        <TrendUp className="h-4 w-4 text-success" aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {formatCurrency(result.totals.income, currency)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Gasto de {period}
                        </CardTitle>
                        <TrendDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {formatCurrency(result.totals.expense, currency)}
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className={cn(
                        result.totals.balance >= 0
                            ? 'border-primary/20 bg-accent'
                            : 'border-warning/20 bg-warning/5',
                    )}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Balance de {period}
                        </CardTitle>
                        <Scales className={cn('h-4 w-4', balanceColorClass)} aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                        <div className={cn('text-2xl font-bold', balanceColorClass)}>
                            {formatCurrency(result.totals.balance, currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {result.totals.balance >= 0
                                ? 'Tus ingresos superan tus gastos en este periodo.'
                                : 'Tus gastos superan tus ingresos en este periodo.'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Missing-series banner */}
            {missing.length > 0 && (
                <div
                    role="status"
                    className="flex items-start gap-2 rounded-md border border-primary/20 bg-accent px-3 py-2 text-xs text-[var(--rc-teal-text)]"
                >
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p>
                        {missing.includes('income') && missing.includes('expense')
                            ? 'Faltan registros de ingresos y gastos para algunos periodos.'
                            : missing.includes('income')
                                ? 'Faltan registros de ingresos para algunos periodos.'
                                : 'Faltan registros de gastos para algunos periodos.'}
                    </p>
                </div>
            )}

            {/* Chart / state cards */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ChartLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Línea de tiempo
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!result.hasData ? (
                        <EmptyState />
                    ) : nonEmpty < 2 ? (
                        <InsufficientDataState />
                    ) : (
                        <ChartView
                            rows={chartRows}
                            granularity={granularity}
                            currency={currency}
                            isPending={isPending}
                        />
                    )}
                </CardContent>
            </Card>

            <FinancialDisclaimer
                variant="compact"
                text={
                    'Esta vista muestra los movimientos que has registrado en RutaCero. ' +
                    'Los totales pueden diferir de tu cuenta real si no has registrado todos ' +
                    'los movimientos. No constituye asesoría financiera.'
                }
            />
        </div>
    );
}

function ChartView({
    rows,
    granularity,
    currency,
    isPending,
}: {
    rows: ChartRow[];
    granularity: Granularity;
    currency: string;
    isPending: boolean;
}) {
    // Diario needs horizontal scroll on mobile (90 points).
    const isHighCardinality = granularity === 'diario' || granularity === 'semanal';
    const minWidthClass = granularity === 'diario'
        ? 'min-w-[900px]'
        : granularity === 'semanal'
            ? 'min-w-[640px]'
            : '';

    const rotateLabels = granularity === 'diario' || granularity === 'semanal';

    const yFormatter = (v: number) => {
        if (Math.abs(v) >= 1000) return `Q${Math.round(v / 1000)}k`;
        return `Q${v}`;
    };

    return (
        <div
            className={cn('w-full', isPending && 'opacity-60 transition-opacity')}
            role="img"
            aria-label={`Gráfico de movimientos con granularidad ${granularityLabel(granularity).toLowerCase()}. Ingresos en verde, gastos en gris y balance en azul.`}
        >
            <div className={cn('overflow-x-auto', isHighCardinality && '-mx-2 px-2')}>
                <div className={cn('h-[240px] sm:h-[320px]', minWidthClass)}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={rows}
                            margin={{ top: 8, right: 16, bottom: rotateLabels ? 24 : 8, left: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)', opacity: 0.8 }}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                interval="preserveStartEnd"
                                angle={rotateLabels ? -45 : 0}
                                textAnchor={rotateLabels ? 'end' : 'middle'}
                                height={rotateLabels ? 48 : 24}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)', opacity: 0.8 }}
                                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                tickFormatter={yFormatter}
                                width={56}
                            />
                            <Tooltip
                                content={<MovimientosTooltip currency={currency} />}
                                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                            />
                            <ReferenceLine
                                y={0}
                                stroke="var(--muted-foreground)"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                            />
                            <Legend
                                verticalAlign="top"
                                height={28}
                                iconType="circle"
                                wrapperStyle={{ fontSize: 12 }}
                                formatter={(value) => {
                                    if (value === 'incomeDisplay') return 'Ingresos';
                                    if (value === 'expenseDisplay') return 'Gastos';
                                    if (value === 'balance') return 'Balance';
                                    return value;
                                }}
                            />
                            <Bar
                                dataKey="incomeDisplay"
                                fill={INCOME_COLOR}
                                radius={[3, 3, 0, 0]}
                                maxBarSize={32}
                            />
                            <Bar
                                dataKey="expenseDisplay"
                                fill={EXPENSE_COLOR}
                                radius={[3, 3, 0, 0]}
                                maxBarSize={32}
                            />
                            <Line
                                type="monotone"
                                dataKey="balance"
                                stroke={BALANCE_COLOR}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* Visually-hidden description for screen readers (chart specifics) */}
            <p className="sr-only">
                Periodo desde {rows[0]?.longLabel} hasta {rows[rows.length - 1]?.longLabel}.
                Los buckets sin datos no contribuyen al balance.
            </p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center text-center py-10 gap-3">
            <Tray className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
            <div className="space-y-1">
                <p className="font-medium text-foreground">Aún no hay movimientos registrados.</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Registrá tu primer ingreso o gasto para empezar a ver tu línea de tiempo.
                </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <Button asChild variant="default" size="sm">
                    <Link href="/finances">Registrar ingreso</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                    <Link href="/finances">Registrar gasto</Link>
                </Button>
            </div>
        </div>
    );
}

function InsufficientDataState() {
    return (
        <div className="flex flex-col items-center text-center py-10 gap-3">
            <ChartLine className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
            <div className="space-y-1">
                <p className="font-medium text-foreground">
                    Aún no hay suficientes datos para mostrar tendencias.
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Para ver tendencias necesitás registrar movimientos en al menos 2 períodos.
                </p>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href="/finances">Registrar un movimiento</Link>
            </Button>
        </div>
    );
}

// Re-export the empty placeholder color so future themes can adjust it.
export const __MOVIMIENTOS_EMPTY_COLOR = EMPTY_COLOR;
