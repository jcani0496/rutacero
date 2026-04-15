import { describe, expect, it, vi } from 'vitest';

import {
    createMarketingContext,
    deriveMarketingChannel,
    extractTrackingOverrides,
    inferCtaContextFromPath,
    marketingContextFromMetadata,
    mergeAttributionState,
} from '@/lib/funnel/attribution';

describe('attribution helpers', () => {
    it('infers CTA context from known paths', () => {
        expect(inferCtaContextFromPath('/')).toBe('landing');
        expect(inferCtaContextFromPath('/pricing')).toBe('pricing');
        expect(inferCtaContextFromPath('/plan')).toBe('plan');
        expect(inferCtaContextFromPath('/checkout')).toBe('checkout');
    });

    it('captures standard tracking parameters', () => {
        const searchParams = new URLSearchParams({
            utm_source: 'meta',
            utm_medium: 'paid_social',
            campaign_id: 'cmp-1',
            partner_slug: 'acme',
            landing_variant: 'clarity',
        });

        expect(extractTrackingOverrides(searchParams, '/pricing')).toMatchObject({
            source: 'meta',
            medium: 'paid_social',
            campaignId: 'cmp-1',
            partnerSlug: 'acme',
            landingVariant: 'clarity',
            ctaContext: 'pricing',
        });
    });

    it('infers partner slug from partner landing paths', () => {
        const searchParams = new URLSearchParams();

        expect(extractTrackingOverrides(searchParams, '/partners/cooperativa-central')).toMatchObject({
            partnerSlug: 'cooperativa-central',
            ctaContext: null,
        });
    });

    it('derives canonical marketing channels from source metadata', () => {
        expect(deriveMarketingChannel({
            source: 'meta',
            medium: 'paid_social',
        })).toBe('paid_social');

        expect(deriveMarketingChannel({
            source: 'google',
            medium: 'organic',
        })).toBe('organic_search');

        expect(deriveMarketingChannel({
            partnerSlug: 'cooperativa-central',
        })).toBe('partner');
    });

    it('preserves first touch and updates last touch', () => {
        const attributionIdFactory = vi.fn(() => 'attr-1');
        const first = mergeAttributionState(null, {
            source: 'meta',
            medium: 'paid_social',
            landingVariant: 'clarity',
        }, attributionIdFactory);

        const second = mergeAttributionState(first, {
            ctaContext: 'pricing',
            offerVariant: 'value-forward',
        }, attributionIdFactory);

        expect(second.attributionId).toBe('attr-1');
        expect(second.firstTouch?.source).toBe('meta');
        expect(second.lastTouch?.ctaContext).toBe('pricing');
        expect(second.lastTouch?.offerVariant).toBe('value-forward');
    });

    it('builds marketing context from stored touches plus overrides', () => {
        const context = createMarketingContext({
            attributionId: 'attr-1',
            updatedAt: new Date().toISOString(),
            firstTouch: {
                source: 'meta',
                medium: 'paid_social',
                campaignId: 'cmp-1',
                campaignName: null,
                creativeId: null,
                creativeName: null,
                partnerSlug: null,
                referralCode: null,
                landingVariant: 'clarity',
                offerVariant: null,
                ctaContext: 'landing',
                path: '/',
                capturedAt: new Date().toISOString(),
            },
            lastTouch: {
                source: 'meta',
                medium: 'paid_social',
                campaignId: 'cmp-1',
                campaignName: null,
                creativeId: null,
                creativeName: null,
                partnerSlug: 'employer-pilot',
                referralCode: null,
                landingVariant: 'clarity',
                offerVariant: 'post-plan',
                ctaContext: 'plan',
                path: '/plan',
                capturedAt: new Date().toISOString(),
            },
        }, {
            ctaContext: 'checkout',
            path: '/checkout',
        });

        expect(context.attributionId).toBe('attr-1');
        expect(context.partnerSlug).toBe('employer-pilot');
        expect(context.offerVariant).toBe('post-plan');
        expect(context.ctaContext).toBe('checkout');
        expect(context.path).toBe('/checkout');
    });

    it('does not mint a replacement attribution id from incomplete metadata', () => {
        expect(marketingContextFromMetadata({
            source: 'meta',
            medium: 'paid_social',
        })).toBeNull();
    });
});
