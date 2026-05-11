import { DropoffCapture } from '@/components/funnel/dropoff-capture';
import { FunnelEventTracker } from '@/components/funnel/funnel-event-tracker';
import { CTASection } from '@/components/landing/cta-section';
import { FAQSection } from '@/components/landing/faq';
import { FeaturesSection } from '@/components/landing/features';
import { Footer } from '@/components/landing/footer';
import { HeroSection } from '@/components/landing/hero';
import { HowItWorksSection } from '@/components/landing/how-it-works';
import { PricingSection } from '@/components/landing/pricing-preview';
import { StickyMobileNav } from '@/components/landing/sticky-mobile-nav';
import type { LaunchExperience } from '@/lib/launch/experience';

interface LandingSurfaceProps {
    experience: LaunchExperience;
}

export function LandingSurface({ experience }: LandingSurfaceProps) {
    return (
        <main className="min-h-screen bg-background">
            <StickyMobileNav
                primaryHref={experience.landing.heroPrimaryHref}
                primaryLabel={experience.landing.heroPrimaryLabel}
            />
            <FunnelEventTracker
                eventName="landing_viewed"
                ctaContext="landing"
                landingVariant={experience.landingVariant || undefined}
                offerVariant={experience.offerVariant || undefined}
            />
            <HeroSection
                badge={experience.landing.heroBadge}
                headlinePrefix={experience.landing.heroHeadlinePrefix}
                headlineWords={experience.landing.heroHeadlineWords}
                subheadline={experience.landing.heroSubheadline}
                primaryHref={experience.landing.heroPrimaryHref}
                primaryLabel={experience.landing.heroPrimaryLabel}
                secondaryHref={experience.landing.heroSecondaryHref}
                secondaryLabel={experience.landing.heroSecondaryLabel}
            />
            <FeaturesSection />
            <HowItWorksSection />
            <PricingSection
                freeCtaLabel={experience.landing.pricingFreeLabel}
                freeCtaHref={experience.landing.pricingFreeHref}
                proDescription={experience.pricing.proPlanDescription}
                proCtaLabel={experience.landing.pricingProLabel}
                proCtaHref={experience.landing.pricingProHref}
            />
            <section className="px-4 pb-10">
                <div className="mx-auto max-w-4xl">
                    <DropoffCapture surface="landing" />
                </div>
            </section>
            <FAQSection />
            <CTASection
                headline={experience.landing.ctaHeadline}
                accent={experience.landing.ctaAccent}
                description={experience.landing.ctaDescription}
                primaryHref={experience.landing.ctaPrimaryHref}
                primaryLabel={experience.landing.ctaPrimaryLabel}
                secondaryHref={experience.landing.ctaSecondaryHref}
                secondaryLabel={experience.landing.ctaSecondaryLabel}
            />
            <Footer />
        </main>
    );
}
