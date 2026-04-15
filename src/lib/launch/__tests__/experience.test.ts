import { describe, expect, it } from 'vitest';

import { buildTrackedHref, resolveLaunchExperience } from '@/lib/launch/experience';

describe('launch experience helpers', () => {
    it('preserves tracked params while overriding CTA context', () => {
        const searchParams = new URLSearchParams({
            utm_source: 'meta',
            campaign_id: 'cmp-1',
            partner_slug: 'cooperativa-central',
            landing_variant: 'clarity',
            offer_variant: 'partner_faststart',
            cta_context: 'landing',
        });

        expect(buildTrackedHref('/checkout', searchParams, { ctaContext: 'pricing' })).toBe(
            '/checkout?utm_source=meta&campaign_id=cmp-1&partner_slug=cooperativa-central&landing_variant=clarity&offer_variant=partner_faststart&cta_context=pricing'
        );
    });

    it('builds reusable partner landing copy and tracked CTA hrefs', () => {
        const experience = resolveLaunchExperience({
            partnerSlug: 'cooperativa-central',
            searchParams: {
                utm_source: 'partner-email',
                offer_variant: 'partner_faststart',
            },
        });

        expect(experience.partnerName).toBe('Cooperativa Central');
        expect(experience.landing.heroBadge).toContain('Cooperativa Central');
        expect(experience.landing.heroPrimaryHref).toContain('/signup?');
        expect(experience.landing.heroPrimaryHref).toContain('partner_slug=cooperativa-central');
        expect(experience.landing.heroPrimaryHref).toContain('cta_context=landing_signup');
        expect(experience.pricing.checkoutHref).toContain('offer_variant=partner_faststart');
    });

    it('applies landing variant copy overrides without losing default upgrade wiring', () => {
        const experience = resolveLaunchExperience({
            searchParams: {
                landing_variant: 'clarity',
            },
        });

        expect(experience.landing.heroBadge).toBe('Mas claridad antes de tomar decisiones');
        expect(experience.pricing.description).toContain('mas claridad');
        expect(experience.plan.upgradeCtaHref).toBe('/checkout?landing_variant=clarity&cta_context=plan');
    });
});
