'use server';

import { and, asc, count, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

import { getDb, schema } from '@/db/client';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { createAdminClient } from '@/lib/supabase/server';
import { drizzleCountAlertsByType } from '@/lib/support/drizzle';
import { requirePermission } from './admin-auth';

// ============================================
// TYPES
// ============================================

export interface AdminOverview {
    totalUsers: number;
    newUsersThisMonth: number;
    newUsersChange: number;
    onboardingRate: number;
    totalDebts: number;
    totalDebtBalance: number;
    totalPayments: number;
    totalPaymentAmount: number;
    activeSubscriptions: {
        free: number;
        pro: number;
        business: number;
    };
}

export interface GrowthDataPoint {
    date: string;
    count: number;
}

export interface DebtDistribution {
    type: string;
    count: number;
    totalBalance: number;
}

export interface PaymentVolume {
    date: string;
    count: number;
    total: number;
}

export interface StrategyUsage {
    strategy: string;
    count: number;
}

export interface EngagementMetrics {
    usersWithDebts: number;
    usersWithPayments: number;
    usersWithPlans: number;
    usersWithForecasts: number;
    totalPlansGenerated: number;
    alertsByType: { type: string; count: number }[];
}

export interface RecentUser {
    id: string;
    email: string;
    createdAt: string;
    onboardingCompleted: boolean;
    debtCount: number;
    planCode: string;
}

// ============================================
// ADMIN OVERVIEW
// ============================================

export async function getAdminOverview(): Promise<AdminOverview> {
    await requirePermission('dashboard:read');

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    let totalUsers = 0;
    let newUsersThisMonth = 0;
    let newUsersLastMonth = 0;
    let onboardedUsers = 0;
    let totalDebts = 0;
    let totalDebtBalance = 0;
    let totalPayments = 0;
    let totalPaymentAmount = 0;
    let proPlan = 0;
    let businessPlan = 0;

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [
            totalUsersRow,
            newUsersThisMonthRow,
            newUsersLastMonthRow,
            onboardedUsersRow,
            debtRows,
            paymentRows,
            subscriptionRows,
        ] = await Promise.all([
            db.select({ value: count() }).from(schema.userProfiles),
            db
                .select({ value: count() })
                .from(schema.userProfiles)
                .where(gte(schema.userProfiles.createdAt, startOfMonth)),
            db
                .select({ value: count() })
                .from(schema.userProfiles)
                .where(
                    and(
                        gte(schema.userProfiles.createdAt, startOfLastMonth),
                        lt(schema.userProfiles.createdAt, startOfMonth),
                    ),
                ),
            db
                .select({ value: count() })
                .from(schema.userProfiles)
                .where(eq(schema.userProfiles.onboardingCompleted, true)),
            db
                .select({ balance: schema.debts.balance })
                .from(schema.debts)
                .where(eq(schema.debts.status, 'ACTIVE')),
            db.select({ amount: schema.payments.amount }).from(schema.payments),
            db
                .select({
                    planCode: schema.subscriptions.planCode,
                    status: schema.subscriptions.status,
                })
                .from(schema.subscriptions)
                .where(ne(schema.subscriptions.status, 'CANCELED')),
        ]);

        totalUsers = totalUsersRow[0]?.value ?? 0;
        newUsersThisMonth = newUsersThisMonthRow[0]?.value ?? 0;
        newUsersLastMonth = newUsersLastMonthRow[0]?.value ?? 0;
        onboardedUsers = onboardedUsersRow[0]?.value ?? 0;
        totalDebts = debtRows.length;
        totalDebtBalance = debtRows.reduce((sum, d) => sum + Number(d.balance), 0);
        totalPayments = paymentRows.length;
        totalPaymentAmount = paymentRows.reduce((sum, p) => sum + Number(p.amount), 0);
        proPlan = subscriptionRows.filter((s) => s.planCode === 'PRO').length;
        businessPlan = subscriptionRows.filter((s) => s.planCode === 'BUSINESS').length;
    } else {
        const supabase = createAdminClient();

        // Parallelize all queries for maximum performance
        const [
            totalUsersResult,
            newUsersThisMonthResult,
            newUsersLastMonthResult,
            onboardedUsersResult,
            debtStatsResult,
            paymentStatsResult,
            subscriptionsResult,
        ] = await Promise.all([
            supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
            supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startOfMonth.toISOString()),
            supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startOfLastMonth.toISOString())
                .lt('created_at', startOfMonth.toISOString()),
            supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('onboarding_completed', true),
            supabase.from('debts').select('balance', { count: 'exact' }).eq('status', 'ACTIVE'),
            supabase.from('payments').select('amount', { count: 'exact' }),
            supabase.from('subscriptions').select('plan_code, status').neq('status', 'CANCELED'),
        ]);

        totalUsers = totalUsersResult.count || 0;
        newUsersThisMonth = newUsersThisMonthResult.count || 0;
        newUsersLastMonth = newUsersLastMonthResult.count || 0;
        onboardedUsers = onboardedUsersResult.count || 0;
        totalDebts = debtStatsResult.count || 0;
        totalDebtBalance =
            debtStatsResult.data?.reduce((sum: number, d: { balance: string | number }) => sum + Number(d.balance), 0) ||
            0;
        totalPayments = paymentStatsResult.count || 0;
        totalPaymentAmount =
            paymentStatsResult.data?.reduce((sum: number, p: { amount: string | number }) => sum + Number(p.amount), 0) ||
            0;
        proPlan = subscriptionsResult.data?.filter((s: { plan_code: string }) => s.plan_code === 'PRO').length || 0;
        businessPlan =
            subscriptionsResult.data?.filter((s: { plan_code: string }) => s.plan_code === 'BUSINESS').length || 0;
    }

    const newUsersChange = newUsersLastMonth
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
        : 0;
    const onboardingRate = totalUsers ? (onboardedUsers / totalUsers) * 100 : 0;
    const freePlan = Math.max(totalUsers - proPlan - businessPlan, 0);

    return {
        totalUsers,
        newUsersThisMonth,
        newUsersChange: Math.round(newUsersChange * 10) / 10,
        onboardingRate: Math.round(onboardingRate * 10) / 10,
        totalDebts,
        totalDebtBalance,
        totalPayments,
        totalPaymentAmount,
        activeSubscriptions: {
            free: freePlan,
            pro: proPlan,
            business: businessPlan,
        },
    };
}

// ============================================
// USER GROWTH DATA
// ============================================

export async function getUserGrowthData(days: number = 30): Promise<GrowthDataPoint[]> {
    await requirePermission('dashboard:read');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let profiles: Array<{ created_at: string | Date }> | null = null;
    if (isDrizzleEnabled()) {
        const rows = await getDb()
            .select({ createdAt: schema.userProfiles.createdAt })
            .from(schema.userProfiles)
            .where(gte(schema.userProfiles.createdAt, startDate))
            .orderBy(asc(schema.userProfiles.createdAt));
        profiles = rows.map((r) => ({ created_at: r.createdAt }));
    } else {
        const supabase = createAdminClient();
        const { data } = await supabase
            .from('user_profiles')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });
        profiles = data;
    }

    // Group by date
    const grouped: Record<string, number> = {};

    // Initialize all dates with 0
    for (let i = 0; i <= days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - i));
        const dateStr = d.toISOString().split('T')[0];
        grouped[dateStr] = 0;
    }

    // Count signups per day
    profiles?.forEach((p) => {
        const dateStr = new Date(p.created_at).toISOString().split('T')[0];
        if (grouped[dateStr] !== undefined) {
            grouped[dateStr]++;
        }
    });

    return Object.entries(grouped).map(([date, value]) => ({ date, count: value }));
}

// ============================================
// DEBT DISTRIBUTION
// ============================================

export async function getDebtDistribution(): Promise<DebtDistribution[]> {
    await requirePermission('dashboard:read');

    let debts: Array<{ type: string; balance: string | number }> | null = null;
    if (isDrizzleEnabled()) {
        debts = await getDb()
            .select({ type: schema.debts.type, balance: schema.debts.balance })
            .from(schema.debts)
            .where(eq(schema.debts.status, 'ACTIVE'));
    } else {
        const supabase = createAdminClient();
        const { data } = await supabase.from('debts').select('type, balance').eq('status', 'ACTIVE');
        debts = data;
    }

    // Group by type
    const grouped: Record<string, { count: number; totalBalance: number }> = {};

    debts?.forEach((d) => {
        if (!grouped[d.type]) {
            grouped[d.type] = { count: 0, totalBalance: 0 };
        }
        grouped[d.type].count++;
        grouped[d.type].totalBalance += Number(d.balance);
    });

    return Object.entries(grouped).map(([type, stats]) => ({
        type,
        count: stats.count,
        totalBalance: stats.totalBalance,
    }));
}

// ============================================
// PAYMENT VOLUME
// ============================================

export async function getPaymentVolume(days: number = 30): Promise<PaymentVolume[]> {
    await requirePermission('dashboard:read');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let payments: Array<{ payment_date: string; amount: string | number }> | null = null;
    if (isDrizzleEnabled()) {
        const rows = await getDb()
            .select({
                paymentDate: schema.payments.paymentDate,
                amount: schema.payments.amount,
            })
            .from(schema.payments)
            .where(gte(schema.payments.paymentDate, startDateStr))
            .orderBy(asc(schema.payments.paymentDate));
        payments = rows.map((r) => ({ payment_date: r.paymentDate, amount: r.amount }));
    } else {
        const supabase = createAdminClient();
        const { data } = await supabase
            .from('payments')
            .select('payment_date, amount')
            .gte('payment_date', startDateStr)
            .order('payment_date', { ascending: true });
        payments = data;
    }

    // Group by date
    const grouped: Record<string, { count: number; total: number }> = {};

    // Initialize all dates with 0
    for (let i = 0; i <= days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - i));
        const dateStr = d.toISOString().split('T')[0];
        grouped[dateStr] = { count: 0, total: 0 };
    }

    payments?.forEach((p) => {
        const dateStr = p.payment_date;
        if (grouped[dateStr]) {
            grouped[dateStr].count++;
            grouped[dateStr].total += Number(p.amount);
        }
    });

    return Object.entries(grouped).map(([date, stats]) => ({
        date,
        count: stats.count,
        total: stats.total,
    }));
}

// ============================================
// STRATEGY USAGE
// ============================================

export async function getStrategyUsage(): Promise<StrategyUsage[]> {
    await requirePermission('dashboard:read');

    let plans: Array<{ strategy: string }> | null = null;
    if (isDrizzleEnabled()) {
        plans = await getDb().select({ strategy: schema.plans.strategy }).from(schema.plans);
    } else {
        const supabase = createAdminClient();
        const { data } = await supabase.from('plans').select('strategy');
        plans = data;
    }

    const grouped: Record<string, number> = {
        AVALANCHE: 0,
        SNOWBALL: 0,
        HYBRID: 0,
    };

    plans?.forEach((p) => {
        if (grouped[p.strategy] !== undefined) {
            grouped[p.strategy]++;
        }
    });

    return Object.entries(grouped).map(([strategy, value]) => ({ strategy, count: value }));
}

// ============================================
// ENGAGEMENT METRICS
// ============================================

export async function getEngagementMetrics(): Promise<EngagementMetrics> {
    await requirePermission('dashboard:read');

    let uniqueDebtUsers = new Set<string>();
    let uniquePaymentUsers = new Set<string>();
    let uniquePlanUsers = new Set<string>();
    let uniqueForecastUsers = new Set<string>();
    let totalPlans = 0;
    let alertsByType: Array<{ type: string; count: number }> = [];

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [debtUsers, paymentUsers, planUsers, forecastUsers, totalPlansRow] =
            await Promise.all([
                db
                    .select({ userId: schema.debts.userId })
                    .from(schema.debts)
                    .where(eq(schema.debts.status, 'ACTIVE')),
                db.select({ userId: schema.payments.userId }).from(schema.payments),
                db.select({ userId: schema.plans.userId }).from(schema.plans),
                db.select({ userId: schema.forecasts.userId }).from(schema.forecasts),
                db.select({ value: count() }).from(schema.plans),
            ]);

        uniqueDebtUsers = new Set(debtUsers.map((d) => d.userId));
        uniquePaymentUsers = new Set(paymentUsers.map((p) => p.userId));
        uniquePlanUsers = new Set(planUsers.map((p) => p.userId));
        uniqueForecastUsers = new Set(forecastUsers.map((f) => f.userId));
        totalPlans = totalPlansRow[0]?.value ?? 0;

        try {
            alertsByType = await drizzleCountAlertsByType();
        } catch (error) {
            console.error('Error counting alerts by type (drizzle):', error);
            alertsByType = [];
        }
    } else {
        const supabase = createAdminClient();

        const { data: debtUsers } = await supabase
            .from('debts')
            .select('user_id')
            .eq('status', 'ACTIVE');
        uniqueDebtUsers = new Set(debtUsers?.map((d: { user_id: string }) => d.user_id));

        const { data: paymentUsers } = await supabase.from('payments').select('user_id');
        uniquePaymentUsers = new Set(paymentUsers?.map((p: { user_id: string }) => p.user_id));

        const { data: planUsers } = await supabase.from('plans').select('user_id');
        uniquePlanUsers = new Set(planUsers?.map((p: { user_id: string }) => p.user_id));

        const { data: forecastUsers } = await supabase.from('forecasts').select('user_id');
        uniqueForecastUsers = new Set(forecastUsers?.map((f: { user_id: string }) => f.user_id));

        const { count: totalPlansCount } = await supabase
            .from('plans')
            .select('*', { count: 'exact', head: true });
        totalPlans = totalPlansCount || 0;

        const { data: alerts } = await supabase.from('alerts').select('type');
        const alertGroups: Record<string, number> = {};
        alerts?.forEach((a: { type: string }) => {
            alertGroups[a.type] = (alertGroups[a.type] || 0) + 1;
        });
        alertsByType = Object.entries(alertGroups).map(([type, value]) => ({ type, count: value }));
    }

    return {
        usersWithDebts: uniqueDebtUsers.size,
        usersWithPayments: uniquePaymentUsers.size,
        usersWithPlans: uniquePlanUsers.size,
        usersWithForecasts: uniqueForecastUsers.size,
        totalPlansGenerated: totalPlans || 0,
        alertsByType,
    };
}

// ============================================
// RECENT USERS
// ============================================

export async function getRecentUsers(limit: number = 10): Promise<RecentUser[]> {
    await requirePermission('dashboard:read');

    let users: Array<{
        user_id: string;
        created_at: string | Date;
        onboarding_completed: boolean;
    }> = [];
    let debts: Array<{ user_id: string; status: string }> = [];
    let subscriptions: Array<{ user_id: string; plan_code: string }> = [];

    if (isDrizzleEnabled()) {
        const db = getDb();
        const profileRows = await db
            .select({
                userId: schema.userProfiles.userId,
                createdAt: schema.userProfiles.createdAt,
                onboardingCompleted: schema.userProfiles.onboardingCompleted,
            })
            .from(schema.userProfiles)
            .orderBy(desc(schema.userProfiles.createdAt))
            .limit(limit);

        users = profileRows.map((u) => ({
            user_id: u.userId,
            created_at: u.createdAt,
            onboarding_completed: u.onboardingCompleted,
        }));

        if (!users.length) return [];

        const userIds = users.map((user) => user.user_id);
        const [debtRows, subRows] = await Promise.all([
            db
                .select({ userId: schema.debts.userId, status: schema.debts.status })
                .from(schema.debts)
                .where(inArray(schema.debts.userId, userIds)),
            db
                .select({
                    userId: schema.subscriptions.userId,
                    planCode: schema.subscriptions.planCode,
                })
                .from(schema.subscriptions)
                .where(
                    and(
                        inArray(schema.subscriptions.userId, userIds),
                        eq(schema.subscriptions.status, 'ACTIVE'),
                    ),
                ),
        ]);
        debts = debtRows.map((d) => ({ user_id: d.userId, status: d.status }));
        subscriptions = subRows.map((s) => ({ user_id: s.userId, plan_code: s.planCode }));
    } else {
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id, created_at, onboarding_completed')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent users:', error);
            return [];
        }

        if (!data?.length) return [];
        users = data;

        const userIds = users.map((user) => user.user_id);

        const [{ data: debtData, error: debtsError }, { data: subData, error: subsError }] =
            await Promise.all([
                supabase.from('debts').select('user_id, status').in('user_id', userIds),
                supabase
                    .from('subscriptions')
                    .select('user_id, plan_code, status')
                    .in('user_id', userIds)
                    .eq('status', 'ACTIVE'),
            ]);

        if (debtsError) {
            console.error('Error fetching recent user debts:', debtsError);
        }
        if (subsError) {
            console.error('Error fetching recent user subscriptions:', subsError);
        }

        debts = debtData || [];
        subscriptions = subData || [];
    }

    if (!users.length) return [];

    const debtCountByUser = new Map<string, number>();
    debts.forEach((debt) => {
        if (debt.status !== 'ACTIVE') return;
        debtCountByUser.set(debt.user_id, (debtCountByUser.get(debt.user_id) || 0) + 1);
    });

    const subscriptionByUser = new Map<string, string>();
    subscriptions.forEach((subscription) => {
        subscriptionByUser.set(subscription.user_id, subscription.plan_code || 'FREE');
    });

    return users.map((user) => {
        const debtCount = debtCountByUser.get(user.user_id) || 0;
        const planCode = subscriptionByUser.get(user.user_id) || 'FREE';

        return {
            id: user.user_id,
            email: `user-${user.user_id.slice(0, 8)}...`,
            createdAt:
                typeof user.created_at === 'string'
                    ? user.created_at
                    : user.created_at.toISOString(),
            onboardingCompleted: user.onboarding_completed,
            debtCount,
            planCode,
        };
    });
}

// ============================================
// CACHED VERSIONS FOR PERFORMANCE
// ============================================

/**
 * Cached version of getAdminOverview
 * Revalidates every 5 minutes (300 seconds)
 * Use this in dashboard components to reduce DB load
 */
export const getCachedAdminOverview = unstable_cache(
    async () => getAdminOverview(),
    ['admin-overview'],
    {
        revalidate: 300, // 5 minutes
        tags: ['admin-analytics', 'admin-overview'],
    }
);

/**
 * Cached version of getUserGrowthData
 * Revalidates every 10 minutes
 */
export const getCachedUserGrowthData = unstable_cache(
    async (days: number = 30) => getUserGrowthData(days),
    ['user-growth-data'],
    {
        revalidate: 600, // 10 minutes
        tags: ['admin-analytics', 'user-growth'],
    }
);

/**
 * Cached version of getDebtDistribution
 * Revalidates every 10 minutes
 */
export const getCachedDebtDistribution = unstable_cache(
    async () => getDebtDistribution(),
    ['debt-distribution'],
    {
        revalidate: 600, // 10 minutes
        tags: ['admin-analytics', 'debt-stats'],
    }
);

/**
 * Cached version of getPaymentVolume
 * Revalidates every 5 minutes
 */
export const getCachedPaymentVolume = unstable_cache(
    async (days: number = 30) => getPaymentVolume(days),
    ['payment-volume'],
    {
        revalidate: 300, // 5 minutes
        tags: ['admin-analytics', 'payment-stats'],
    }
);

/**
 * Cached version of getStrategyUsage
 * Revalidates every 15 minutes
 */
export const getCachedStrategyUsage = unstable_cache(
    async () => getStrategyUsage(),
    ['strategy-usage'],
    {
        revalidate: 900, // 15 minutes
        tags: ['admin-analytics', 'strategy-stats'],
    }
);

/**
 * Cached version of getEngagementMetrics
 * Revalidates every 10 minutes
 */
export const getCachedEngagementMetrics = unstable_cache(
    async () => getEngagementMetrics(),
    ['engagement-metrics'],
    {
        revalidate: 600, // 10 minutes
        tags: ['admin-analytics', 'engagement'],
    }
);

/**
 * Invalidates all admin analytics cache
 * Call this when admin makes changes that should refresh the dashboard
 */
export async function revalidateAdminAnalytics(): Promise<void> {
    const { revalidateTag } = await import('next/cache');
    revalidateTag('admin-analytics', 'max');
}
