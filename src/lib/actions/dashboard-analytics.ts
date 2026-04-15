'use server';

import { getUserTimezone } from '@/lib/utils/timezone';
import { requireUserTenant } from '@/lib/tenant/server';

// ============================================
// TYPES
// ============================================

export interface PaymentHistoryItem {
    month: string;
    amount: number;
    count: number;
}

export interface DebtDistributionItem {
    name: string;
    value: number;
    type: string;
    color: string;
    [key: string]: unknown;
}

export interface DebtProjectionItem {
    month: string;
    balance: number;
    paid: number;
}

export interface InterestSavings {
    withMinimums: number;
    withPlan: number;
    savings: number;
    monthsSaved: number;
}

export interface FinancialIndicators {
    debtToIncomeRatio: number;
    monthlyProgress: number;
    daysToNextPayment: number;
    avgMonthlyPayment: number;
    totalPaid: number;
    percentagePaid: number;
}

// Chart colors
const CHART_COLORS = [
    '#22c55e', // green-500
    '#3b82f6', // blue-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
];

// ============================================
// GET PAYMENT HISTORY (Last 6 months)
// ============================================

export async function getPaymentHistory(): Promise<PaymentHistoryItem[]> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return [];
    }

    // Get payments from last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gte('payment_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('payment_date', { ascending: true });

    // INFO-011: Get user's timezone for date formatting
    const userTimezone = await getUserTimezone();

    if (!payments || payments.length === 0) {
        // Return empty months for chart
        const months: PaymentHistoryItem[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push({
                month: d.toLocaleDateString('es-GT', { month: 'short', timeZone: userTimezone }),
                amount: 0,
                count: 0,
            });
        }
        return months;
    }

    // Group by month
    const monthlyData = new Map<string, { amount: number; count: number }>();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData.set(key, { amount: 0, count: 0 });
    }

    payments.forEach(p => {
        const date = new Date(p.payment_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = monthlyData.get(key) || { amount: 0, count: 0 };
        current.amount += Number(p.amount);
        current.count += 1;
        monthlyData.set(key, current);
    });

    return Array.from(monthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, data]) => {
            const [year, month] = key.split('-');
            const date = new Date(Number(year), Number(month) - 1);
            return {
                month: date.toLocaleDateString('es-GT', { month: 'short', timeZone: userTimezone }),
                amount: data.amount,
                count: data.count,
            };
        });
}

// ============================================
// GET DEBT DISTRIBUTION
// ============================================

export async function getDebtDistribution(): Promise<DebtDistributionItem[]> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return [];
    }

    const { data: debts } = await supabase
        .from('debts')
        .select('creditor, type, balance')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('balance', { ascending: false });

    if (!debts || debts.length === 0) return [];

    return debts.map((debt, index) => ({
        name: debt.creditor,
        value: Number(debt.balance),
        type: debt.type,
        color: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

// ============================================
// GET DEBT PROJECTION (Based on active plan)
// ============================================

export async function getDebtProjection(): Promise<DebtProjectionItem[]> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return [];
    }

    // Get active plan
    const { data: plan } = await supabase
        .from('plans')
        .select('*, plan_items(*)')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('active', true)
        .single();

    // Get current total debt
    const { data: debts } = await supabase
        .from('debts')
        .select('balance, min_payment')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    if (!debts || debts.length === 0) return [];

    const totalDebt = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalMinPayment = debts.reduce((sum, d) => sum + Number(d.min_payment), 0);

    // If no plan, project with minimum payments
    const monthlyPayment = plan?.plan_items?.[0]?.planned_amount || totalMinPayment;

    // INFO-011: Get user's timezone for date formatting
    const userTimezone = await getUserTimezone();

    // Calculate projection (simplified - assumes constant payment)
    const projection: DebtProjectionItem[] = [];
    let balance = totalDebt;
    let totalPaid = 0;
    const now = new Date();

    for (let i = 0; i <= 12; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i);
        projection.push({
            month: monthDate.toLocaleDateString('es-GT', {
                month: 'short',
                year: i >= 12 ? '2-digit' : undefined,
                timeZone: userTimezone
            }),
            balance: Math.max(0, balance),
            paid: totalPaid,
        });

        if (balance > 0) {
            const payment = Math.min(monthlyPayment, balance);
            balance -= payment;
            totalPaid += payment;
        }
    }

    return projection;
}

// ============================================
// GET INTEREST SAVINGS
// ============================================

export async function getInterestSavings(): Promise<InterestSavings> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { withMinimums: 0, withPlan: 0, savings: 0, monthsSaved: 0 };
    }

    const { data: debts } = await supabase
        .from('debts')
        .select('balance, apr, min_payment')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    if (!debts || debts.length === 0) {
        return { withMinimums: 0, withPlan: 0, savings: 0, monthsSaved: 0 };
    }

    // Get active plan
    const { data: plan } = await supabase
        .from('plans')
        .select('interest_estimate, eta_debt_free')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('active', true)
        .single();

    // Calculate interest if paying minimums only (simplified calculation)
    let totalInterestMinimums = 0;
    let monthsWithMinimums = 0;

    debts.forEach(debt => {
        const balance = Number(debt.balance);
        const apr = Number(debt.apr) || 0;
        const minPayment = Number(debt.min_payment) || 100;
        const monthlyRate = apr / 100 / 12;

        let remaining = balance;
        let months = 0;
        let totalInterest = 0;
        const maxMonths = 360; // 30 years cap

        while (remaining > 0 && months < maxMonths) {
            const interest = remaining * monthlyRate;
            totalInterest += interest;
            const principal = Math.min(minPayment - interest, remaining);
            remaining -= Math.max(0, principal);
            months++;
        }

        totalInterestMinimums += totalInterest;
        monthsWithMinimums = Math.max(monthsWithMinimums, months);
    });

    // Interest with plan (from saved estimate or calculate)
    const interestWithPlan = plan?.interest_estimate ? Number(plan.interest_estimate) : totalInterestMinimums * 0.6;

    // Calculate months with plan
    let monthsWithPlan = monthsWithMinimums;
    if (plan?.eta_debt_free) {
        const etaDate = new Date(plan.eta_debt_free);
        const now = new Date();
        const diffMonths = (etaDate.getFullYear() - now.getFullYear()) * 12 + (etaDate.getMonth() - now.getMonth());
        monthsWithPlan = Math.max(0, diffMonths);
    }

    return {
        withMinimums: Math.round(totalInterestMinimums),
        withPlan: Math.round(interestWithPlan),
        savings: Math.round(totalInterestMinimums - interestWithPlan),
        monthsSaved: Math.max(0, monthsWithMinimums - monthsWithPlan),
    };
}

// ============================================
// GET FINANCIAL INDICATORS
// ============================================

export async function getFinancialIndicators(): Promise<FinancialIndicators> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return {
            debtToIncomeRatio: 0,
            monthlyProgress: 0,
            daysToNextPayment: 0,
            avgMonthlyPayment: 0,
            totalPaid: 0,
            percentagePaid: 0,
        };
    }

    // Get debts
    const { data: debts } = await supabase
        .from('debts')
        .select('balance, next_payment_date')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('next_payment_date', { ascending: true });

    const totalDebt = debts?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;

    // Get income
    const { data: incomes } = await supabase
        .from('income_events')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const totalMonthlyIncome = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

    // Get total payments ever made
    const { data: allPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

    const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Get payments last 6 months for average
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: recentPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gte('payment_date', sixMonthsAgo.toISOString().split('T')[0]);

    const totalRecentPayments = recentPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const avgMonthlyPayment = recentPayments && recentPayments.length > 0 ? totalRecentPayments / 6 : 0;

    // Days to next payment
    let daysToNextPayment = 0;
    if (debts && debts.length > 0 && debts[0].next_payment_date) {
        const nextDate = new Date(debts[0].next_payment_date);
        const now = new Date();
        const diffTime = nextDate.getTime() - now.getTime();
        daysToNextPayment = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Calculate percentage paid (total paid vs original debt)
    const originalDebt = totalDebt + totalPaid;
    const percentagePaid = originalDebt > 0 ? (totalPaid / originalDebt) * 100 : 0;

    // Monthly progress (how much debt reduced last month)
    const monthlyProgress = avgMonthlyPayment > 0 && totalDebt > 0
        ? (avgMonthlyPayment / totalDebt) * 100
        : 0;

    return {
        debtToIncomeRatio: totalMonthlyIncome > 0 ? (totalDebt / (totalMonthlyIncome * 12)) * 100 : 0,
        monthlyProgress,
        daysToNextPayment,
        avgMonthlyPayment,
        totalPaid,
        percentagePaid,
    };
}

// ============================================
// GET USER SUBSCRIPTION STATUS
// ============================================

export async function getUserSubscription(): Promise<{ isPro: boolean; planCode: string }> {
    let supabase, tenantId;
    try {
        ({ supabase, tenantId } = await requireUserTenant());
    } catch {
        return { isPro: false, planCode: 'FREE' };
    }

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_code, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE')
        .single();

    const planCode = subscription?.plan_code || 'FREE';
    const isPro = planCode === 'PRO' || planCode === 'BUSINESS';

    return { isPro, planCode };
}
