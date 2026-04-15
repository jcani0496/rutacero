import { describe, expect, it } from 'vitest';

import { buildGtmScorecardRows, GTM_SCORECARD_HEADERS } from '@/lib/funnel/scorecard';

describe('GTM scorecard', () => {
    it('aggregates weekly slices, canonical channels, dropoff surfaces, and lifecycle rates', () => {
        const rows = buildGtmScorecardRows([
            {
                occurred_at: '2026-04-01T10:00:00.000Z',
                event_name: 'landing_viewed',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: null,
                metadata: null,
            },
            {
                occurred_at: '2026-04-01T10:01:00.000Z',
                event_name: 'signup_started',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'signup',
                plan_strategy: null,
                metadata: null,
            },
            {
                occurred_at: '2026-04-02T10:00:00.000Z',
                event_name: 'checkout_started',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: 'AVALANCHE',
                metadata: null,
            },
            {
                occurred_at: '2026-04-02T12:00:00.000Z',
                event_name: 'payment_succeeded',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: 'AVALANCHE',
                metadata: null,
            },
            {
                occurred_at: '2026-04-03T08:00:00.000Z',
                event_name: 'payment_failed',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: 'AVALANCHE',
                metadata: null,
            },
            {
                occurred_at: '2026-04-03T09:00:00.000Z',
                event_name: 'failed_payment_recovered',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: 'AVALANCHE',
                metadata: null,
            },
            {
                occurred_at: '2026-04-03T09:30:00.000Z',
                event_name: 'subscription_activated',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: 'AVALANCHE',
                metadata: null,
            },
            {
                occurred_at: '2026-04-04T09:30:00.000Z',
                event_name: 'subscription_canceled',
                attribution_id: 'journey-1',
                tenant_id: 'tenant-1',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: 'AVALANCHE',
                metadata: null,
            },
            {
                occurred_at: '2026-04-03T10:00:00.000Z',
                event_name: 'dropoff_reported',
                attribution_id: 'journey-2',
                tenant_id: 'tenant-2',
                source: 'meta',
                medium: 'paid_social',
                referral_code: null,
                campaign_id: 'camp-1',
                campaign_name: 'Abril Meta',
                creative_id: 'creative-1',
                creative_name: 'Video A',
                partner_slug: 'acme',
                landing_variant: 'clarity',
                offer_variant: 'value',
                cta_context: 'pricing',
                plan_strategy: null,
                metadata: {
                    reason: 'El precio no me convence todavia',
                    surface: 'pricing',
                },
            },
        ]);

        const headerIndex = Object.fromEntries(
            GTM_SCORECARD_HEADERS.map((header, index) => [header, index])
        ) as Record<string, number>;

        expect(GTM_SCORECARD_HEADERS).toContain('dropoff_reason_mix');
        expect(GTM_SCORECARD_HEADERS).toContain('dropoff_surface_mix');
        expect(GTM_SCORECARD_HEADERS).toContain('landing_to_signup_rate');
        expect(GTM_SCORECARD_HEADERS).toContain('payment_recovery_rate');
        expect(GTM_SCORECARD_HEADERS).toContain('activation_to_churn_rate');

        const channelRow = rows.find((row) => row[1] === 'channel' && row[2] === 'paid_social');
        expect(channelRow).toBeDefined();
        expect(channelRow?.[headerIndex.landing_viewed]).toBe('1');
        expect(channelRow?.[headerIndex.signup_started]).toBe('1');
        expect(channelRow?.[headerIndex.checkout_started]).toBe('1');
        expect(channelRow?.[headerIndex.payment_succeeded]).toBe('1');
        expect(channelRow?.[headerIndex.failed_payment_recovered]).toBe('1');
        expect(channelRow?.[headerIndex.subscription_activated]).toBe('1');
        expect(channelRow?.[headerIndex.subscription_canceled]).toBe('1');
        expect(channelRow?.[headerIndex.landing_to_signup_rate]).toBe('100.0%');
        expect(channelRow?.[headerIndex.signup_to_checkout_rate]).toBe('100.0%');
        expect(channelRow?.[headerIndex.checkout_to_paid_rate]).toBe('100.0%');
        expect(channelRow?.[headerIndex.dropoff_reason_mix]).toContain('El precio no me convence todavia: 1');
        expect(channelRow?.[headerIndex.dropoff_surface_mix]).toContain('pricing: 1');
        expect(channelRow?.[headerIndex.net_subscriber_delta]).toBe('0');
        expect(channelRow?.[headerIndex.payment_recovery_rate]).toBe('100.0%');
        expect(channelRow?.[headerIndex.activation_to_churn_rate]).toBe('100.0%');

        const sourceMediumRow = rows.find((row) => row[1] === 'source_medium' && row[2] === 'meta / paid_social');
        expect(sourceMediumRow).toBeDefined();

        const campaignRow = rows.find((row) => row[1] === 'campaign' && row[2] === 'Abril Meta');
        expect(campaignRow).toBeDefined();

        const journeyRow = rows.find((row) => row[1] === 'journey' && row[2] === 'attribution:journey-1');
        expect(journeyRow).toBeDefined();

        const strategyRow = rows.find((row) => row[1] === 'plan_strategy' && row[2] === 'AVALANCHE');
        expect(strategyRow?.[headerIndex.checkout_started]).toBe('1');

        const dropoffSurfaceRow = rows.find((row) => row[1] === 'dropoff_surface' && row[2] === 'pricing');
        expect(dropoffSurfaceRow?.[headerIndex.dropoff_reported]).toBe('1');
    });
});
