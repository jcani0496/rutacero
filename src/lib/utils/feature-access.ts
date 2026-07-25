// Server-side utility functions for feature access control
// This module should only be imported from server components or server actions

import { cache } from 'react';
import { requireUserTenant } from '@/lib/tenant/server';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    drizzleCountActiveDebts,
    drizzleFindActiveSubscriptionByTenantId,
} from '@/lib/billing/drizzle';

// ============================================
// PLAN LIMITS CONFIGURATION
// ============================================

export interface PlanLimits {
    maxDebts: number;
    maxPaymentsHistory: number; // months of history visible
    canExport: boolean;
    canUseWhatIf: boolean;
    canUseMultipleStrategies: boolean;
    canUseCustomTags: boolean;
    canUseBudgetAlerts: boolean;
    canUseDebtGoals: boolean;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
    FREE: {
        maxDebts: 5,
        maxPaymentsHistory: 3,
        canExport: false,
        canUseWhatIf: false,
        canUseMultipleStrategies: false,
        canUseCustomTags: false,
        canUseBudgetAlerts: false,
        canUseDebtGoals: false,
    },
    PRO: {
        maxDebts: Infinity,
        maxPaymentsHistory: Infinity,
        canExport: true,
        canUseWhatIf: true,
        canUseMultipleStrategies: true,
        canUseCustomTags: true,
        canUseBudgetAlerts: true,
        canUseDebtGoals: true,
    },
    BUSINESS: {
        maxDebts: Infinity,
        maxPaymentsHistory: Infinity,
        canExport: true,
        canUseWhatIf: true,
        canUseMultipleStrategies: true,
        canUseCustomTags: true,
        canUseBudgetAlerts: true,
        canUseDebtGoals: true,
    },
};

// ============================================
// GET USER PLAN
// ============================================

// Per-request memoized (audit 2026-07, perf P1): several actions call this
// alongside their own requireUserTenant + limit checks; cache() collapses
// the duplicate subscription lookups within one request.
export const getUserPlan = cache(
    async (): Promise<{ planCode: string; isPro: boolean; limits: PlanLimits }> => {
        const { supabase, tenantId } = await requireUserTenant();

        let planCode = 'FREE';
        if (isDrizzleEnabled()) {
            const subscription = await drizzleFindActiveSubscriptionByTenantId(tenantId);
            planCode = subscription?.plan_code || 'FREE';
        } else {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('plan_code, status')
                .eq('tenant_id', tenantId)
                .eq('status', 'ACTIVE')
                .single();
            planCode = subscription?.plan_code || 'FREE';
        }

        const isPro = planCode === 'PRO' || planCode === 'BUSINESS';
        const limits = PLAN_LIMITS[planCode] || PLAN_LIMITS.FREE;

        return { planCode, isPro, limits };
    },
);

// ============================================
// CHECK DEBT LIMIT
// ============================================

export interface DebtLimitResult {
    canAdd: boolean;
    currentCount: number;
    maxAllowed: number;
    remaining: number;
    requiresUpgrade: boolean;
    /** True when FREE user is at the soft-cap (debt #6 would require PRO). */
    softCapHit: boolean;
    /** User-facing copy when upgrade is required (soft-cap / hard wall). */
    message: string | null;
}

export async function checkDebtLimit(): Promise<DebtLimitResult> {
    const { supabase, user, tenantId } = await requireUserTenant();

    // Get user's current debt count
    let currentCount = 0;
    if (isDrizzleEnabled()) {
        currentCount = await drizzleCountActiveDebts(tenantId, user.id);
    } else {
        const { count } = await supabase
            .from('debts')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE');
        currentCount = count || 0;
    }

    // Get plan limits
    const { limits, isPro } = await getUserPlan();
    const maxAllowed = limits.maxDebts;

    // PRO users have unlimited debts
    if (isPro) {
        return {
            canAdd: true,
            currentCount,
            maxAllowed: Infinity,
            remaining: Infinity,
            requiresUpgrade: false,
            softCapHit: false,
            message: null,
        };
    }

    const remaining = Math.max(0, maxAllowed - currentCount);
    const canAdd = currentCount < maxAllowed;
    const softCapHit = !canAdd;
    const message = softCapHit
        ? `Llegaste al límite de ${maxAllowed} deudas del plan Free. La #${maxAllowed + 1} y las que sigan requieren PRO.`
        : remaining === 1
          ? `Te queda 1 deuda en Free. La siguiente (#${maxAllowed + 1}) va a pedir PRO.`
          : null;

    return {
        canAdd,
        currentCount,
        maxAllowed,
        remaining,
        requiresUpgrade: !canAdd,
        softCapHit,
        message,
    };
}

// ============================================
// CHECK FEATURE ACCESS
// ============================================

export type FeatureName = 'export' | 'whatIf' | 'multipleStrategies' | 'customTags' | 'fullHistory' | 'budgetAlerts' | 'debtGoals';

export async function checkFeatureAccess(feature: FeatureName): Promise<{
    hasAccess: boolean;
    planCode: string;
    isPro: boolean;
}> {
    const { planCode, isPro, limits } = await getUserPlan();

    let hasAccess = false;

    switch (feature) {
        case 'export':
            hasAccess = limits.canExport;
            break;
        case 'whatIf':
            hasAccess = limits.canUseWhatIf;
            break;
        case 'multipleStrategies':
            hasAccess = limits.canUseMultipleStrategies;
            break;
        case 'customTags':
            hasAccess = limits.canUseCustomTags;
            break;
        case 'fullHistory':
            hasAccess = limits.maxPaymentsHistory === Infinity;
            break;
        case 'budgetAlerts':
            hasAccess = limits.canUseBudgetAlerts;
            break;
        case 'debtGoals':
            hasAccess = limits.canUseDebtGoals;
            break;
        default:
            hasAccess = false;
    }

    return { hasAccess, planCode, isPro };
}

// ============================================
// GET PLAN LIMITS
// ============================================

export function getPlanLimits(planCode: string): PlanLimits {
    return PLAN_LIMITS[planCode] || PLAN_LIMITS.FREE;
}
