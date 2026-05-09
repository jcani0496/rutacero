import { describe, it, expect } from 'vitest';
import { computeFunnel } from '@/lib/funnel/aggregate';

describe('computeFunnel', () => {
    it('computes step counts and conversion rates', () => {
        const events = [
            { event_name: 'pricing_viewed' },
            { event_name: 'pricing_viewed' },
            { event_name: 'pricing_viewed' },
            { event_name: 'pricing_viewed' },
            { event_name: 'checkout_started' },
            { event_name: 'checkout_started' },
            { event_name: 'payment_succeeded' },
        ];
        const result = computeFunnel(events);
        expect(result.pricing_viewed).toBe(4);
        expect(result.checkout_started).toBe(2);
        expect(result.payment_succeeded).toBe(1);
        expect(result.conversion_pricing_to_checkout).toBeCloseTo(0.5);
        expect(result.conversion_checkout_to_payment).toBeCloseTo(0.5);
        expect(result.conversion_pricing_to_payment).toBeCloseTo(0.25);
    });

    it('returns zero rates when no events', () => {
        const result = computeFunnel([]);
        expect(result.conversion_pricing_to_payment).toBe(0);
        expect(result.pricing_viewed).toBe(0);
    });

    it('ignores unknown event names', () => {
        const events = [
            { event_name: 'pricing_viewed' },
            { event_name: 'random_event' },
            { event_name: 'something_else' },
        ];
        const result = computeFunnel(events);
        expect(result.pricing_viewed).toBe(1);
        expect(result.checkout_started).toBe(0);
    });
});
