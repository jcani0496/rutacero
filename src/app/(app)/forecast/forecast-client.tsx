'use client';

import { useState, useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Target,
    Clock,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { generateCashFlowForecast, type CashFlowForecast } from '@/lib/engine/forecast';
import { calculateRiskScore, type RiskScore } from '@/lib/engine/risk';
import { AlertBanner, RiskScoreBadge } from '@/components/features/AlertBanner';
import { WhatIfSimulator } from '@/components/features/what-if-simulator';
import type { Debt } from '@/types';
import type { Alert as AlertType } from '@/lib/alerts/summary';
import type { Income, Expense } from '@/lib/actions/finances';

interface ForecastClientProps {
    debts: Debt[];
    incomes: Income[];
    expenses: Expense[];
    alerts: AlertType[];
    upcomingPayments: {
        today: AlertType[];
        thisWeek: AlertType[];
        nextWeek: AlertType[];
    };
    userCurrency: string;
    isPro: boolean;
}

function monthsToTarget(targetDate: Date, today: Date) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    return Math.max(1, diff);
}

function calculateTargetPayment(balance: number, apr: number | null, months: number) {
    if (months <= 0) return balance;
    if (!apr || apr <= 0) {
        return balance / months;
    }

    const monthlyRate = apr / 100 / 12;
    const denominator = 1 - Math.pow(1 + monthlyRate, -months);
    if (denominator <= 0) return balance / months;

    return (balance * monthlyRate) / denominator;
}

export function ForecastClient({
    debts,
    incomes,
    expenses,
    alerts,
    upcomingPayments,
    userCurrency,
    isPro,
}: ForecastClientProps) {
    const [selectedPeriod, setSelectedPeriod] = useState(0);

    const { adjustedDebts, goalsActive } = useMemo(() => {
        if (!isPro) {
            return { adjustedDebts: debts, goalsActive: false };
        }

        const today = new Date();
        let hasGoals = false;

        const adjusted = debts.map((debt) => {
            const baseMinPayment = Number(debt.min_payment);
            const extraPayment = Number(debt.goal_extra_payment || 0);
            let targetPayment = 0;

            if (extraPayment > 0) {
                hasGoals = true;
            }

            if (debt.goal_target_date) {
                const targetDate = new Date(debt.goal_target_date);
                if (!Number.isNaN(targetDate.getTime()) && targetDate >= today) {
                    const months = monthsToTarget(targetDate, today);
                    const calculated = calculateTargetPayment(Number(debt.balance), Number(debt.apr || 0), months);
                    if (Number.isFinite(calculated)) {
                        targetPayment = calculated;
                        hasGoals = true;
                    }
                }
            }

            const effectiveMinPayment = Math.max(baseMinPayment, baseMinPayment + extraPayment, targetPayment);

            return {
                ...debt,
                min_payment: Math.round(effectiveMinPayment * 100) / 100,
            };
        });

        return { adjustedDebts: adjusted, goalsActive: hasGoals };
    }, [debts, isPro]);

    const monthlyIncome = useMemo(
        () => incomes.reduce((sum, income) => sum + Number(income.amount), 0),
        [incomes]
    );
    const monthlyExpenses = useMemo(
        () => expenses.reduce((sum, expense) => sum + Number(expense.budget_amount || expense.amount), 0),
        [expenses]
    );

    // Generate forecast using our engine
    const forecast = useMemo<CashFlowForecast>(() => {
        return generateCashFlowForecast({
            debts: adjustedDebts,
            incomes: incomes.map(i => ({
                amount: Number(i.amount),
                source: i.source || 'Ingreso',
                type: i.type as 'FIXED' | 'VARIABLE',
            })),
            expenses: expenses.map(e => ({
                amount: Number(e.budget_amount || e.amount),
                name: e.name,
                category: e.category || 'OTHER',
                expense_type: e.expense_type as 'NEED' | 'WANT',
            })),
            currency: userCurrency as 'GTQ' | 'USD',
        }, 12);
    }, [adjustedDebts, incomes, expenses, userCurrency]);

    // Calculate risk score
    const riskScore = useMemo<RiskScore>(() => {
        return calculateRiskScore({
            debts: adjustedDebts,
            monthlyIncome,
            monthlyExpenses,
        });
    }, [adjustedDebts, monthlyIncome, monthlyExpenses]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: userCurrency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Transform forecast data for charts
    const chartData = forecast.periods.map(p => ({
        period: p.period.label,
        date: p.period.periodStart.toISOString(),
        income: p.totalIncome,
        expenses: p.totalExpenses,
        debtPayments: p.totalDebtPayments,
        remaining: p.availableForExtra,
        netCashFlow: p.netCashFlow,
    }));

    const currentPeriod = chartData[selectedPeriod] || chartData[0];
    const selectedProjection = forecast.periods[selectedPeriod] || forecast.periods[0];

    // Check if we have data
    if (debts.length === 0 && incomes.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Predicciones
                    </h1>
                    <p className="text-muted-foreground">
                        Proyecciones de flujo de caja y alertas
                    </p>
                </div>

                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Datos insuficientes</AlertTitle>
                    <AlertDescription>
                        Agregá ingresos, gastos y deudas para ver las proyecciones de flujo de caja.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Predicciones
                    </h1>
                    <p className="text-muted-foreground">
                        Proyecciones de flujo de caja y alertas
                    </p>
                    {goalsActive && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-500">
                            <Target className="size-3.5" />
                            Incluye metas activas
                        </div>
                    )}
                </div>
                <RiskScoreBadge score={riskScore.score} level={riskScore.level} compact />
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <AlertBanner alerts={alerts} maxDisplay={2} />
            )}

            {/* Cash Flow Gaps Warning */}
            {forecast.gaps.length > 0 && (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertTitle className="text-amber-700 dark:text-amber-400">
                        Atención: {forecast.gaps.length} mes{forecast.gaps.length > 1 ? 'es' : ''} con déficit proyectado
                    </AlertTitle>
                    <AlertDescription className="text-amber-600 dark:text-amber-300">
                        {forecast.gaps[0].suggestion}
                    </AlertDescription>
                </Alert>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="size-4 text-emerald-500" />
                            Ingresos (12m)
                        </div>
                        <p className="mt-1 text-2xl font-bold text-emerald-500">
                            {formatCurrency(forecast.summary.totalIncome12m)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingDown className="size-4 text-orange-500" />
                            Gastos (12m)
                        </div>
                        <p className="mt-1 text-2xl font-bold text-orange-500">
                            {formatCurrency(forecast.summary.totalExpenses12m)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="size-4 text-blue-500" />
                            Pagos Deuda (12m)
                        </div>
                        <p className="mt-1 text-2xl font-bold text-blue-500">
                            {formatCurrency(forecast.summary.totalDebtPayments12m)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Target className="size-4 text-purple-500" />
                            Libre de Deudas
                        </div>
                        <p className="mt-1 text-2xl font-bold text-purple-500">
                            {forecast.summary.projectedDebtFreeDate
                                ? forecast.summary.projectedDebtFreeDate.toLocaleDateString('es-GT', {
                                    month: 'short',
                                    year: 'numeric',
                                })
                                : 'N/A'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Period Navigator */}
            <div className="flex items-center justify-center gap-4 overflow-x-auto py-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedPeriod(Math.max(0, selectedPeriod - 1))}
                    disabled={selectedPeriod === 0}
                    aria-label="Periodo anterior"
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <div className="flex gap-2">
                    {chartData.map((period, index) => (
                        <button
                            key={period.period}
                            onClick={() => setSelectedPeriod(index)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                                index === selectedPeriod
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                        >
                            {period.period}
                        </button>
                    ))}
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                        setSelectedPeriod(Math.min(chartData.length - 1, selectedPeriod + 1))
                    }
                    disabled={selectedPeriod === chartData.length - 1}
                    aria-label="Periodo siguiente"
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>

            {/* Selected Period Details */}
            {selectedProjection && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Resumen de {currentPeriod?.period || 'este mes'}
                            </CardTitle>
                            <CardDescription>
                                Detalle del flujo de caja del periodo seleccionado
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Ingresos</span>
                                <span className="font-semibold text-emerald-500">
                                    {formatCurrency(selectedProjection.totalIncome)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Gastos</span>
                                <span className="font-semibold text-orange-500">
                                    {formatCurrency(selectedProjection.totalExpenses)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Pagos de deuda</span>
                                <span className="font-semibold text-blue-500">
                                    {formatCurrency(selectedProjection.totalDebtPayments)}
                                </span>
                            </div>
                            <div className="border-t pt-3 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Flujo neto</span>
                                <span
                                    className={cn(
                                        'font-semibold',
                                        selectedProjection.netCashFlow >= 0 ? 'text-emerald-500' : 'text-red-500'
                                    )}
                                >
                                    {formatCurrency(selectedProjection.netCashFlow)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Disponible extra</span>
                                <span className="font-semibold">
                                    {formatCurrency(selectedProjection.availableForExtra)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pagos del periodo</CardTitle>
                            <CardDescription>Pagos mínimos proyectados</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {selectedProjection.debtPayments.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No hay pagos de deuda en este periodo.
                                </p>
                            )}
                            {selectedProjection.debtPayments.map((payment) => (
                                <div
                                    key={payment.debtId}
                                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                                >
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">{payment.creditor}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {payment.dueDate ? `Vence el ${payment.dueDate}` : 'Sin fecha de vencimiento'}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold">
                                        {formatCurrency(payment.amount)}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Cash Flow Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Flujo de Caja Proyectado</CardTitle>
                        <CardDescription>
                            Caja disponible después de gastos y pagos de deuda
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="var(--border)"
                                    />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={{ stroke: 'var(--border)' }}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--popover)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '12px',
                                        }}
                                        labelStyle={{ color: 'var(--popover-foreground)' }}
                                        itemStyle={{ color: 'var(--popover-foreground)' }}
                                        formatter={(value) => [formatCurrency(Number(value) || 0), 'Disponible']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="remaining"
                                        stroke="var(--chart-2)"
                                        fill="var(--chart-2)"
                                        fillOpacity={0.2}
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Income vs Expenses Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Ingresos vs Egresos</CardTitle>
                        <CardDescription>Desglose mensual proyectado</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="var(--border)"
                                    />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={{ stroke: 'var(--border)' }}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--popover)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '12px',
                                        }}
                                        labelStyle={{ color: 'var(--popover-foreground)' }}
                                        itemStyle={{ color: 'var(--popover-foreground)' }}
                                        formatter={(value, name) => [
                                            formatCurrency(Number(value) || 0),
                                            name === 'income'
                                                ? 'Ingresos'
                                                : name === 'expenses'
                                                    ? 'Gastos'
                                                    : 'Pagos Deuda',
                                        ]}
                                    />
                                    <Bar dataKey="income" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expenses" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="debtPayments" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="size-3 rounded" style={{ backgroundColor: 'var(--chart-2)' }} />
                                <span className="text-muted-foreground">Ingresos</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="size-3 rounded" style={{ backgroundColor: 'var(--chart-4)' }} />
                                <span className="text-muted-foreground">Gastos</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="size-3 rounded" style={{ backgroundColor: 'var(--chart-1)' }} />
                                <span className="text-muted-foreground">Deudas</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {adjustedDebts.length > 0 && (
                <WhatIfSimulator
                    debts={adjustedDebts}
                    userCurrency={userCurrency}
                    isPro={isPro}
                    monthlyIncome={monthlyIncome}
                    monthlyExpenses={monthlyExpenses}
                />
            )}

            {/* Upcoming Payments */}
            {(upcomingPayments.today.length > 0 || upcomingPayments.thisWeek.length > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Próximos Pagos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {upcomingPayments.today.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-red-500 mb-2">Hoy</h4>
                                {upcomingPayments.today.map(payment => (
                                    <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                        <span>{payment.title}</span>
                                        <span className="font-semibold">{payment.amount && formatCurrency(payment.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {upcomingPayments.thisWeek.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-amber-500 mb-2">Esta Semana</h4>
                                {upcomingPayments.thisWeek.map(payment => (
                                    <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                        <span>{payment.title}</span>
                                        <span className="font-semibold">{payment.amount && formatCurrency(payment.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Risk Factors */}
            {riskScore.factors.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Factores de Salud Financiera</CardTitle>
                        <CardDescription>
                            Análisis de tu situación actual
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {riskScore.factors.map((factor, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{factor.name}</p>
                                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                                </div>
                                <div className="text-right">
                                    <p className={cn(
                                        'font-bold',
                                        factor.impact === 'POSITIVE' ? 'text-emerald-500' :
                                            factor.impact === 'NEGATIVE' ? 'text-red-500' : 'text-amber-500'
                                    )}>
                                        {factor.value}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{factor.score}/100</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Recommendations */}
            {riskScore.recommendations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recomendaciones</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {riskScore.recommendations.map((rec, idx) => (
                            <div key={idx} className={cn(
                                'p-4 rounded-lg border',
                                rec.priority === 'HIGH' ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20' :
                                    rec.priority === 'MEDIUM' ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' :
                                        'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20'
                            )}>
                                <h4 className="font-semibold text-sm">{rec.title}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                <p className="text-sm font-medium mt-2">💡 {rec.action}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
