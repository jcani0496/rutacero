'use client';

import { useEffect, useRef } from 'react';

import type { MarketingEventName } from '@/lib/funnel/events';
import { trackMarketingEvent } from '@/lib/funnel/client';

interface FunnelEventTrackerProps {
    eventName: MarketingEventName;
    ctaContext?: string;
    landingVariant?: string;
    offerVariant?: string;
    metadata?: Record<string, unknown>;
}

export function FunnelEventTracker({
    eventName,
    ctaContext,
    landingVariant,
    offerVariant,
    metadata,
}: FunnelEventTrackerProps) {
    const trackedRef = useRef(false);

    useEffect(() => {
        if (trackedRef.current) return;
        trackedRef.current = true;
        void trackMarketingEvent({
            eventName,
            ctaContext,
            landingVariant,
            offerVariant,
            metadata,
        });
    }, [ctaContext, eventName, landingVariant, metadata, offerVariant]);

    return null;
}
