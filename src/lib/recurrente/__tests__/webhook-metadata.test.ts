import { describe, expect, it } from 'vitest';

import {
    marketingContextFromStoredSubscription,
    parsePaymentMetadata,
    parseRecurrenteMetadata,
    planStrategyFromStoredSubscription,
} from '@/lib/recurrente/webhook-metadata';

describe('webhook metadata helpers', () => {
    it('accepts known payment metadata while ignoring unknown fields', () => {
        const metadata = parsePaymentMetadata({
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            plan_strategy: 'AVALANCHE',
            attribution_id: 'attr-1',
            source: 'meta',
            unknown_field: 'ignore-me',
        });

        expect(metadata).toMatchObject({
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            plan_strategy: 'AVALANCHE',
            attribution_id: 'attr-1',
            source: 'meta',
        });
    });

    it('parses partial recurrente metadata for cancellation fallback', () => {
        const metadata = parseRecurrenteMetadata({
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            path: '/checkout',
            extra: 'ignored',
        });

        expect(metadata).toMatchObject({
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            path: '/checkout',
        });
    });

    it('restores marketing context from stored subscription json with fallback attribution', () => {
        const context = marketingContextFromStoredSubscription({
            source: 'meta',
            medium: 'paid_social',
            ctaContext: 'checkout',
            path: '/checkout',
        }, 'attr-1');

        expect(context).toMatchObject({
            attributionId: 'attr-1',
            source: 'meta',
            medium: 'paid_social',
            ctaContext: 'checkout',
            path: '/checkout',
        });
    });

    it('recovers stored plan strategy from subscription context', () => {
        expect(planStrategyFromStoredSubscription({
            planStrategy: 'HYBRID',
        })).toBe('HYBRID');
    });
});
