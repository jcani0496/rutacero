import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Json, TablesInsert } from '@/types/supabase';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { readAttributionStateFromCookies } from '@/lib/funnel/attribution-server';
import { recordMarketingEvent } from '@/lib/funnel/events';
import { getRecurrenteClient } from '@/lib/recurrente/client';
import { PRO_VARIANTS, getProVariant, type ProVariantCode } from '@/lib/billing/plans';
import { billingIntervalForVariant } from '@/lib/billing/billing-interval';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logApiRequest, logApiError, logPaymentEvent, logSecurityEvent } from '@/lib/logger';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    drizzleFindActiveSubscriptionByTenantId,
    drizzleGetActivePlanStrategy,
    drizzleUpsertCheckoutContext,
    drizzleUpsertSubscriptionByTenant,
} from '@/lib/billing/drizzle';
import type { SubscriptionMapped } from '@/lib/data/mappers';

const variantCodes = PRO_VARIANTS.map((v) => v.code) as [ProVariantCode, ...ProVariantCode[]];

const CheckoutBody = z.object({
    variantCode: z.enum(variantCodes).default('PRO_MONTHLY'),
    ctaContext: z.string().nullable().optional(),
});

function getJsonObject(value: Json | null | undefined): Record<string, Json> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, Json>;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const identifier = getClientIdentifier(request);

    try {
        // Apply rate limiting before any work (cost control before auth)
        const { success } = await applyRateLimit(identifier, 'checkout');

        if (!success) {
            logSecurityEvent({
                event: 'rate_limit_exceeded',
                ip: identifier,
                path: '/api/recurrente/create-checkout',
            });
            return rateLimitExceededResponse();
        }

        // Require authentication before parsing body or leaking variant info
        const { supabase, user, tenantId } = await requireUserTenant();

        const parsed = CheckoutBody.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: 'INVALID_VARIANT' }, { status: 400 });
        }
        const { variantCode, ctaContext } = parsed.data;
        const variant = getProVariant(variantCode);

        if (variant.code === 'PRO_PASS_90D') {
            return NextResponse.json(
                { error: 'ANDROID_ONLY_VARIANT', message: 'PRO_PASS_90D solo está disponible vía Google Play.' },
                { status: 400 }
            );
        }

        // Check if user already has active subscription
        let existingSubscription: SubscriptionMapped | {
            plan_code: string;
            marketing_context?: Json | null;
        } | null = null;

        if (isDrizzleEnabled()) {
            existingSubscription = await drizzleFindActiveSubscriptionByTenantId(tenantId);
        } else {
            const { data } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('status', 'ACTIVE')
                .single();
            existingSubscription = data;
        }

        if (existingSubscription && existingSubscription.plan_code !== 'FREE') {
            logApiRequest({
                method: 'POST',
                path: '/api/recurrente/create-checkout',
                userId: user.id,
                ip: identifier,
                statusCode: 400,
                duration: Date.now() - startTime,
            });
            return NextResponse.json(
                { error: 'Ya tienes una suscripción activa' },
                { status: 400 }
            );
        }

        let planStrategy: string | null = null;
        if (isDrizzleEnabled()) {
            planStrategy = await drizzleGetActivePlanStrategy(tenantId, user.id);
        } else {
            const { data: activePlan } = await supabase
                .from('plans')
                .select('strategy')
                .eq('tenant_id', tenantId)
                .eq('user_id', user.id)
                .eq('active', true)
                .maybeSingle();
            planStrategy = activePlan?.strategy || null;
        }

        // Get base URL
        const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Create checkout session with Recurrente
        const recurrente = getRecurrenteClient();
        const attributionState = await readAttributionStateFromCookies();
        const marketingContext = createMarketingContext(attributionState, {
            ctaContext: ctaContext ?? null,
            path: '/checkout',
        });
        const recurrenteMetadata = {
            tenant_id: tenantId,
            purchaser_user_id: user.id,
            plan_code: 'PRO',
            variant_code: variant.code,
            one_time: String(variant.isOneTime),
            ...(marketingContext.attributionId ? { attribution_id: marketingContext.attributionId } : {}),
            ...(marketingContext.source ? { source: marketingContext.source } : {}),
            ...(marketingContext.medium ? { medium: marketingContext.medium } : {}),
            ...(marketingContext.campaignId ? { campaign_id: marketingContext.campaignId } : {}),
            ...(marketingContext.campaignName ? { campaign_name: marketingContext.campaignName } : {}),
            ...(marketingContext.creativeId ? { creative_id: marketingContext.creativeId } : {}),
            ...(marketingContext.creativeName ? { creative_name: marketingContext.creativeName } : {}),
            ...(marketingContext.partnerSlug ? { partner_slug: marketingContext.partnerSlug } : {}),
            ...(marketingContext.referralCode ? { referral_code: marketingContext.referralCode } : {}),
            ...(marketingContext.landingVariant ? { landing_variant: marketingContext.landingVariant } : {}),
            ...(marketingContext.offerVariant ? { offer_variant: marketingContext.offerVariant } : {}),
            ...(marketingContext.ctaContext ? { cta_context: marketingContext.ctaContext } : {}),
            ...(marketingContext.path ? { path: marketingContext.path } : {}),
            ...(planStrategy ? { plan_strategy: planStrategy } : {}),
            ...(marketingContext.firstTouch ? { first_touch_json: JSON.stringify(marketingContext.firstTouch) } : {}),
            ...(marketingContext.lastTouch ? { last_touch_json: JSON.stringify(marketingContext.lastTouch) } : {}),
        };
        const persistedMarketingContext = ({
            ...getJsonObject(existingSubscription?.marketing_context as Json | undefined),
            ...marketingContext,
            ...(planStrategy ? { planStrategy } : {}),
        }) as Json;
        const admin = isDrizzleEnabled() ? null : createAdminClient();

        if (isDrizzleEnabled()) {
            await drizzleUpsertSubscriptionByTenant({
                tenantId,
                userId: user.id,
                purchaserUserId: user.id,
                attributionId: marketingContext.attributionId,
                marketingContext: persistedMarketingContext,
                billingInterval: billingIntervalForVariant(variant.code),
                priceAmountQ: variant.priceQ,
                paymentMethod: 'recurrente',
            });
        } else {
            const { error: subscriptionPersistenceError } = await admin.from('subscriptions').upsert({
                tenant_id: tenantId,
                user_id: user.id,
                purchaser_user_id: user.id,
                attribution_id: marketingContext.attributionId,
                marketing_context: persistedMarketingContext,
                billing_interval: billingIntervalForVariant(variant.code),
                price_amount_q: variant.priceQ,
                payment_method: 'recurrente',
            }, {
                onConflict: 'tenant_id',
            });

            if (subscriptionPersistenceError) {
                throw subscriptionPersistenceError;
            }
        }

        const checkout = await recurrente.createCheckout({
            amount: variant.priceQ,
            currency: 'GTQ',
            description: variant.label,
            interval: variant.isOneTime ? undefined : (variant.recurrenteInterval ?? 'monthly'),
            oneTime: variant.isOneTime,
            successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_ID}`,
            cancelUrl: `${baseUrl}/checkout?canceled=true`,
            customerEmail: user.email,
            metadata: recurrenteMetadata,
        });
        const checkoutContextRecord: TablesInsert<'recurrente_checkout_contexts'> = {
            checkout_id: checkout.id,
            tenant_id: tenantId,
            purchaser_user_id: user.id,
            plan_code: 'PRO',
            attribution_id: marketingContext.attributionId,
            marketing_context: persistedMarketingContext,
        };
        if (isDrizzleEnabled()) {
            await drizzleUpsertCheckoutContext({
                checkoutId: checkout.id,
                tenantId,
                purchaserUserId: user.id,
                planCode: 'PRO',
                attributionId: marketingContext.attributionId ?? null,
                marketingContext: persistedMarketingContext,
            });
        } else {
            const { error: checkoutContextError } = await admin
                .from('recurrente_checkout_contexts')
                .upsert(checkoutContextRecord, {
                    onConflict: 'checkout_id',
                });

            if (checkoutContextError) {
                throw checkoutContextError;
            }
        }

        await recordMarketingEvent({
            eventName: 'checkout_started',
            tenantId,
            userId: user.id,
            path: '/checkout',
            planStrategy,
            marketingContext,
        });

        logPaymentEvent({
            event: 'checkout_created',
            userId: user.id,
            amount: variant.priceQ,
            currency: 'GTQ',
            provider: 'recurrente',
            externalId: checkout.id,
        });

        logApiRequest({
            method: 'POST',
            path: '/api/recurrente/create-checkout',
            userId: user.id,
            ip: identifier,
            statusCode: 200,
            duration: Date.now() - startTime,
        });

        return NextResponse.json({
            checkoutUrl: checkout.checkout_url,
            checkoutId: checkout.id,
        });
    } catch (error) {
        logApiError({
            method: 'POST',
            path: '/api/recurrente/create-checkout',
            error,
            statusCode: 500,
        });
        return NextResponse.json(
            { error: 'Error al crear el checkout' },
            { status: 500 }
        );
    }
}
