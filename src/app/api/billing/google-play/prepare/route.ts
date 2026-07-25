import { NextRequest, NextResponse } from 'next/server';
import type { Json } from '@/types/supabase';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { readAttributionStateFromCookies } from '@/lib/funnel/attribution-server';
import { recordMarketingEvent } from '@/lib/funnel/events';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logApiError, logApiRequest, logPaymentEvent, logSecurityEvent } from '@/lib/logger';
import {
    createGooglePlayObfuscatedAccountId,
    getGooglePlayPublicConfig,
} from '@/lib/billing/google-play';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    drizzleFindActiveSubscriptionByTenantId,
    drizzleGetActivePlanStrategy,
    drizzleUpsertSubscriptionByTenant,
} from '@/lib/billing/drizzle';
import type { SubscriptionMapped } from '@/lib/data/mappers';

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
        const { success } = await applyRateLimit(identifier, 'checkout');

        if (!success) {
            logSecurityEvent({
                event: 'rate_limit_exceeded',
                ip: identifier,
                path: '/api/billing/google-play/prepare',
            });
            return rateLimitExceededResponse();
        }

        const { supabase, user, tenantId } = await requireUserTenant();
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
                path: '/api/billing/google-play/prepare',
                userId: user.id,
                ip: identifier,
                statusCode: 400,
                duration: Date.now() - startTime,
            });
            return NextResponse.json(
                { error: 'Ya tienes un pase PRO activo' },
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

        const attributionState = await readAttributionStateFromCookies();
        const marketingContext = createMarketingContext(attributionState, {
            ctaContext: requestBody?.ctaContext || null,
            path: '/checkout',
        });
        const persistedMarketingContext = ({
            ...getJsonObject(existingSubscription?.marketing_context as Json | undefined),
            ...marketingContext,
            ...(planStrategy ? { planStrategy } : {}),
        }) as Json;

        if (isDrizzleEnabled()) {
            await drizzleUpsertSubscriptionByTenant({
                tenantId,
                userId: user.id,
                purchaserUserId: user.id,
                attributionId: marketingContext.attributionId,
                marketingContext: persistedMarketingContext,
            });
        } else {
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
        }

        await recordMarketingEvent({
            eventName: 'checkout_started',
            tenantId,
            userId: user.id,
            path: '/checkout',
            planStrategy,
            marketingContext,
            metadata: {
                platform: 'android',
                provider: 'google_play',
            },
        });

        const config = getGooglePlayPublicConfig();
        logPaymentEvent({
            event: 'checkout_created',
            userId: user.id,
            provider: 'google_play',
            externalId: config.productId,
        });

        logApiRequest({
            method: 'POST',
            path: '/api/billing/google-play/prepare',
            userId: user.id,
            ip: identifier,
            statusCode: 200,
            duration: Date.now() - startTime,
        });

        return NextResponse.json({
            productId: config.productId,
            packageName: config.packageName,
            passDurationDays: config.passDurationDays,
            obfuscatedAccountId: createGooglePlayObfuscatedAccountId(user.id),
        });
    } catch (error) {
        logApiError({
            method: 'POST',
            path: '/api/billing/google-play/prepare',
            error,
            statusCode: 500,
        });
        return NextResponse.json(
            { error: 'No se pudo preparar la compra con Google Play' },
            { status: 500 }
        );
    }
}
