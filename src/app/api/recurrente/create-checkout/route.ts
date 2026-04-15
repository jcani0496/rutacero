import { NextRequest, NextResponse } from 'next/server';
import type { Json, TablesInsert } from '@/types/supabase';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { readAttributionStateFromCookies } from '@/lib/funnel/attribution-server';
import { recordMarketingEvent } from '@/lib/funnel/events';
import { getRecurrenteClient } from '@/lib/recurrente/client';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logApiRequest, logApiError, logPaymentEvent, logSecurityEvent } from '@/lib/logger';

const PRO_PLAN = {
    name: 'RutaCero PRO',
    price: 49,
    currency: 'GTQ' as const,
    interval: 'monthly' as const,
};

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
        const requestBody = await request.json().catch(() => null) as { ctaContext?: string | null } | null;
        // Apply rate limiting
        const { success } = await applyRateLimit(identifier, 'checkout');

        if (!success) {
            logSecurityEvent({
                event: 'rate_limit_exceeded',
                ip: identifier,
                path: '/api/recurrente/create-checkout',
            });
            return rateLimitExceededResponse();
        }

        const { supabase, user, tenantId } = await requireUserTenant();

        // Check if user already has active subscription
        const { data: existingSubscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('status', 'ACTIVE')
            .single();

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

        const { data: activePlan } = await supabase
            .from('plans')
            .select('strategy')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id)
            .eq('active', true)
            .maybeSingle();
        const planStrategy = activePlan?.strategy || null;

        // Get base URL
        const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Create checkout session with Recurrente
        const recurrente = getRecurrenteClient();
        const attributionState = await readAttributionStateFromCookies();
        const marketingContext = createMarketingContext(attributionState, {
            ctaContext: requestBody?.ctaContext || null,
            path: '/checkout',
        });
        const recurrenteMetadata = {
            tenant_id: tenantId,
            purchaser_user_id: user.id,
            plan_code: 'PRO',
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
        const admin = createAdminClient();

        const { error: subscriptionPersistenceError } = await admin.from('subscriptions').upsert({
            tenant_id: tenantId,
            user_id: user.id,
            purchaser_user_id: user.id,
            attribution_id: marketingContext.attributionId,
            marketing_context: persistedMarketingContext,
        }, {
            onConflict: 'tenant_id',
        });

        if (subscriptionPersistenceError) {
            throw subscriptionPersistenceError;
        }

        const checkout = await recurrente.createCheckout({
            amount: PRO_PLAN.price,
            currency: PRO_PLAN.currency,
            description: `${PRO_PLAN.name} - Suscripción Mensual`,
            interval: PRO_PLAN.interval,
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
        const { error: checkoutContextError } = await admin
            .from('recurrente_checkout_contexts')
            .upsert(checkoutContextRecord, {
                onConflict: 'checkout_id',
            });

        if (checkoutContextError) {
            throw checkoutContextError;
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
            amount: PRO_PLAN.price,
            currency: PRO_PLAN.currency,
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
