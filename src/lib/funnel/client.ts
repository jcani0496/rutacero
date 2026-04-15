import type { MarketingEventName } from '@/lib/funnel/events';

interface TrackMarketingEventInput {
    eventName: MarketingEventName;
    email?: string;
    path?: string;
    ctaContext?: string;
    landingVariant?: string;
    offerVariant?: string;
    planStrategy?: string;
    metadata?: Record<string, unknown>;
}

export async function trackMarketingEvent(input: TrackMarketingEventInput) {
    try {
        await fetch('/api/funnel/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...input,
                path: input.path || (typeof window !== 'undefined'
                    ? `${window.location.pathname}${window.location.search}`
                    : undefined),
            }),
        });
    } catch {
        // Best-effort instrumentation only.
    }
}
