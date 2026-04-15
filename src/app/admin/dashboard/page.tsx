import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
    Users,
    CreditCard,
    CheckCircle,
    Wallet,
    Target,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAdminSession, roleHasPermission } from '@/lib/actions/admin-auth';
import {
    getAdminOverview,
    getUserGrowthData,
    getDebtDistribution,
    getPaymentVolume,
    getStrategyUsage,
    getEngagementMetrics,
    getRecentUsers,
} from '@/lib/actions/admin-analytics';
import {
    UserGrowthChart,
    DebtDistributionChart,
    PaymentVolumeChart,
    StrategyUsageChart,
    EngagementMetricsCard,
} from '@/components/admin/analytics-charts';
import { TimeRangeSelector } from '@/components/admin/TimeRangeSelector';

export const metadata = {
    title: 'Dashboard Analytics | Admin RutaCero',
};

const formatCurrency = (amount: number, currency: string = 'GTQ') => {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
    }).format(amount);
};

// ============================================
// LOADING SKELETONS
// ============================================

function KPICardSkeleton() {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="animate-pulse">
                    <div className="h-4 w-24 bg-muted rounded mb-2" />
                    <div className="h-8 w-16 bg-muted rounded" />
                </div>
            </CardContent>
        </Card>
    );
}

function ChartSkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="h-6 w-40 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
                <div className="h-72 bg-muted/50 rounded animate-pulse" />
            </CardContent>
        </Card>
    );
}

// ============================================
// KPI CARDS
// ============================================

async function KPICards() {
    const overview = await getAdminOverview();

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Users */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Usuarios</p>
                            <p className="mt-1 text-2xl font-bold">{overview.totalUsers}</p>
                        </div>
                        <div className="rounded-xl bg-primary/10 p-3">
                            <Users className="size-6 text-primary" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">
                            +{overview.newUsersThisMonth} este mes
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Onboarding Rate */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Tasa Onboarding</p>
                            <p className="mt-1 text-2xl font-bold">{overview.onboardingRate}%</p>
                        </div>
                        <div className="rounded-xl bg-success/10 p-3">
                            <CheckCircle className="size-6 text-success" />
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        Completaron el setup
                    </div>
                </CardContent>
            </Card>

            {/* Total Debt Managed */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Deuda Gestionada</p>
                            <p className="mt-1 text-2xl font-bold">{formatCurrency(overview.totalDebtBalance)}</p>
                        </div>
                        <div className="rounded-xl bg-warning/10 p-3">
                            <CreditCard className="size-6 text-warning" />
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        {overview.totalDebts} deudas activas
                    </div>
                </CardContent>
            </Card>

            {/* Total Payments */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Pagos Registrados</p>
                            <p className="mt-1 text-2xl font-bold">{formatCurrency(overview.totalPaymentAmount)}</p>
                        </div>
                        <div className="rounded-xl bg-chart-2/10 p-3">
                            <Wallet className="size-6 text-chart-2" />
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        {overview.totalPayments} transacciones
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// SUBSCRIPTION STATS
// ============================================

async function SubscriptionStats() {
    const overview = await getAdminOverview();
    const { free, pro, business } = overview.activeSubscriptions;
    const total = free + pro + business;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="size-5" />
                    Suscripciones
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="size-3 rounded bg-muted" />
                            <span>Free</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{free}</span>
                            <Badge variant="outline" className="text-xs">
                                {total ? Math.round((free / total) * 100) : 0}%
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="size-3 rounded bg-primary" />
                            <span>Pro</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{pro}</span>
                            <Badge variant="outline" className="text-xs">
                                {total ? Math.round((pro / total) * 100) : 0}%
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="size-3 rounded bg-chart-2" />
                            <span>Business</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{business}</span>
                            <Badge variant="outline" className="text-xs">
                                {total ? Math.round((business / total) * 100) : 0}%
                            </Badge>
                        </div>
                    </div>
                </div>
                {total === 0 && (
                    <p className="mt-4 text-sm text-muted-foreground text-center">
                        No hay suscripciones activas
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================
// RECENT USERS
// ============================================

async function RecentUsersList() {
    const recentUsers = await getRecentUsers(5);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Usuarios Recientes</CardTitle>
            </CardHeader>
            <CardContent>
                {recentUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No hay usuarios registrados
                    </p>
                ) : (
                    <div className="space-y-3">
                        {recentUsers.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between rounded-xl border border-border p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-sm">
                                        {user.id.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{user.email}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(user.createdAt).toLocaleDateString('es-GT')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        {user.planCode}
                                    </Badge>
                                    <Badge
                                        variant={user.onboardingCompleted ? 'success' : 'secondary'}
                                        className="text-xs"
                                    >
                                        {user.onboardingCompleted ? 'Activo' : 'Pendiente'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================
// CHART WRAPPERS
// ============================================

async function UserGrowthChartWrapper({ days }: { days: number }) {
    const data = await getUserGrowthData(days);
    return <UserGrowthChart data={data} />;
}

async function DebtDistributionChartWrapper() {
    const data = await getDebtDistribution();
    return <DebtDistributionChart data={data} />;
}

async function PaymentVolumeChartWrapper({ days }: { days: number }) {
    const data = await getPaymentVolume(days);
    return <PaymentVolumeChart data={data} />;
}

async function StrategyUsageChartWrapper() {
    const data = await getStrategyUsage();
    return <StrategyUsageChart data={data} />;
}

async function EngagementMetricsWrapper() {
    const [engagement, overview] = await Promise.all([
        getEngagementMetrics(),
        getAdminOverview(),
    ]);
    return <EngagementMetricsCard data={engagement} totalUsers={overview.totalUsers} />;
}

// ============================================
// MAIN PAGE
// ============================================

interface PageProps {
    searchParams: Promise<{ range?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
    const session = await getAdminSession();
    const params = await searchParams;
    const days = params.range ? parseInt(params.range, 10) : 30;

    if (!session) {
        redirect('/admin/login');
    }
    if (!(await roleHasPermission(session.role, 'dashboard:read'))) {
        redirect('/admin/login');
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Dashboard Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Métricas en tiempo real • Bienvenido, {session.displayName || 'Admin'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <TimeRangeSelector currentRange={days} />
                    <Badge variant="outline" className="hidden sm:flex gap-1">
                        <RefreshCw className="size-3" />
                        Tiempo real
                    </Badge>
                </div>
            </div>

            {/* KPI Cards */}
            <Suspense
                fallback={
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <KPICardSkeleton key={i} />
                        ))}
                    </div>
                }
            >
                <KPICards />
            </Suspense>

            {/* Charts Row 1 */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Suspense fallback={<ChartSkeleton />}>
                    <UserGrowthChartWrapper days={days} />
                </Suspense>
                <Suspense fallback={<ChartSkeleton />}>
                    <DebtDistributionChartWrapper />
                </Suspense>
            </div>

            {/* Charts Row 2 */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Suspense fallback={<ChartSkeleton />}>
                    <PaymentVolumeChartWrapper days={days} />
                </Suspense>
                <Suspense fallback={<ChartSkeleton />}>
                    <StrategyUsageChartWrapper />
                </Suspense>
            </div>

            {/* Bottom Section */}
            <div className="grid gap-6 lg:grid-cols-3">
                <Suspense fallback={<ChartSkeleton />}>
                    <EngagementMetricsWrapper />
                </Suspense>
                <Suspense fallback={<ChartSkeleton />}>
                    <SubscriptionStats />
                </Suspense>
                <Suspense fallback={<ChartSkeleton />}>
                    <RecentUsersList />
                </Suspense>
            </div>
        </div>
    );
}
