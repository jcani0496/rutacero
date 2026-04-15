import type { Json } from '@/types/supabase';
import { deriveMarketingChannel } from '@/lib/funnel/attribution';

interface ScorecardEventRow {
    occurred_at: string;
    event_name: string;
    attribution_id: string | null;
    tenant_id: string | null;
    source: string | null;
    medium: string | null;
    referral_code: string | null;
    campaign_id: string | null;
    campaign_name: string | null;
    creative_id: string | null;
    creative_name: string | null;
    partner_slug: string | null;
    landing_variant: string | null;
    offer_variant: string | null;
    cta_context: string | null;
    plan_strategy: string | null;
    metadata: Json | null;
}

interface ScorecardAccumulator {
    landingViewed: number;
    signupStarted: number;
    emailVerified: number;
    onboardingCompleted: number;
    firstDebtAdded: number;
    firstPlanGenerated: number;
    pricingViewed: number;
    checkoutStarted: number;
    paymentSucceeded: number;
    paymentFailed: number;
    failedPaymentRecovered: number;
    subscriptionActivated: number;
    subscriptionCanceled: number;
    dropoffReported: number;
    dropoffReasons: Record<string, number>;
    dropoffSurfaces: Record<string, number>;
}

function getWeekStart(isoDate: string): string {
    const date = new Date(isoDate);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString().slice(0, 10);
}

function createAccumulator(): ScorecardAccumulator {
    return {
        landingViewed: 0,
        signupStarted: 0,
        emailVerified: 0,
        onboardingCompleted: 0,
        firstDebtAdded: 0,
        firstPlanGenerated: 0,
        pricingViewed: 0,
        checkoutStarted: 0,
        paymentSucceeded: 0,
        paymentFailed: 0,
        failedPaymentRecovered: 0,
        subscriptionActivated: 0,
        subscriptionCanceled: 0,
        dropoffReported: 0,
        dropoffReasons: {},
        dropoffSurfaces: {},
    };
}

function increment(acc: ScorecardAccumulator, event: ScorecardEventRow) {
    switch (event.event_name) {
        case 'landing_viewed':
            acc.landingViewed++;
            break;
        case 'signup_started':
            acc.signupStarted++;
            break;
        case 'email_verified':
            acc.emailVerified++;
            break;
        case 'onboarding_completed':
            acc.onboardingCompleted++;
            break;
        case 'first_debt_added':
            acc.firstDebtAdded++;
            break;
        case 'first_plan_generated':
            acc.firstPlanGenerated++;
            break;
        case 'pricing_viewed':
            acc.pricingViewed++;
            break;
        case 'checkout_started':
            acc.checkoutStarted++;
            break;
        case 'payment_succeeded':
            acc.paymentSucceeded++;
            break;
        case 'payment_failed':
            acc.paymentFailed++;
            break;
        case 'failed_payment_recovered':
            acc.failedPaymentRecovered++;
            break;
        case 'subscription_activated':
            acc.subscriptionActivated++;
            break;
        case 'subscription_canceled':
            acc.subscriptionCanceled++;
            break;
        case 'dropoff_reported':
            acc.dropoffReported++;
            const reason = getDropoffReason(event.metadata);
            if (reason) {
                acc.dropoffReasons[reason] =
                    (acc.dropoffReasons[reason] || 0) + 1;
            }
            const surface = getDropoffSurface(event.metadata);
            if (surface) {
                acc.dropoffSurfaces[surface] =
                    (acc.dropoffSurfaces[surface] || 0) + 1;
            }
            break;
    }
}

function getDropoffReason(metadata: Json | null): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return null;
    }

    const reason = metadata.reason;
    return typeof reason === 'string' && reason.length > 0 ? reason : null;
}

function getDropoffSurface(metadata: Json | null): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return null;
    }

    const surface = metadata.surface;
    return typeof surface === 'string' && surface.length > 0 ? surface : null;
}

function formatDropoffReasons(reasons: Record<string, number>): string {
    return Object.entries(reasons)
        .sort((left, right) => right[1] - left[1])
        .map(([reason, count]) => `${reason}: ${count}`)
        .join(' | ');
}

function formatDropoffSurfaces(surfaces: Record<string, number>): string {
    return Object.entries(surfaces)
        .sort((left, right) => right[1] - left[1])
        .map(([surface, count]) => `${surface}: ${count}`)
        .join(' | ');
}

function getVariantValue(event: ScorecardEventRow): string {
    if (event.landing_variant && event.offer_variant) {
        return `${event.landing_variant} / ${event.offer_variant}`;
    }

    return event.landing_variant || event.offer_variant || 'sin-variant';
}

function getCampaignValue(event: ScorecardEventRow): string {
    return event.campaign_name || event.campaign_id || 'sin-campana';
}

function getCreativeValue(event: ScorecardEventRow): string {
    return event.creative_name || event.creative_id || 'sin-creativo';
}

function getJourneyValue(event: ScorecardEventRow): string {
    if (event.attribution_id) return `attribution:${event.attribution_id}`;
    if (event.tenant_id) return `tenant:${event.tenant_id}`;
    return 'anon';
}

function getChannelValue(event: ScorecardEventRow): string {
    return deriveMarketingChannel({
        source: event.source,
        medium: event.medium,
        partnerSlug: event.partner_slug,
        referralCode: event.referral_code,
    });
}

function getSourceMediumValue(event: ScorecardEventRow): string {
    return `${event.source || 'direct'} / ${event.medium || 'none'}`;
}

function formatRate(numerator: number, denominator: number): string {
    if (denominator <= 0) return '';
    return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function buildGtmScorecardRows(events: ScorecardEventRow[]) {
    const grouped = new Map<string, ScorecardAccumulator>();

    for (const event of events) {
        const weekStart = getWeekStart(event.occurred_at);
        const slices = [
            { type: 'channel', value: getChannelValue(event) },
            { type: 'source_medium', value: getSourceMediumValue(event) },
            { type: 'campaign', value: getCampaignValue(event) },
            { type: 'creative', value: getCreativeValue(event) },
            { type: 'partner', value: event.partner_slug || 'sin-partner' },
            { type: 'variant', value: getVariantValue(event) },
            { type: 'cta_context', value: event.cta_context || 'sin-contexto' },
            { type: 'plan_strategy', value: event.plan_strategy || 'sin-estrategia' },
            { type: 'journey', value: getJourneyValue(event) },
        ];

        const dropoffSurface = getDropoffSurface(event.metadata);
        if (dropoffSurface) {
            slices.push({ type: 'dropoff_surface', value: dropoffSurface });
        }

        for (const slice of slices) {
            const key = JSON.stringify([weekStart, slice.type, slice.value]);
            const acc = grouped.get(key) || createAccumulator();
            increment(acc, event);
            grouped.set(key, acc);
        }
    }

    return Array.from(grouped.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, acc]) => {
            const [weekStart, sliceType, sliceValue] = JSON.parse(key) as [string, string, string];

            return [
                weekStart,
                sliceType,
                sliceValue,
                String(acc.landingViewed),
                String(acc.signupStarted),
                String(acc.emailVerified),
                String(acc.onboardingCompleted),
                String(acc.firstDebtAdded),
                String(acc.firstPlanGenerated),
                String(acc.pricingViewed),
                String(acc.checkoutStarted),
                String(acc.paymentSucceeded),
                String(acc.paymentFailed),
                String(acc.failedPaymentRecovered),
                String(acc.subscriptionActivated),
                String(acc.subscriptionCanceled),
                String(acc.dropoffReported),
                formatRate(acc.signupStarted, acc.landingViewed),
                formatRate(acc.checkoutStarted, acc.signupStarted),
                formatRate(acc.paymentSucceeded, acc.checkoutStarted),
                formatDropoffReasons(acc.dropoffReasons),
                formatDropoffSurfaces(acc.dropoffSurfaces),
                String(acc.subscriptionActivated - acc.subscriptionCanceled),
                formatRate(acc.failedPaymentRecovered, acc.paymentFailed),
                formatRate(acc.subscriptionCanceled, acc.subscriptionActivated),
            ];
        });
}

export const GTM_SCORECARD_HEADERS = [
    'week_start',
    'slice_type',
    'slice_value',
    'landing_viewed',
    'signup_started',
    'email_verified',
    'onboarding_completed',
    'first_debt_added',
    'first_plan_generated',
    'pricing_viewed',
    'checkout_started',
    'payment_succeeded',
    'payment_failed',
    'failed_payment_recovered',
    'subscription_activated',
    'subscription_canceled',
    'dropoff_reported',
    'landing_to_signup_rate',
    'signup_to_checkout_rate',
    'checkout_to_paid_rate',
    'dropoff_reason_mix',
    'dropoff_surface_mix',
    'net_subscriber_delta',
    'payment_recovery_rate',
    'activation_to_churn_rate',
];
