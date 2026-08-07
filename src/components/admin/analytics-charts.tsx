"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import { SafeResponsiveContainer } from "@/components/charts/safe-responsive-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ============================================
// CHART COLORS - editorial paper/ink/teal palette (mirrors .rc-surface
// tokens in globals.css). Admin is a fixed light "paper" surface — no
// dark-mode branch needed — so these are safe to hardcode rather than
// read as CSS vars (Recharts/SVG can't resolve custom properties
// reliably across browsers).
// ============================================
const CHART_COLORS = {
    primary: "#0D9488",      // Teal (--chart-1)
    secondary: "#B45309",    // Amber/rust (--chart-4) — contrast to teal, not a rainbow hue
    accent: "#15803D",       // Green (--chart-2)
    tertiary: "#0F6F65",     // Dark teal (--chart-3)
    text: "#1B1812",         // Ink
    mutedText: "#6B6357",    // Muted ink
    border: "#E5DCC6",       // Paper border
    cardBg: "#FFFFFF",       // Card
};

// ============================================
// USER GROWTH CHART
// ============================================

interface GrowthDataPoint {
    date: string;
    count: number;
}

export function UserGrowthChart({ data }: { data: GrowthDataPoint[] }) {
    // Format dates for display
    const formattedData = data.map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }),
    }));

    // Calculate cumulative growth
    const cumulativeData = formattedData.reduce<Array<(typeof formattedData)[number] & { cumulative: number }>>(
        (acc, d) => {
            const previous = acc.length ? acc[acc.length - 1].cumulative : 0;
            acc.push({ ...d, cumulative: previous + d.count });
            return acc;
        },
        []
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Crecimiento de Usuarios</CardTitle>
            </CardHeader>
            <CardContent>
                <SafeResponsiveContainer className="h-72">
                    {({ width, height }) => (
                        <AreaChart data={cumulativeData} width={width} height={height}>
                            <defs>
                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: CHART_COLORS.mutedText, fontSize: 11 }}
                                axisLine={{ stroke: CHART_COLORS.border }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: CHART_COLORS.mutedText, fontSize: 11 }}
                                axisLine={{ stroke: CHART_COLORS.border }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: CHART_COLORS.cardBg,
                                    border: `1px solid ${CHART_COLORS.border}`,
                                    borderRadius: "8px",
                                    color: CHART_COLORS.text,
                                }}
                                labelStyle={{ color: CHART_COLORS.text }}
                                itemStyle={{ color: CHART_COLORS.text }}
                                formatter={(value) => [
                                    Number(value) || 0,
                                    'Usuarios'
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey="cumulative"
                                name="Acumulado"
                                stroke={CHART_COLORS.primary}
                                fillOpacity={1}
                                fill="url(#colorUsers)"
                                strokeWidth={2}
                            />
                            <Bar
                                dataKey="count"
                                name="Nuevos"
                                fill={CHART_COLORS.secondary}
                                radius={[2, 2, 0, 0]}
                                opacity={0.7}
                            />
                        </AreaChart>
                    )}
                </SafeResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// ============================================
// DEBT DISTRIBUTION CHART
// ============================================

interface DebtDistribution {
    type: string;
    count: number;
    totalBalance: number;
}

const DEBT_TYPE_LABELS: Record<string, string> = {
    CREDIT_CARD: 'Tarjeta de Crédito',
    LOAN: 'Préstamo',
    INSTALLMENT: 'Cuotas',
    INFORMAL: 'Informal',
};

const PIE_COLORS = [
    CHART_COLORS.primary,    // Teal
    CHART_COLORS.accent,     // Green
    CHART_COLORS.secondary,  // Amber/rust
    CHART_COLORS.tertiary,   // Dark teal
];

export function DebtDistributionChart({ data }: { data: DebtDistribution[] }) {
    const formattedData = data.map(d => ({
        ...d,
        name: DEBT_TYPE_LABELS[d.type] || d.type,
    }));

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 0,
        }).format(value);
    };

    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Distribución de Deudas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-72 items-center justify-center text-muted-foreground">
                        No hay datos de deudas
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Distribución de Deudas</CardTitle>
            </CardHeader>
            <CardContent>
                <SafeResponsiveContainer className="h-72">
                    {({ width, height }) => (
                        <PieChart width={width} height={height}>
                            <Pie
                                data={formattedData}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                            >
                                {formattedData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                offset={20}
                                allowEscapeViewBox={{ x: true, y: true }}
                                wrapperStyle={{ zIndex: 100 }}
                                contentStyle={{
                                    backgroundColor: CHART_COLORS.cardBg,
                                    border: `1px solid ${CHART_COLORS.border}`,
                                    borderRadius: "8px",
                                    color: CHART_COLORS.text,
                                    boxShadow: "0 4px 12px rgba(27,24,18,0.1)",
                                }}
                                labelStyle={{ color: CHART_COLORS.text }}
                                itemStyle={{ color: CHART_COLORS.text }}
                                formatter={(value, name, props) => [
                                    `${Number(value) || 0} deudas — ${formatCurrency(props.payload?.totalBalance || 0)}`,
                                    String(name)
                                ]}
                            />
                            <Legend
                                wrapperStyle={{ color: CHART_COLORS.text }}
                                formatter={(value) => <span style={{ color: CHART_COLORS.mutedText }}>{value}</span>}
                            />
                        </PieChart>
                    )}
                </SafeResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// ============================================
// PAYMENT VOLUME CHART
// ============================================

interface PaymentVolume {
    date: string;
    count: number;
    total: number;
}

export function PaymentVolumeChart({ data }: { data: PaymentVolume[] }) {
    const formattedData = data.map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }),
    }));

    const formatCurrency = (value: number) => {
        if (value >= 1000) return `Q${(value / 1000).toFixed(1)}k`;
        return `Q${value}`;
    };

    const hasData = data.some(d => d.count > 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Volumen de Pagos</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-72">
                    {!hasData ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No hay pagos registrados
                        </div>
                    ) : (
                        <SafeResponsiveContainer className="h-full">
                            {({ width, height }) => (
                                <AreaChart data={formattedData} width={width} height={height}>
                                <defs>
                                    <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: CHART_COLORS.mutedText, fontSize: 11 }}
                                    axisLine={{ stroke: CHART_COLORS.border }}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fill: CHART_COLORS.mutedText, fontSize: 11 }}
                                    axisLine={{ stroke: CHART_COLORS.border }}
                                    tickFormatter={formatCurrency}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: CHART_COLORS.cardBg,
                                        border: `1px solid ${CHART_COLORS.border}`,
                                        borderRadius: "8px",
                                        color: CHART_COLORS.text,
                                    }}
                                    labelStyle={{ color: CHART_COLORS.text }}
                                    itemStyle={{ color: CHART_COLORS.text }}
                                    formatter={(value, name) => [
                                        name === 'total' ? formatCurrency(Number(value) || 0) : Number(value) || 0,
                                        name === 'total' ? 'Monto' : 'Pagos'
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    name="Monto"
                                    stroke={CHART_COLORS.accent}
                                    fillOpacity={1}
                                    fill="url(#colorPayments)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                            )}
                        </SafeResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================
// STRATEGY USAGE CHART
// ============================================

interface StrategyUsage {
    strategy: string;
    count: number;
}

const STRATEGY_LABELS: Record<string, string> = {
    AVALANCHE: 'Avalancha',
    SNOWBALL: 'Bola de Nieve',
    HYBRID: 'Híbrido',
};

const STRATEGY_COLORS: Record<string, string> = {
    AVALANCHE: CHART_COLORS.secondary,  // Amber/rust
    SNOWBALL: CHART_COLORS.tertiary,    // Dark teal
    HYBRID: CHART_COLORS.primary,       // Teal
};

export function StrategyUsageChart({ data }: { data: StrategyUsage[] }) {
    const formattedData = data.map(d => ({
        ...d,
        name: STRATEGY_LABELS[d.strategy] || d.strategy,
        fill: STRATEGY_COLORS[d.strategy] || CHART_COLORS.primary,
    }));

    const hasData = data.some(d => d.count > 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Estrategias Utilizadas</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-72">
                    {!hasData ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No hay planes generados
                        </div>
                    ) : (
                        <SafeResponsiveContainer className="h-full">
                            {({ width, height }) => (
                                <BarChart data={formattedData} layout="vertical" width={width} height={height}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} horizontal={false} />
                                <XAxis
                                    type="number"
                                    tick={{ fill: CHART_COLORS.mutedText, fontSize: 11 }}
                                    axisLine={{ stroke: CHART_COLORS.border }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={100}
                                    tick={{ fill: CHART_COLORS.mutedText, fontSize: 12 }}
                                    axisLine={{ stroke: CHART_COLORS.border }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: CHART_COLORS.cardBg,
                                        border: `1px solid ${CHART_COLORS.border}`,
                                        borderRadius: "8px",
                                        color: CHART_COLORS.text,
                                    }}
                                    labelStyle={{ color: CHART_COLORS.text }}
                                    itemStyle={{ color: CHART_COLORS.text }}
                                    formatter={(value) => [`${Number(value) || 0} planes`, 'Cantidad']}
                                />
                                <Bar
                                    dataKey="count"
                                    radius={[0, 4, 4, 0]}
                                >
                                    {formattedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                            )}
                        </SafeResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================
// ENGAGEMENT METRICS CARD
// ============================================

interface EngagementMetrics {
    usersWithDebts: number;
    usersWithPayments: number;
    usersWithPlans: number;
    usersWithForecasts: number;
    totalPlansGenerated: number;
    alertsByType: { type: string; count: number }[];
}

const ALERT_TYPE_LABELS: Record<string, string> = {
    PAYMENT_DUE: 'Pago por vencer',
    INSUFFICIENT_CASH: 'Sin efectivo',
    BUDGET_EXCEEDED: 'Presupuesto excedido',
    PLAN_DEVIATION: 'Desviación del plan',
};

export function EngagementMetricsCard({ data, totalUsers }: { data: EngagementMetrics; totalUsers: number }) {
    const metrics = [
        { label: 'Con deudas registradas', value: data.usersWithDebts, percent: totalUsers ? (data.usersWithDebts / totalUsers * 100) : 0 },
        { label: 'Con pagos registrados', value: data.usersWithPayments, percent: totalUsers ? (data.usersWithPayments / totalUsers * 100) : 0 },
        { label: 'Con planes generados', value: data.usersWithPlans, percent: totalUsers ? (data.usersWithPlans / totalUsers * 100) : 0 },
        { label: 'Con proyecciones', value: data.usersWithForecasts, percent: totalUsers ? (data.usersWithForecasts / totalUsers * 100) : 0 },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Métricas de Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {metrics.map((m, i) => (
                    <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{m.label}</span>
                            <span className="font-medium">{m.value} ({m.percent.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(m.percent, 100)}%` }}
                            />
                        </div>
                    </div>
                ))}

                <div className="mt-6 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Alertas Generadas</p>
                    {data.alertsByType.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin alertas</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {data.alertsByType.map((a, i) => (
                                <div key={i} className="flex justify-between text-sm rounded-lg bg-muted/50 px-3 py-2">
                                    <span className="text-muted-foreground">{ALERT_TYPE_LABELS[a.type] || a.type}</span>
                                    <span className="font-medium">{a.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
