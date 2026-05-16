'use client';

import { useState, useMemo } from 'react';
import {
    TrendingDown,
    Calendar,
    DollarSign,
    Sparkles,
    Lock,
    Calculator,
    Download,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

import { SafeResponsiveContainer } from '@/components/charts/safe-responsive-container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UpgradeLimitModal } from '@/components/features/upgrade-limit-modal';
import { CurrencyInput } from '@/components/ui/currency-input';
import type { Debt } from '@/types';

interface WhatIfSimulatorProps {
    debts: Debt[];
    userCurrency: string;
    isPro?: boolean;
    monthlyIncome?: number;
    monthlyExpenses?: number;
}

interface ProjectionPoint {
    month: string;
    monthIndex: number;
    withMinimum: number;
    withExtra: number;
}

// Colors for dark mode compatibility
const CHART_COLORS = {
    minimum: '#94a3b8', // slate-400
    extra: '#22c55e', // green-500
    grid: '#334155', // slate-700
    text: '#94a3b8', // slate-400
    bg: '#1e293b', // slate-800
    border: '#334155', // slate-700
};

export function WhatIfSimulator({
    debts,
    userCurrency,
    isPro = false,
    monthlyIncome,
    monthlyExpenses,
}: WhatIfSimulatorProps) {
    const [extraPayment, setExtraPayment] = useState(0);
    const [incomeIncrease, setIncomeIncrease] = useState(0);
    const [expenseReduction, setExpenseReduction] = useState(0);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Calculate totals
    const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalMinPayment = debts.reduce((sum, d) => sum + Number(d.min_payment), 0);
    const avgApr = debts.length > 0
        ? debts.reduce((sum, d) => sum + Number(d.apr), 0) / debts.length
        : 0;

    const baseCashFlow = useMemo(() => {
        if (monthlyIncome === undefined || monthlyExpenses === undefined) return null;
        return Math.max(monthlyIncome - monthlyExpenses - totalMinPayment, 0);
    }, [monthlyIncome, monthlyExpenses, totalMinPayment]);

    const effectiveExtra = Math.max(0, extraPayment + incomeIncrease + expenseReduction);

    // Max extra payment is 5x the minimum payment or based on cash flow improvements
    const maxExtra = Math.max(
        totalMinPayment * 5,
        (baseCashFlow ?? 0) + incomeIncrease + expenseReduction,
        1000
    );

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: userCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Calculate projections
    const projections = useMemo(() => {
        const monthlyRate = (avgApr / 100) / 12;
        const maxMonths = 120; // 10 years cap

        // Calculate with minimum payments only
        let balanceMin = totalDebt;
        let monthsMin = 0;
        let interestMin = 0;

        while (balanceMin > 0 && monthsMin < maxMonths) {
            const interest = balanceMin * monthlyRate;
            interestMin += interest;
            const principal = Math.min(totalMinPayment - interest, balanceMin);
            balanceMin -= Math.max(0, principal);
            monthsMin++;
            if (principal <= 0) break; // Can't pay off
        }

        // Calculate with extra payments
        let balanceExtra = totalDebt;
        let monthsExtra = 0;
        let interestExtra = 0;
        const totalPayment = totalMinPayment + effectiveExtra;

        while (balanceExtra > 0 && monthsExtra < maxMonths) {
            const interest = balanceExtra * monthlyRate;
            interestExtra += interest;
            const principal = Math.min(totalPayment - interest, balanceExtra);
            balanceExtra -= Math.max(0, principal);
            monthsExtra++;
            if (principal <= 0) break;
        }

        return {
            monthsMin,
            monthsExtra,
            monthsSaved: monthsMin - monthsExtra,
            interestMin,
            interestExtra,
            interestSaved: interestMin - interestExtra,
        };
    }, [totalDebt, totalMinPayment, avgApr, effectiveExtra]);

    // Generate chart data
    const chartData = useMemo<ProjectionPoint[]>(() => {
        const monthlyRate = (avgApr / 100) / 12;
        const data: ProjectionPoint[] = [];
        const maxMonths = Math.max(projections.monthsMin, 48);

        let balanceMin = totalDebt;
        let balanceExtra = totalDebt;
        const totalPayment = totalMinPayment + effectiveExtra;

        for (let i = 0; i <= maxMonths; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() + i);

            data.push({
                month: date.toLocaleDateString('es-GT', { month: 'short', year: i % 12 === 0 ? '2-digit' : undefined }),
                monthIndex: i,
                withMinimum: Math.max(0, balanceMin),
                withExtra: Math.max(0, balanceExtra),
            });

            // Calculate next month balances
            if (balanceMin > 0) {
                const interestMin = balanceMin * monthlyRate;
                const principalMin = Math.min(totalMinPayment - interestMin, balanceMin);
                balanceMin -= Math.max(0, principalMin);
            }

            if (balanceExtra > 0) {
                const interestExtra = balanceExtra * monthlyRate;
                const principalExtra = Math.min(totalPayment - interestExtra, balanceExtra);
                balanceExtra -= Math.max(0, principalExtra);
            }
        }

        return data;
    }, [totalDebt, totalMinPayment, avgApr, effectiveExtra, projections.monthsMin]);

    // Handle slider change - check PRO access
    const handleSliderChange = (value: number[]) => {
        if (!isPro && value[0] > 0) {
            setShowUpgradeModal(true);
            return;
        }
        setExtraPayment(value[0]);
    };

    const handleIncomeIncrease = (value: number | undefined) => {
        const nextValue = Math.max(0, value || 0);
        if (!isPro && nextValue > 0) {
            setShowUpgradeModal(true);
            return;
        }
        setIncomeIncrease(nextValue);
    };

    const handleExpenseReduction = (value: number | undefined) => {
        const nextValue = Math.max(0, value || 0);
        if (!isPro && nextValue > 0) {
            setShowUpgradeModal(true);
            return;
        }
        setExpenseReduction(nextValue);
    };

    const handleExportScenario = () => {
        if (!isPro) {
            setShowUpgradeModal(true);
            return;
        }

        const headers = [
            'fecha',
            'moneda',
            'pago_extra_base',
            'ingreso_adicional',
            'reduccion_gastos',
            'pago_extra_total',
            'meses_minimos',
            'meses_escenario',
            'meses_ahorrados',
            'interes_minimo',
            'interes_escenario',
            'interes_ahorrado',
        ];

        const row = [
            new Date().toISOString().split('T')[0],
            userCurrency,
            extraPayment.toFixed(2),
            incomeIncrease.toFixed(2),
            expenseReduction.toFixed(2),
            effectiveExtra.toFixed(2),
            projections.monthsMin,
            projections.monthsExtra,
            projections.monthsSaved,
            projections.interestMin.toFixed(2),
            projections.interestExtra.toFixed(2),
            projections.interestSaved.toFixed(2),
        ];

        const csv = [headers.join(','), row.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `escenario_whatif_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (debts.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Calculator className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                        Agrega deudas para usar el simulador What-If
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                Simulador What-If
                            </CardTitle>
                            <CardDescription>
                                ¿Qué pasa si pagas más cada mes?
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={handleExportScenario}
                            >
                                <Download className="h-4 w-4" />
                                Exportar escenario
                            </Button>
                            {!isPro && (
                                <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                                    <Lock className="mr-1 h-3 w-3" />
                                    PRO
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    <p className="text-xs text-muted-foreground">
                        Los escenarios simulados son ejercicios hipotéticos basados en los datos
                        que ingresas. No son compromisos de tu acreedor ni reflejan cargos por
                        mora o cambios de tasa.
                    </p>
                    {/* Slider */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">
                                Pago extra mensual base
                            </label>
                            <span className="text-2xl font-bold text-primary">
                                +{formatCurrency(extraPayment)}
                            </span>
                        </div>
                        <Slider
                            value={[extraPayment]}
                            onValueChange={handleSliderChange}
                            max={maxExtra}
                            step={50}
                            className={!isPro ? 'opacity-50' : ''}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(0)}</span>
                            <span>{formatCurrency(maxExtra)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Extra total del escenario</span>
                            <span className="font-medium text-foreground">
                                +{formatCurrency(effectiveExtra)}
                            </span>
                        </div>
                    </div>

                    {monthlyIncome !== undefined && monthlyExpenses !== undefined && (
                        <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium">Ajustes de flujo</p>
                                    <p className="text-xs text-muted-foreground">
                                        Cambios en ingresos o gastos que puedes dirigir a deuda.
                                    </p>
                                </div>
                                {!isPro && (
                                    <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                                        <Lock className="mr-1 h-3 w-3" />
                                        PRO
                                    </Badge>
                                )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <CurrencyInput
                                    label="Ingreso adicional mensual"
                                    value={incomeIncrease}
                                    currency={userCurrency as 'GTQ' | 'USD'}
                                    onChange={handleIncomeIncrease}
                                />
                                <CurrencyInput
                                    label="Reduccion de gastos mensual"
                                    value={expenseReduction}
                                    currency={userCurrency as 'GTQ' | 'USD'}
                                    onChange={handleExpenseReduction}
                                />
                            </div>
                            {baseCashFlow !== null && (
                                <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                                    <span>Flujo libre base estimado</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(baseCashFlow)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Impact Cards */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <Calendar className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground mb-1">Meses ahorrados</p>
                            <p className="text-2xl font-bold text-green-500">
                                {projections.monthsSaved > 0 ? `-${projections.monthsSaved}` : '0'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <DollarSign className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground mb-1">Ahorro en intereses</p>
                            <p className="text-2xl font-bold text-green-500">
                                {formatCurrency(projections.interestSaved)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4 text-center">
                            <TrendingDown className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground mb-1">Libre de deuda en</p>
                            <p className="text-2xl font-bold text-primary">
                                {projections.monthsExtra} meses
                            </p>
                        </div>
                    </div>

                    {/* Comparison */}
                    <div className="grid gap-4 sm:grid-cols-2 text-sm">
                        <div className="rounded-xl border border-muted bg-muted/20 p-4">
                            <p className="text-muted-foreground mb-1">Solo pagos mínimos</p>
                            <p className="font-semibold">{projections.monthsMin} meses</p>
                            <p className="text-xs text-muted-foreground">
                                Interés total: {formatCurrency(projections.interestMin)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                            <p className="text-green-400 mb-1">Con escenario</p>
                            <p className="font-semibold text-green-500">{projections.monthsExtra} meses</p>
                            <p className="text-xs text-green-400">
                                Interés total: {formatCurrency(projections.interestExtra)}
                            </p>
                        </div>
                    </div>

                    {/* Chart */}
                    <SafeResponsiveContainer className="h-64">
                        {({ width, height }) => (
                            <AreaChart data={chartData} width={width} height={height}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                                    axisLine={{ stroke: CHART_COLORS.grid }}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                                    axisLine={{ stroke: CHART_COLORS.grid }}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: CHART_COLORS.bg,
                                        border: `1px solid ${CHART_COLORS.border}`,
                                        borderRadius: '12px',
                                    }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                    formatter={(value) => formatCurrency(Number(value) || 0)}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '10px' }}
                                    formatter={(value) => (
                                        <span style={{ color: CHART_COLORS.text }}>{value}</span>
                                    )}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="withMinimum"
                                    name="Solo mínimos"
                                    stroke={CHART_COLORS.minimum}
                                    fill={CHART_COLORS.minimum}
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="withExtra"
                                    name="Con escenario"
                                    stroke={CHART_COLORS.extra}
                                    fill={CHART_COLORS.extra}
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        )}
                    </SafeResponsiveContainer>
                </CardContent>
            </Card>

            <UpgradeLimitModal
                open={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureType="whatif"
            />
        </>
    );
}
