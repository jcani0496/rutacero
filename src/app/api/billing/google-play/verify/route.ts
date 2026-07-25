import { NextRequest, NextResponse } from 'next/server';
import type { Json } from '@/types/supabase';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { recordMarketingEvent } from '@/lib/funnel/events';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logApiError, logApiRequest, logPaymentEvent, logSecurityEvent } from '@/lib/logger';
import {
    calculateGooglePlayPassExpiresAt,
    consumeGooglePlayPurchase,
    createGooglePlayObfuscatedAccountId,
    getGooglePlayPublicConfig,
    verifyGooglePlayPurchase,
} from '@/lib/billing/google-play';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    drizzleFindBillingEntitlementByToken,
    drizzleFindSubscriptionByTenantId,
    drizzleUpsertBillingEntitlement,
    drizzleUpsertSubscriptionByTenant,
} from '@/lib/billing/drizzle';
import type { BillingEntitlementMapped, SubscriptionMapped } from '@/lib/data/mappers';

interface VerifyGooglePlayRequestBody {
    orderId?: string | null;
    productId?: string | null;
    purchaseToken?: string | null;
}

function toMarketingMetadata(marketingContext: Json | null | undefined): Record<string, unknown> {
    if (!marketingContext || typeof marketingContext !== 'object' || Array.isArray(marketingContext)) {
        return {};
    }

    return marketingContext as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const identifier = getClientIdentifier(request);

    try {
        const requestBody = await request.json() as VerifyGooglePlayRequestBody;
        const { success } = await applyRateLimit(identifier, 'checkout');

        if (!success) {
            logSecurityEvent({
                event: 'rate_limit_exceeded',
                ip: identifier,
                path: '/api/billing/google-play/verify',
            });
            return rateLimitExceededResponse();
        }

        if (!requestBody.purchaseToken || !requestBody.productId) {
            return NextResponse.json(
                { error: 'Faltan datos de la compra' },
                { status: 400 }
            );
        }

        const { supabase, user, tenantId } = await requireUserTenant();
        const admin = isDrizzleEnabled() ? null : createAdminClient();
        let existingSubscription: SubscriptionMapped | {
            attribution_id?: string | null;
            marketing_context?: Json | null;
        } | null = null;

        if (isDrizzleEnabled()) {
            existingSubscription = await drizzleFindSubscriptionByTenantId(tenantId);
        } else {
            const { data } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('tenant_id', tenantId)
                .maybeSingle();
            existingSubscription = data;
        }
        const config = getGooglePlayPublicConfig();

        if (requestBody.productId !== config.productId) {
            return NextResponse.json(
                { error: 'Producto de Google Play no reconocido' },
                { status: 400 }
            );
        }

        const verifiedPurchase = await verifyGooglePlayPurchase({
            purchaseToken: requestBody.purchaseToken,
            productId: requestBody.productId,
        });

        if (verifiedPurchase.purchaseState === 'PENDING') {
            return NextResponse.json(
                { error: 'La compra aún está pendiente en Google Play' },
                { status: 409 }
            );
        }

        if (verifiedPurchase.purchaseState !== 'PURCHASED') {
            return NextResponse.json(
                { error: 'La compra no fue aprobada por Google Play' },
                { status: 400 }
            );
        }

        const expectedAccountId = createGooglePlayObfuscatedAccountId(user.id);
        // Fail CLOSED (audit 2026-07): a purchase whose obfuscated account id
        // is absent cannot prove it belongs to this user — accepting it let a
        // leaked/promo token grant PRO to whoever posted it first. The only
        // exception is explicit mock mode, whose stub verifier returns null.
        if (!verifiedPurchase.obfuscatedExternalAccountId) {
            if (!getGooglePlayPublicConfig().mockMode) {
                logSecurityEvent({
                    event: 'suspicious_activity',
                    ip: identifier,
                    path: '/api/billing/google-play/verify',
                    details: { userId: user.id, reason: 'gplay_purchase_missing_account_id' },
                });
                return NextResponse.json(
                    { error: 'La compra no incluye identificador de cuenta' },
                    { status: 403 }
                );
            }
        } else if (verifiedPurchase.obfuscatedExternalAccountId !== expectedAccountId) {
            return NextResponse.json(
                { error: 'La compra pertenece a otra cuenta' },
                { status: 403 }
            );
        }

        const expiresAt = calculateGooglePlayPassExpiresAt(verifiedPurchase.purchaseCompletedAt);
        const now = new Date().toISOString();
        let existingEntitlement: BillingEntitlementMapped | {
            user_id: string;
            tenant_id: string;
            granted_at?: string;
        } | null = null;

        if (isDrizzleEnabled()) {
            existingEntitlement = await drizzleFindBillingEntitlementByToken(
                'google_play',
                verifiedPurchase.purchaseToken,
            );
        } else {
            const { data } = await admin
                .from('billing_entitlements')
                .select('*')
                .eq('provider', 'google_play')
                .eq('purchase_token', verifiedPurchase.purchaseToken)
                .maybeSingle();
            existingEntitlement = data;
        }

        // A token already bound to a different account must never re-bind
        // (audit 2026-07): the upsert on (provider, purchase_token) would
        // otherwise transfer the entitlement to whoever replays the token.
        if (
            existingEntitlement &&
            (existingEntitlement.user_id !== user.id ||
                existingEntitlement.tenant_id !== tenantId)
        ) {
            logSecurityEvent({
                event: 'suspicious_activity',
                ip: identifier,
                path: '/api/billing/google-play/verify',
                details: { userId: user.id, reason: 'gplay_token_rebind_attempt' },
            });
            return NextResponse.json(
                { error: 'La compra pertenece a otra cuenta' },
                { status: 403 }
            );
        }

        if (isDrizzleEnabled()) {
            await drizzleUpsertBillingEntitlement({
                tenantId,
                userId: user.id,
                provider: 'google_play',
                platform: 'android',
                productId: verifiedPurchase.productId,
                purchaseToken: verifiedPurchase.purchaseToken,
                orderId: verifiedPurchase.orderId || requestBody.orderId || null,
                status: Date.parse(expiresAt) > Date.now() ? 'ACTIVE' : 'EXPIRED',
                grantedAt: existingEntitlement?.granted_at || now,
                expiresAt,
                lastVerifiedAt: now,
                rawResponse: verifiedPurchase.raw,
            });
            await drizzleUpsertSubscriptionByTenant({
                tenantId,
                userId: user.id,
                purchaserUserId: user.id,
                planCode: 'PRO',
                status: 'ACTIVE',
                provider: 'google_play',
                externalId: verifiedPurchase.purchaseToken,
                renewAt: expiresAt,
                cancelAt: null,
                attributionId: existingSubscription?.attribution_id || null,
                marketingContext: existingSubscription?.marketing_context || {},
            });
        } else {
            const { error: entitlementUpsertError } = await admin
                .from('billing_entitlements')
                .upsert({
                    tenant_id: tenantId,
                    user_id: user.id,
                    provider: 'google_play',
                    platform: 'android',
                    product_id: verifiedPurchase.productId,
                    purchase_token: verifiedPurchase.purchaseToken,
                    order_id: verifiedPurchase.orderId || requestBody.orderId || null,
                    status: Date.parse(expiresAt) > Date.now() ? 'ACTIVE' : 'EXPIRED',
                    granted_at: existingEntitlement?.granted_at || now,
                    expires_at: expiresAt,
                    last_verified_at: now,
                    raw_response: verifiedPurchase.raw as Json,
                    updated_at: now,
                }, {
                    onConflict: 'provider,purchase_token',
                });

            if (entitlementUpsertError) {
                throw entitlementUpsertError;
            }

            const { error: subscriptionUpsertError } = await admin
                .from('subscriptions')
                .upsert({
                    tenant_id: tenantId,
                    user_id: user.id,
                    purchaser_user_id: user.id,
                    plan_code: 'PRO',
                    status: 'ACTIVE',
                    provider: 'google_play',
                    external_id: verifiedPurchase.purchaseToken,
                    renew_at: expiresAt,
                    cancel_at: null,
                    attribution_id: existingSubscription?.attribution_id || null,
                    marketing_context: (existingSubscription?.marketing_context || {}) as Json,
                    updated_at: now,
                }, {
                    onConflict: 'tenant_id',
                });

            if (subscriptionUpsertError) {
                throw subscriptionUpsertError;
            }
        }

        if (!existingEntitlement && verifiedPurchase.consumptionState !== 'CONSUMPTION_STATE_CONSUMED') {
            await consumeGooglePlayPurchase({
                purchaseToken: verifiedPurchase.purchaseToken,
                productId: verifiedPurchase.productId,
            });
        }

        if (!existingEntitlement) {
            const marketingMetadata = toMarketingMetadata(existingSubscription?.marketing_context as Json | undefined);

            await recordMarketingEvent({
                eventName: 'payment_succeeded',
                tenantId,
                userId: user.id,
                path: '/checkout',
                metadata: {
                    ...marketingMetadata,
                    provider: 'google_play',
                    productId: verifiedPurchase.productId,
                    orderId: verifiedPurchase.orderId,
                },
            });

            await recordMarketingEvent({
                eventName: 'subscription_activated',
                tenantId,
                userId: user.id,
                path: '/checkout/success',
                metadata: {
                    ...marketingMetadata,
                    provider: 'google_play',
                    productId: verifiedPurchase.productId,
                    orderId: verifiedPurchase.orderId,
                    expiresAt,
                },
            });
        }

        logPaymentEvent({
            event: 'payment_succeeded',
            userId: user.id,
            provider: 'google_play',
            externalId: verifiedPurchase.orderId || verifiedPurchase.purchaseToken,
        });
        logPaymentEvent({
            event: 'subscription_created',
            userId: user.id,
            provider: 'google_play',
            externalId: verifiedPurchase.purchaseToken,
        });

        logApiRequest({
            method: 'POST',
            path: '/api/billing/google-play/verify',
            userId: user.id,
            ip: identifier,
            statusCode: 200,
            duration: Date.now() - startTime,
        });

        return NextResponse.json({
            success: true,
            expiresAt,
            provider: 'google_play',
            productId: verifiedPurchase.productId,
        });
    } catch (error) {
        logApiError({
            method: 'POST',
            path: '/api/billing/google-play/verify',
            error,
            statusCode: 500,
        });
        return NextResponse.json(
            { error: 'No se pudo validar la compra con Google Play' },
            { status: 500 }
        );
    }
}
