import type { ProVariantCode } from '@/lib/billing/plans';

export type ManualBillingInterval =
    | 'monthly'
    | 'quarterly'
    | 'yearly'
    | 'pass_30d'
    | 'pass_90d';

/**
 * Map a PRO variant code to the canonical `subscriptions.billing_interval`
 * value persisted to the database. Centralized so the create-checkout endpoint,
 * the webhook handler, and admin grant flow all agree.
 */
export function billingIntervalForVariant(code: ProVariantCode): ManualBillingInterval {
    switch (code) {
        case 'PRO_MONTHLY':
            return 'monthly';
        case 'PRO_QUARTERLY':
            return 'quarterly';
        case 'PRO_ANNUAL':
            return 'yearly';
        case 'PRO_PASS_90D':
            return 'pass_90d';
    }
}
