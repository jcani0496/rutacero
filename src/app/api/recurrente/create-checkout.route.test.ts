import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
    requireUserTenant,
    createAdminClient,
    readAttributionStateFromCookies,
    recordMarketingEvent,
    getRecurrenteClient,
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
    logApiRequest,
    logApiError,
    logPaymentEvent,
    logSecurityEvent,
} = vi.hoisted(() => ({
    requireUserTenant: vi.fn(),
    createAdminClient: vi.fn(),
    readAttributionStateFromCookies: vi.fn(),
    recordMarketingEvent: vi.fn(),
    getRecurrenteClient: vi.fn(),
    applyRateLimit: vi.fn(),
    getClientIdentifier: vi.fn(() => '127.0.0.1'),
    rateLimitExceededResponse: vi.fn(() =>
        new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    ),
    logApiRequest: vi.fn(),
    logApiError: vi.fn(),
    logPaymentEvent: vi.fn(),
    logSecurityEvent: vi.fn(),
}));

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant,
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient,
}));

vi.mock('@/lib/funnel/attribution-server', () => ({
    readAttributionStateFromCookies,
}));

vi.mock('@/lib/funnel/events', () => ({
    recordMarketingEvent,
}));

vi.mock('@/lib/recurrente/client', () => ({
    getRecurrenteClient,
}));

vi.mock('@/lib/rate-limit', () => ({
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
}));

vi.mock('@/lib/logger', () => ({
    logApiRequest,
    logApiError,
    logPaymentEvent,
    logSecurityEvent,
}));

import { POST } from '@/app/api/recurrente/create-checkout/route';

function createSubscriptionsSelectResult(existingSubscription: Record<string, unknown> | null) {
    const chain = {
        eq: vi.fn(),
        single: vi.fn(async () => ({ data: existingSubscription, error: null })),
    };

    chain.eq.mockReturnValue(chain);
    return chain;
}

function createPlansSelectResult(activePlan: { strategy: string } | null) {
    const chain = {
        eq: vi.fn(),
        maybeSingle: vi.fn(async () => ({ data: activePlan, error: null })),
    };

    chain.eq.mockReturnValue(chain);
    return chain;
}

describe('POST /api/recurrente/create-checkout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_APP_URL = 'https://rutacero.test';
        applyRateLimit.mockResolvedValue({ success: true });
    });

    it('creates a checkout with merged attribution and plan strategy context', async () => {
        const subscriptionUpsert = vi.fn(async () => ({ error: null }));
        const checkoutContextUpsert = vi.fn(async () => ({ error: null }));
        const subscriptionsSelect = createSubscriptionsSelectResult({
            plan_code: 'FREE',
            marketing_context: {
                sticky: 'keep-me',
            },
        });
        const plansSelect = createPlansSelectResult({ strategy: 'AVALANCHE' });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'subscriptions') {
                    return {
                        select: vi.fn(() => subscriptionsSelect),
                        upsert: subscriptionUpsert,
                    };
                }

                if (table === 'plans') {
                    return {
                        select: vi.fn(() => plansSelect),
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            }),
        };
        const adminSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'subscriptions') {
                    return {
                        upsert: subscriptionUpsert,
                    };
                }

                if (table === 'recurrente_checkout_contexts') {
                    return {
                        upsert: checkoutContextUpsert,
                    };
                }

                throw new Error(`Unexpected admin table: ${table}`);
            }),
        };
        const createCheckout = vi.fn(async () => ({
            id: 'chk_123',
            checkout_url: 'https://checkout.recurrente.test/chk_123',
            status: 'created',
        }));

        requireUserTenant.mockResolvedValue({
            supabase,
            user: {
                id: '550e8400-e29b-41d4-a716-446655440001',
                email: 'buyer@rutacero.test',
            },
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
        });
        createAdminClient.mockReturnValue(adminSupabase);
        readAttributionStateFromCookies.mockResolvedValue({
            attributionId: 'attr-1',
            updatedAt: '2026-04-05T00:00:00.000Z',
            firstTouch: {
                source: 'meta',
                medium: 'paid_social',
                campaignId: 'camp-1',
                campaignName: 'Launch',
                creativeId: 'creative-1',
                creativeName: 'Video A',
                partnerSlug: null,
                referralCode: null,
                landingVariant: 'clarity',
                offerVariant: null,
                ctaContext: 'landing',
                path: '/',
                capturedAt: '2026-04-01T00:00:00.000Z',
            },
            lastTouch: {
                source: 'meta',
                medium: 'paid_social',
                campaignId: 'camp-1',
                campaignName: 'Launch',
                creativeId: 'creative-1',
                creativeName: 'Video A',
                partnerSlug: 'cooperativa-central',
                referralCode: null,
                landingVariant: 'clarity',
                offerVariant: 'value',
                ctaContext: 'pricing',
                path: '/pricing',
                capturedAt: '2026-04-04T00:00:00.000Z',
            },
        });
        getRecurrenteClient.mockReturnValue({
            createCheckout,
        });

        const request = new NextRequest('https://rutacero.test/api/recurrente/create-checkout', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                origin: 'https://rutacero.test',
            },
            body: JSON.stringify({
                ctaContext: 'pricing_banner',
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            checkoutUrl: 'https://checkout.recurrente.test/chk_123',
            checkoutId: 'chk_123',
        });

        expect(subscriptionUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                user_id: '550e8400-e29b-41d4-a716-446655440001',
                purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
                attribution_id: 'attr-1',
                marketing_context: expect.objectContaining({
                    sticky: 'keep-me',
                    attributionId: 'attr-1',
                    source: 'meta',
                    medium: 'paid_social',
                    partnerSlug: 'cooperativa-central',
                    ctaContext: 'pricing_banner',
                    path: '/checkout',
                    planStrategy: 'AVALANCHE',
                }),
            }),
            { onConflict: 'tenant_id' }
        );
        expect(checkoutContextUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                checkout_id: 'chk_123',
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
                plan_code: 'PRO',
                attribution_id: 'attr-1',
                marketing_context: expect.objectContaining({
                    sticky: 'keep-me',
                    attributionId: 'attr-1',
                    source: 'meta',
                    medium: 'paid_social',
                    partnerSlug: 'cooperativa-central',
                    ctaContext: 'pricing_banner',
                    path: '/checkout',
                    planStrategy: 'AVALANCHE',
                }),
            }),
            { onConflict: 'checkout_id' }
        );

        expect(createCheckout).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 49,
                currency: 'GTQ',
                customerEmail: 'buyer@rutacero.test',
                successUrl: 'https://rutacero.test/checkout/success?session_id={CHECKOUT_ID}',
                cancelUrl: 'https://rutacero.test/checkout?canceled=true',
                metadata: expect.objectContaining({
                    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                    purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
                    plan_code: 'PRO',
                    attribution_id: 'attr-1',
                    source: 'meta',
                    medium: 'paid_social',
                    campaign_id: 'camp-1',
                    creative_id: 'creative-1',
                    partner_slug: 'cooperativa-central',
                    landing_variant: 'clarity',
                    offer_variant: 'value',
                    cta_context: 'pricing_banner',
                    path: '/checkout',
                    plan_strategy: 'AVALANCHE',
                    first_touch_json: expect.any(String),
                    last_touch_json: expect.any(String),
                }),
            })
        );

        expect(recordMarketingEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: 'checkout_started',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'AVALANCHE',
                marketingContext: expect.objectContaining({
                    attributionId: 'attr-1',
                    ctaContext: 'pricing_banner',
                    path: '/checkout',
                }),
            })
        );
    });

    it('rejects checkout creation when the tenant already has a paid active subscription', async () => {
        const subscriptionsSelect = createSubscriptionsSelectResult({
            plan_code: 'PRO',
        });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'subscriptions') {
                    return {
                        select: vi.fn(() => subscriptionsSelect),
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            }),
        };
        const createCheckout = vi.fn();

        requireUserTenant.mockResolvedValue({
            supabase,
            user: {
                id: '550e8400-e29b-41d4-a716-446655440001',
                email: 'buyer@rutacero.test',
            },
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
        });
        createAdminClient.mockReturnValue({
            from: vi.fn(),
        });
        getRecurrenteClient.mockReturnValue({
            createCheckout,
        });

        const request = new NextRequest('https://rutacero.test/api/recurrente/create-checkout', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'Ya tienes una suscripción activa',
        });
        expect(createCheckout).not.toHaveBeenCalled();
        expect(recordMarketingEvent).not.toHaveBeenCalled();
    });
});
