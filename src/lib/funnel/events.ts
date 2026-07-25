import { createAdminClient } from '@/lib/supabase/server';
import type { Json, TablesInsert } from '@/types/supabase';
import {
    createMarketingContext,
    type MarketingContext,
    type TrackingOverrides,
} from '@/lib/funnel/attribution';
import { readAttributionStateFromCookies } from '@/lib/funnel/attribution-server';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { drizzleInsertMarketingFunnelEvent } from '@/lib/billing/drizzle';

export const MARKETING_EVENT_NAMES = [
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
] as const;

export type MarketingEventName = (typeof MARKETING_EVENT_NAMES)[number];

export interface RecordMarketingEventInput {
    eventName: MarketingEventName;
    tenantId?: string | null;
    userId?: string | null;
    email?: string | null;
    dedupeKey?: string | null;
    path?: string | null;
    planStrategy?: string | null;
    metadata?: Record<string, unknown>;
    overrides?: TrackingOverrides;
    marketingContext?: MarketingContext | null;
    occurredAt?: string;
}

export async function recordMarketingEvent(
    input: RecordMarketingEventInput
): Promise<void> {
    const state = input.marketingContext ? null : await readAttributionStateFromCookies();
    const marketingContext = input.marketingContext || createMarketingContext(state, input.overrides);

    if (isDrizzleEnabled()) {
        await drizzleInsertMarketingFunnelEvent({
            tenantId: input.tenantId || null,
            userId: input.userId || null,
            email: input.email || null,
            eventName: input.eventName,
            occurredAt: input.occurredAt || new Date().toISOString(),
            attributionId: marketingContext.attributionId,
            source: marketingContext.source,
            medium: marketingContext.medium,
            campaignId: marketingContext.campaignId,
            campaignName: marketingContext.campaignName,
            creativeId: marketingContext.creativeId,
            creativeName: marketingContext.creativeName,
            partnerSlug: marketingContext.partnerSlug,
            referralCode: marketingContext.referralCode,
            landingVariant: marketingContext.landingVariant,
            offerVariant: marketingContext.offerVariant,
            ctaContext: marketingContext.ctaContext,
            path: input.path || marketingContext.path,
            planStrategy: input.planStrategy || null,
            firstTouch: marketingContext.firstTouch || {},
            lastTouch: marketingContext.lastTouch || {},
            metadata: input.metadata || {},
            dedupeKey: input.dedupeKey || null,
        });
        return;
    }

    const admin = isDrizzleEnabled() ? null : createAdminClient();
    await recordMarketingEventWithAdmin(admin, input, marketingContext);
}

export async function recordMarketingEventWithAdmin(
    admin: ReturnType<typeof createAdminClient>,
    input: RecordMarketingEventInput,
    marketingContext: MarketingContext
): Promise<void> {
    if (isDrizzleEnabled()) {
        await drizzleInsertMarketingFunnelEvent({
            tenantId: input.tenantId || null,
            userId: input.userId || null,
            email: input.email || null,
            eventName: input.eventName,
            occurredAt: input.occurredAt || new Date().toISOString(),
            attributionId: marketingContext.attributionId,
            source: marketingContext.source,
            medium: marketingContext.medium,
            campaignId: marketingContext.campaignId,
            campaignName: marketingContext.campaignName,
            creativeId: marketingContext.creativeId,
            creativeName: marketingContext.creativeName,
            partnerSlug: marketingContext.partnerSlug,
            referralCode: marketingContext.referralCode,
            landingVariant: marketingContext.landingVariant,
            offerVariant: marketingContext.offerVariant,
            ctaContext: marketingContext.ctaContext,
            path: input.path || marketingContext.path,
            planStrategy: input.planStrategy || null,
            firstTouch: marketingContext.firstTouch || {},
            lastTouch: marketingContext.lastTouch || {},
            metadata: input.metadata || {},
            dedupeKey: input.dedupeKey || null,
        });
        return;
    }

    const eventRecord: TablesInsert<'marketing_funnel_events'> = {
        tenant_id: input.tenantId || null,
        user_id: input.userId || null,
        email: input.email || null,
        event_name: input.eventName,
        occurred_at: input.occurredAt || new Date().toISOString(),
        attribution_id: marketingContext.attributionId,
        source: marketingContext.source,
        medium: marketingContext.medium,
        campaign_id: marketingContext.campaignId,
        campaign_name: marketingContext.campaignName,
        creative_id: marketingContext.creativeId,
        creative_name: marketingContext.creativeName,
        partner_slug: marketingContext.partnerSlug,
        referral_code: marketingContext.referralCode,
        landing_variant: marketingContext.landingVariant,
        offer_variant: marketingContext.offerVariant,
        cta_context: marketingContext.ctaContext,
        path: input.path || marketingContext.path,
        plan_strategy: input.planStrategy || null,
        first_touch: (marketingContext.firstTouch || {}) as Json,
        last_touch: (marketingContext.lastTouch || {}) as Json,
        metadata: (input.metadata || {}) as Json,
        dedupe_key: input.dedupeKey || null,
    };

    await admin.from('marketing_funnel_events').insert(eventRecord);
}
