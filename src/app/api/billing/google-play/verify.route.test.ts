import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
    requireUserTenant,
    createAdminClient,
    recordMarketingEvent,
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
    logApiRequest,
    logApiError,
    logPaymentEvent,
    logSecurityEvent,
    verifyGooglePlayPurchase,
    consumeGooglePlayPurchase,
    createGooglePlayObfuscatedAccountId,
    calculateGooglePlayPassExpiresAt,
    getGooglePlayPublicConfig,
} = vi.hoisted(() => ({
    requireUserTenant: vi.fn(),
    createAdminClient: vi.fn(),
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
    verifyGooglePlayPurchase: vi.fn(),
    consumeGooglePlayPurchase: vi.fn(),
    createGooglePlayObfuscatedAccountId: vi.fn(() => 'obf_123'),
    calculateGooglePlayPassExpiresAt: vi.fn(() => '2026-05-14T00:00:00.000Z'),
    getGooglePlayPublicConfig: vi.fn(() => ({
        productId: 'pro_pass_30d',
        packageName: 'com.rutacero.app',
        passDurationDays: 30,
        mockMode: true,
    })),
}));

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant,
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient,
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
    verifyGooglePlayPurchase,
    consumeGooglePlayPurchase,
    createGooglePlayObfuscatedAccountId,
    calculateGooglePlayPassExpiresAt,
    getGooglePlayPublicConfig,
}));

import { POST } from '@/app/api/billing/google-play/verify/route';

function createMaybeSingleChain(data: Record<string, unknown> | null) {
    const chain = {
        eq: vi.fn(),
        maybeSingle: vi.fn(async () => ({ data, error: null })),
    };

    chain.eq.mockReturnValue(chain);
    return chain;
}

describe('POST /api/billing/google-play/verify', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        applyRateLimit.mockResolvedValue({ success: true });
    });

    it('verifies a Google Play purchase, grants entitlement, and updates the subscription row', async () => {
        const billingEntitlementsSelect = createMaybeSingleChain(null);
        const billingEntitlementsUpsert = vi.fn(async () => ({ error: null }));
        const subscriptionUpsert = vi.fn(async () => ({ error: null }));
        const subscriptionSelect = createMaybeSingleChain({
            attribution_id: 'attr-1',
            marketing_context: {
                source: 'meta',
                ctaContext: 'pricing_banner',
            },
        });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'subscriptions') {
                    return {
                        select: vi.fn(() => subscriptionSelect),
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            }),
        };
        const adminSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'billing_entitlements') {
                    return {
                        select: vi.fn(() => billingEntitlementsSelect),
                        upsert: billingEntitlementsUpsert,
                    };
                }

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
        verifyGooglePlayPurchase.mockResolvedValue({
            purchaseToken: 'token-123',
            productId: 'pro_pass_30d',
            orderId: 'GPA.1234-5678',
            purchaseState: 'PURCHASED',
            purchaseCompletedAt: '2026-04-14T00:00:00.000Z',
            obfuscatedExternalAccountId: 'obf_123',
            regionCode: 'GT',
            acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
            consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
            raw: { ok: true },
        });

        const request = new NextRequest('https://rutacero.test/api/billing/google-play/verify', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                purchaseToken: 'token-123',
                productId: 'pro_pass_30d',
                orderId: 'GPA.1234-5678',
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            expiresAt: '2026-05-14T00:00:00.000Z',
            provider: 'google_play',
            productId: 'pro_pass_30d',
        });
        expect(billingEntitlementsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                user_id: '550e8400-e29b-41d4-a716-446655440001',
                provider: 'google_play',
                platform: 'android',
                product_id: 'pro_pass_30d',
                purchase_token: 'token-123',
                order_id: 'GPA.1234-5678',
                status: 'ACTIVE',
                expires_at: '2026-05-14T00:00:00.000Z',
            }),
            { onConflict: 'provider,purchase_token' }
        );
        expect(subscriptionUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                user_id: '550e8400-e29b-41d4-a716-446655440001',
                plan_code: 'PRO',
                provider: 'google_play',
                external_id: 'token-123',
                renew_at: '2026-05-14T00:00:00.000Z',
                attribution_id: 'attr-1',
            }),
            { onConflict: 'tenant_id' }
        );
        expect(consumeGooglePlayPurchase).toHaveBeenCalledWith({
            purchaseToken: 'token-123',
            productId: 'pro_pass_30d',
        });
        expect(recordMarketingEvent).toHaveBeenCalledTimes(2);
    });
});
