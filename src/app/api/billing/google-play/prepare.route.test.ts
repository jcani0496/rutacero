import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
    requireUserTenant,
    createAdminClient,
    readAttributionStateFromCookies,
    recordMarketingEvent,
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
    logApiRequest,
    logApiError,
    logPaymentEvent,
    logSecurityEvent,
    getGooglePlayPublicConfig,
    createGooglePlayObfuscatedAccountId,
} = vi.hoisted(() => ({
    requireUserTenant: vi.fn(),
    createAdminClient: vi.fn(),
    readAttributionStateFromCookies: vi.fn(),
    recordMarketingEvent: vi.fn(),
    applyRateLimit: vi.fn(),
    getClientIdentifier: vi.fn(() => '127.0.0.1'),
    rateLimitExceededResponse: vi.fn(() =>
        new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    ),
    logApiRequest: vi.fn(),
    logApiError: vi.fn(),
    logPaymentEvent: vi.fn(),
    logSecurityEvent: vi.fn(),
    getGooglePlayPublicConfig: vi.fn(() => ({
        productId: 'pro_pass_30d',
        packageName: 'com.rutacero.app',
        passDurationDays: 30,
        mockMode: true,
    })),
    createGooglePlayObfuscatedAccountId: vi.fn(() => 'obf_123'),
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

vi.mock('@/lib/billing/google-play', () => ({
    getGooglePlayPublicConfig,
    createGooglePlayObfuscatedAccountId,
}));

import { POST } from '@/app/api/billing/google-play/prepare/route';

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

describe('POST /api/billing/google-play/prepare', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        applyRateLimit.mockResolvedValue({ success: true });
    });

    it('records Android checkout context and returns purchase launch data', async () => {
        const subscriptionUpsert = vi.fn(async () => ({ error: null }));
        const subscriptionsSelect = createSubscriptionsSelectResult({
            plan_code: 'FREE',
            marketing_context: {
                sticky: 'keep-me',
            },
        });
        const plansSelect = createPlansSelectResult({ strategy: 'SNOWBALL' });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'subscriptions') {
                    return {
                        select: vi.fn(() => subscriptionsSelect),
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

                throw new Error(`Unexpected admin table: ${table}`);
            }),
        };

        requireUserTenant.mockResolvedValue({
            supabase,
            user: {
                id: '550e8400-e29b-41d4-a716-446655440001',
            },
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
        });
        createAdminClient.mockReturnValue(adminSupabase);
        readAttributionStateFromCookies.mockResolvedValue({
            attributionId: 'attr-1',
            updatedAt: '2026-04-05T00:00:00.000Z',
            firstTouch: null,
            lastTouch: {
                source: 'meta',
                medium: 'paid_social',
                ctaContext: 'pricing',
                path: '/pricing',
                capturedAt: '2026-04-04T00:00:00.000Z',
            },
        });

        const request = new NextRequest('https://rutacero.test/api/billing/google-play/prepare', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                ctaContext: 'pricing_banner',
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            productId: 'pro_pass_30d',
            packageName: 'com.rutacero.app',
            passDurationDays: 30,
            obfuscatedAccountId: 'obf_123',
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
                    ctaContext: 'pricing_banner',
                    path: '/checkout',
                    planStrategy: 'SNOWBALL',
                }),
            }),
            { onConflict: 'tenant_id' }
        );
        expect(recordMarketingEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: 'checkout_started',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                metadata: expect.objectContaining({
                    platform: 'android',
                    provider: 'google_play',
                }),
            })
        );
    });
});
