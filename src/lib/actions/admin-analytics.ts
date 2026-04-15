'use server';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
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

    const supabase = createAdminClient();

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
        // Count total users from user_profiles (not auth.users)
        supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true }),

        // Count new users this month
        supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString()),

        // Count new users last month
        supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfLastMonth.toISOString())
            .lt('created_at', startOfMonth.toISOString()),

        // Count onboarded users
        supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('onboarding_completed', true),

        // Get debt stats (only select what we need)
        supabase
            .from('debts')
            .select('balance', { count: 'exact' })
            .eq('status', 'ACTIVE'),

        // Get payment stats
        supabase
            .from('payments')
            .select('amount', { count: 'exact' }),

        // Get subscription data
        supabase
            .from('subscriptions')
            .select('plan_code, status')
            .neq('status', 'CANCELED'),
    ]);

    // Extract counts
    const totalUsers = totalUsersResult.count || 0;
    const newUsersThisMonth = newUsersThisMonthResult.count || 0;
    const newUsersLastMonth = newUsersLastMonthResult.count || 0;
    const onboardedUsers = onboardedUsersResult.count || 0;

    // Calculate growth percentage
    const newUsersChange = newUsersLastMonth
        ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
        : 0;

    // Calculate onboarding rate
    const onboardingRate = totalUsers ? (onboardedUsers / totalUsers) * 100 : 0;

    // Process debt stats
    const totalDebts = debtStatsResult.count || 0;
    const totalDebtBalance = debtStatsResult.data?.reduce(
        (sum, d) => sum + Number(d.balance),
        0
    ) || 0;

    // Process payment stats
    const totalPayments = paymentStatsResult.count || 0;
    const totalPaymentAmount = paymentStatsResult.data?.reduce(
        (sum, p) => sum + Number(p.amount),
        0
    ) || 0;

    // Process subscription distribution
    const proPlan = subscriptionsResult.data?.filter(
        s => s.plan_code === 'PRO'
    ).length || 0;
    const businessPlan = subscriptionsResult.data?.filter(
        s => s.plan_code === 'BUSINESS'
    ).length || 0;
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

    const supabase = createAdminClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: profiles } = await supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

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
    profiles?.forEach(p => {
        const dateStr = new Date(p.created_at).toISOString().split('T')[0];
        if (grouped[dateStr] !== undefined) {
            grouped[dateStr]++;
        }
    });

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}

// ============================================
// DEBT DISTRIBUTION
// ============================================

export async function getDebtDistribution(): Promise<DebtDistribution[]> {
    await requirePermission('dashboard:read');

    const supabase = createAdminClient();

    const { data: debts } = await supabase
        .from('debts')
        .select('type, balance')
        .eq('status', 'ACTIVE');

    // Group by type
    const grouped: Record<string, { count: number; totalBalance: number }> = {};

    debts?.forEach(d => {
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

    const supabase = createAdminClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: payments } = await supabase
        .from('payments')
        .select('payment_date, amount')
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .order('payment_date', { ascending: true });

    // Group by date
    const grouped: Record<string, { count: number; total: number }> = {};

    // Initialize all dates with 0
    for (let i = 0; i <= days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - i));
        const dateStr = d.toISOString().split('T')[0];
        grouped[dateStr] = { count: 0, total: 0 };
    }

    payments?.forEach(p => {
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

    const supabase = createAdminClient();

    const { data: plans } = await supabase
        .from('plans')
        .select('strategy');

    const grouped: Record<string, number> = {
        AVALANCHE: 0,
        SNOWBALL: 0,
        HYBRID: 0,
    };

    plans?.forEach(p => {
        if (grouped[p.strategy] !== undefined) {
            grouped[p.strategy]++;
        }
    });

    return Object.entries(grouped).map(([strategy, count]) => ({ strategy, count }));
}

// ============================================
// ENGAGEMENT METRICS
// ============================================

export async function getEngagementMetrics(): Promise<EngagementMetrics> {
    await requirePermission('dashboard:read');

    const supabase = createAdminClient();

    // Users with debts
    const { data: debtUsers } = await supabase
        .from('debts')
        .select('user_id')
        .eq('status', 'ACTIVE');
    const uniqueDebtUsers = new Set(debtUsers?.map(d => d.user_id));

    // Users with payments
    const { data: paymentUsers } = await supabase
        .from('payments')
        .select('user_id');
    const uniquePaymentUsers = new Set(paymentUsers?.map(p => p.user_id));

    // Users with plans
    const { data: planUsers } = await supabase
        .from('plans')
        .select('user_id');
    const uniquePlanUsers = new Set(planUsers?.map(p => p.user_id));

    // Users with forecasts
    const { data: forecastUsers } = await supabase
        .from('forecasts')
        .select('user_id');
    const uniqueForecastUsers = new Set(forecastUsers?.map(f => f.user_id));

    // Total plans
    const { count: totalPlans } = await supabase
        .from('plans')
        .select('*', { count: 'exact', head: true });

    // Alerts by type
    const { data: alerts } = await supabase
        .from('alerts')
        .select('type');

    const alertGroups: Record<string, number> = {};
    alerts?.forEach(a => {
        alertGroups[a.type] = (alertGroups[a.type] || 0) + 1;
    });

    return {
        usersWithDebts: uniqueDebtUsers.size,
        usersWithPayments: uniquePaymentUsers.size,
        usersWithPlans: uniquePlanUsers.size,
        usersWithForecasts: uniqueForecastUsers.size,
        totalPlansGenerated: totalPlans || 0,
        alertsByType: Object.entries(alertGroups).map(([type, count]) => ({ type, count })),
    };
}

// ============================================
// RECENT USERS
// ============================================

export async function getRecentUsers(limit: number = 10): Promise<RecentUser[]> {
    await requirePermission('dashboard:read');

    const supabase = createAdminClient();

    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('user_id, created_at, onboarding_completed')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching recent users:', error);
        return [];
    }

    if (!users?.length) return [];

    const userIds = users.map(user => user.user_id);

    const [{ data: debts, error: debtsError }, { data: subscriptions, error: subsError }] = await Promise.all([
        supabase
            .from('debts')
            .select('user_id, status')
            .in('user_id', userIds),
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

    const debtCountByUser = new Map<string, number>();
    (debts || []).forEach(debt => {
        if (debt.status !== 'ACTIVE') return;
        debtCountByUser.set(debt.user_id, (debtCountByUser.get(debt.user_id) || 0) + 1);
    });

    const subscriptionByUser = new Map<string, string>();
    (subscriptions || []).forEach(subscription => {
        subscriptionByUser.set(subscription.user_id, subscription.plan_code || 'FREE');
    });

    return users.map(user => {
        const debtCount = debtCountByUser.get(user.user_id) || 0;
        const planCode = subscriptionByUser.get(user.user_id) || 'FREE';

        return {
            id: user.user_id,
            email: `user-${user.user_id.slice(0, 8)}...`,
            createdAt: user.created_at,
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
