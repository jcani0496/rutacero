'use client';

import {
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/safe-responsive-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Calendar, PiggyBank, Target, DollarSign } from 'lucide-react';
import type {
    PaymentHistoryItem,
    DebtDistributionItem,
    DebtProjectionItem,
    InterestSavings,
    FinancialIndicators,
} from '@/lib/actions/dashboard-analytics';

interface ProAnalyticsProps {
    paymentHistory: PaymentHistoryItem[];
    debtDistribution: DebtDistributionItem[];
    debtProjection: DebtProjectionItem[];
    interestSavings: InterestSavings;
    indicators: FinancialIndicators;
    currency: string;
}

// Chart styling constants
const CHART_COLORS = {
    primary: '#22c55e',
    secondary: '#3b82f6',
    accent: '#f59e0b',
    muted: '#64748b',
    cardBg: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
    axisText: '#94a3b8',
};

export function ProAnalytics({
    paymentHistory,
    debtDistribution,
    debtProjection,
    interestSavings,
    indicators,
    currency,
}: ProAnalyticsProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatShortCurrency = (amount: number) => {
        if (amount >= 1000) {
            return `${currency} ${(amount / 1000).toFixed(1)}k`;
        }
        return formatCurrency(amount);
    };

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500">
                    <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Analíticas PRO</h2>
                    <p className="text-sm text-muted-foreground">Visualización avanzada de tus finanzas</p>
                </div>
            </div>

            {/* Additional KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Ahorro Potencial</p>
                                <p className="text-2xl font-bold text-emerald-400">
                                    {formatCurrency(interestSavings.savings)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    en intereses con tu plan
                                </p>
                            </div>
                            <PiggyBank className="h-8 w-8 text-emerald-400/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Pagado Total</p>
                                <p className="text-2xl font-bold text-blue-400">
                                    {formatCurrency(indicators.totalPaid)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {indicators.percentagePaid.toFixed(1)}% de deuda original
                                </p>
                            </div>
                            <DollarSign className="h-8 w-8 text-blue-400/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Próximo Pago</p>
                                <p className="text-2xl font-bold text-amber-400">
                                    {indicators.daysToNextPayment} días
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Promedio mensual: {formatCurrency(indicators.avgMonthlyPayment)}
                                </p>
                            </div>
                            <Calendar className="h-8 w-8 text-amber-400/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Ratio Deuda/Ingreso</p>
                                <p className="text-2xl font-bold text-violet-400">
                                    {indicators.debtToIncomeRatio.toFixed(1)}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {indicators.debtToIncomeRatio < 30 ? 'Saludable' :
                                        indicators.debtToIncomeRatio < 50 ? 'Moderado' : 'Alto'}
                                </p>
                            </div>
                            <Target className="h-8 w-8 text-violet-400/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Payment History Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Historial de Pagos</CardTitle>
                        <CardDescription>Últimos 6 meses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SafeResponsiveContainer className="h-[250px]">
                            {({ width, height }) => (
                                <BarChart data={paymentHistory} width={width} height={height}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                                        axisLine={{ stroke: CHART_COLORS.border }}
                                    />
                                    <YAxis
                                        tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                                        axisLine={{ stroke: CHART_COLORS.border }}
                                        tickFormatter={(value) => formatShortCurrency(value)}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: CHART_COLORS.cardBg,
                                            border: `1px solid ${CHART_COLORS.border}`,
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: CHART_COLORS.text }}
                                        itemStyle={{ color: CHART_COLORS.text }}
                                        formatter={(value) => [formatCurrency(Number(value) || 0), 'Pagado']}
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill={CHART_COLORS.primary}
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            )}
                        </SafeResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Debt Distribution Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Distribución de Deudas</CardTitle>
                        <CardDescription>Por acreedor</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px]">
                            {debtDistribution.length > 0 ? (
                                <SafeResponsiveContainer className="h-full">
                                    {({ width, height }) => (
                                        <PieChart width={width} height={height}>
                                        <Pie
                                            data={debtDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent }) => {
                                                const displayName = String(name || '');
                                                const pct = Number(percent) * 100;
                                                return `${displayName.length > 10 ? displayName.substring(0, 10) + '...' : displayName} ${pct.toFixed(0)}%`;
                                            }}
                                            labelLine={{ stroke: CHART_COLORS.muted }}
                                        >
                                            {debtDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: CHART_COLORS.cardBg,
                                                border: `1px solid ${CHART_COLORS.border}`,
                                                borderRadius: '8px',
                                            }}
                                            labelStyle={{ color: CHART_COLORS.text }}
                                            itemStyle={{ color: CHART_COLORS.text }}
                                            formatter={(value) => formatCurrency(Number(value) || 0)}
                                        />
                                    </PieChart>
                                    )}
                                </SafeResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    No hay deudas registradas
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Debt Projection Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Proyección de Deuda</CardTitle>
                        <CardDescription>Próximos 12 meses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SafeResponsiveContainer className="h-[250px]">
                            {({ width, height }) => (
                                <AreaChart data={debtProjection} width={width} height={height}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                                        axisLine={{ stroke: CHART_COLORS.border }}
                                    />
                                    <YAxis
                                        tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                                        axisLine={{ stroke: CHART_COLORS.border }}
                                        tickFormatter={(value) => formatShortCurrency(value)}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: CHART_COLORS.cardBg,
                                            border: `1px solid ${CHART_COLORS.border}`,
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: CHART_COLORS.text }}
                                        itemStyle={{ color: CHART_COLORS.text }}
                                        formatter={(value) => formatCurrency(Number(value) || 0)}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="balance"
                                        stroke={CHART_COLORS.secondary}
                                        fill="url(#colorBalance)"
                                        strokeWidth={2}
                                        name="Saldo Pendiente"
                                    />
                                </AreaChart>
                            )}
                        </SafeResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Interest Savings Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Ahorro en Intereses</CardTitle>
                        <CardDescription>Mínimos vs. Plan Actual</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SafeResponsiveContainer className="h-[250px]">
                            {({ width, height }) => (
                                <BarChart
                                    data={[
                                        { name: 'Solo Mínimos', value: interestSavings.withMinimums, fill: CHART_COLORS.accent },
                                        { name: 'Con Plan', value: interestSavings.withPlan, fill: CHART_COLORS.primary },
                                    ]}
                                    width={width}
                                    height={height}
                                    layout="vertical"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                                    <XAxis
                                        type="number"
                                        tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                                        axisLine={{ stroke: CHART_COLORS.border }}
                                        tickFormatter={(value) => formatShortCurrency(value)}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                                        axisLine={{ stroke: CHART_COLORS.border }}
                                        width={100}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: CHART_COLORS.cardBg,
                                            border: `1px solid ${CHART_COLORS.border}`,
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: CHART_COLORS.text }}
                                        itemStyle={{ color: CHART_COLORS.text }}
                                        formatter={(value) => [formatCurrency(Number(value) || 0), 'Interés Total']}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {[
                                            { name: 'Solo Mínimos', fill: CHART_COLORS.accent },
                                            { name: 'Con Plan', fill: CHART_COLORS.primary },
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            )}
                        </SafeResponsiveContainer>
                        {interestSavings.savings > 0 && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
                                <TrendingDown className="h-4 w-4" />
                                <span>
                                    Ahorrás <strong>{formatCurrency(interestSavings.savings)}</strong> y
                                    <strong> {interestSavings.monthsSaved} meses</strong>
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
