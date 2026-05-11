import type { Json } from '@/types/supabase';
import {
    marketingContextFromMetadata,
    type MarketingContext,
} from '@/lib/funnel/attribution';
import {
    paymentMetadataSchema,
    recurrenteMetadataSchema,
} from '@/lib/validations/api';

const RECURRENTE_METADATA_KEYS = [
    'tenant_id',
    'purchaser_user_id',
    'plan_code',
    'plan_strategy',
    'attribution_id',
    'source',
    'medium',
    'campaign_id',
    'campaign_name',
    'creative_id',
    'creative_name',
    'partner_slug',
    'referral_code',
    'landing_variant',
    'offer_variant',
    'cta_context',
    'path',
    'first_touch_json',
    'last_touch_json',
    'variant_code',
    'one_time',
] as const;

export function parseRecurrenteMetadata(metadata: unknown) {
    const extracted = extractKnownRecurrenteMetadata(metadata);
    if (!extracted) return null;

    const parsed = recurrenteMetadataSchema.safeParse(extracted);
    return parsed.success ? parsed.data : null;
}

export function parsePaymentMetadata(metadata: unknown) {
    const extracted = extractKnownRecurrenteMetadata(metadata);
    if (!extracted) return null;

    const parsed = paymentMetadataSchema.safeParse(extracted);
    return parsed.success ? parsed.data : null;
}

export function marketingContextFromStoredSubscription(
    value: Json,
    fallbackAttributionId?: string | null
): MarketingContext | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return fallbackAttributionId
            ? marketingContextFromMetadata({ attribution_id: fallbackAttributionId })
            : null;
    }

    const stored = value as Record<string, unknown>;
    return marketingContextFromMetadata({
        attribution_id: typeof stored.attributionId === 'string'
            ? stored.attributionId
            : fallbackAttributionId || undefined,
        source: typeof stored.source === 'string' ? stored.source : undefined,
        medium: typeof stored.medium === 'string' ? stored.medium : undefined,
        campaign_id: typeof stored.campaignId === 'string' ? stored.campaignId : undefined,
        campaign_name: typeof stored.campaignName === 'string' ? stored.campaignName : undefined,
        creative_id: typeof stored.creativeId === 'string' ? stored.creativeId : undefined,
        creative_name: typeof stored.creativeName === 'string' ? stored.creativeName : undefined,
        partner_slug: typeof stored.partnerSlug === 'string' ? stored.partnerSlug : undefined,
        referral_code: typeof stored.referralCode === 'string' ? stored.referralCode : undefined,
        landing_variant: typeof stored.landingVariant === 'string' ? stored.landingVariant : undefined,
        offer_variant: typeof stored.offerVariant === 'string' ? stored.offerVariant : undefined,
        cta_context: typeof stored.ctaContext === 'string' ? stored.ctaContext : undefined,
        path: typeof stored.path === 'string' ? stored.path : undefined,
        first_touch_json: safeJsonStringify(stored.firstTouch),
        last_touch_json: safeJsonStringify(stored.lastTouch),
    });
}

export function planStrategyFromStoredSubscription(
    value: Json
): 'AVALANCHE' | 'SNOWBALL' | 'HYBRID' | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const planStrategy = (value as Record<string, unknown>).planStrategy;
    return planStrategy === 'AVALANCHE' || planStrategy === 'SNOWBALL' || planStrategy === 'HYBRID'
        ? planStrategy
        : null;
}

function extractKnownRecurrenteMetadata(
    metadata: unknown
): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return null;
    }

    const record = metadata as Record<string, unknown>;
    return Object.fromEntries(
        RECURRENTE_METADATA_KEYS.flatMap((key) =>
            record[key] === undefined ? [] : [[key, record[key]]]
        )
    );
}

function safeJsonStringify(value: unknown): string | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    return JSON.stringify(value);
}
