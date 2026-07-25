import { NextRequest, NextResponse } from 'next/server';
import type { Json, TablesInsert } from '@/types/supabase';
import type { WebhookEvent } from '@/lib/recurrente/client';
import { createAdminClient } from '@/lib/supabase/server';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logWebhookEvent, logPaymentEvent, logSecurityEvent } from '@/lib/logger';
import {
    marketingContextFromMetadata,
    type MarketingContext,
} from '@/lib/funnel/attribution';
import { recordMarketingEventWithAdmin } from '@/lib/funnel/events';
import {
    recurrenteWebhookEventSchema,
    ValidationError,
    validationErrorResponse
} from '@/lib/validations/api';
import {
    marketingContextFromStoredSubscription,
    parsePaymentMetadata,
    parseRecurrenteMetadata,
    planStrategyFromStoredSubscription,
} from '@/lib/recurrente/webhook-metadata';
import { verifyWebhookSignature, validateWebhookSecret } from '@/lib/recurrente/webhook-verification';
import { resolveFailedPaymentRecovery, triggerFailedPaymentRecovery } from '@/lib/lifecycle';
import { getProVariant, type ProVariantCode } from '@/lib/billing/plans';
import { billingIntervalForVariant } from '@/lib/billing/billing-interval';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    drizzleFindCheckoutContext,
    drizzleFindStoredSubscription,
    drizzleInsertWebhookEvent,
    drizzleMarkWebhookProcessed,
    drizzleUpdateSubscriptionByExternalId,
    drizzleUpdateSubscriptionByTenant,
    drizzleUpsertSubscriptionByTenant,
} from '@/lib/billing/drizzle';
import type { SubscriptionMapped } from '@/lib/data/mappers';

/** Legacy Supabase admin client — removed in F6. Returns null on drizzle path. */
function getAdminClient(): any {
    if (isDrizzleEnabled()) {
        return null as any;
    }
    // Vitest suites still exercise the legacy branch with mocked clients.
    if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
        return createAdminClient();
    }
    throw new Error('Supabase webhook client removed in F6; set DATA_PROVIDER=drizzle');
}

function getDatabaseErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) {
        return undefined;
    }

    const { code } = error as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
}

type StoredSubscriptionRow = Pick<
    SubscriptionMapped,
    | 'tenant_id'
    | 'user_id'
    | 'purchaser_user_id'
    | 'plan_code'
    | 'status'
    | 'attribution_id'
    | 'marketing_context'
    | 'external_id'
>;

type StoredCheckoutContextRow = {
    checkout_id: string;
    tenant_id: string;
    purchaser_user_id: string;
    plan_code: string;
    attribution_id: string | null;
    marketing_context: Json | Record<string, unknown>;
};

function getJsonObject(value: Json | null | undefined): Record<string, Json> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, Json>;
}

async function findStoredSubscription(
    supabase: ReturnType<typeof getAdminClient>,
    input: {
        tenantId?: string | null;
        subscriptionId?: string | null;
    }
): Promise<StoredSubscriptionRow | null> {
    if (isDrizzleEnabled()) {
        return drizzleFindStoredSubscription(input);
    }

    const selectColumns = 'tenant_id, user_id, purchaser_user_id, plan_code, status, attribution_id, marketing_context, external_id';

    if (input.subscriptionId) {
        const { data } = await supabase
            .from('subscriptions')
            .select(selectColumns)
            .eq('external_id', input.subscriptionId)
            .maybeSingle();

        if (data) {
            return data;
        }
    }

    if (input.tenantId) {
        const { data } = await supabase
            .from('subscriptions')
            .select(selectColumns)
            .eq('tenant_id', input.tenantId)
            .maybeSingle();

        if (data) {
            return data;
        }
    }

    return null;
}

async function findStoredCheckoutContext(
    supabase: ReturnType<typeof getAdminClient>,
    input: {
        checkoutId?: string | null;
    }
): Promise<StoredCheckoutContextRow | null> {
    if (!input.checkoutId) {
        return null;
    }

    if (isDrizzleEnabled()) {
        return drizzleFindCheckoutContext(input.checkoutId);
    }

    const { data } = await supabase
        .from('recurrente_checkout_contexts')
        .select('checkout_id, tenant_id, purchaser_user_id, plan_code, attribution_id, marketing_context')
        .eq('checkout_id', input.checkoutId)
        .maybeSingle();

    return data ?? null;
}

function marketingContextFromSubscriptionRow(
    subscription: StoredSubscriptionRow | null
): MarketingContext | null {
    if (!subscription) {
        return null;
    }

    return (
        marketingContextFromStoredSubscription(
            subscription.marketing_context as Json,
            subscription.attribution_id
        ) ||
        (subscription.attribution_id
            ? marketingContextFromMetadata({ attribution_id: subscription.attribution_id })
            : null)
    );
}

function marketingContextFromCheckoutContextRow(
    checkoutContext: StoredCheckoutContextRow | null
): MarketingContext | null {
    if (!checkoutContext) {
        return null;
    }

    return marketingContextFromStoredSubscription(
        checkoutContext.marketing_context as Json,
        checkoutContext.attribution_id
    );
}

function shouldPreferStoredSubscriptionContext(
    subscriptionId: string | null | undefined,
    storedSubscription: StoredSubscriptionRow | null
) {
    return Boolean(
        subscriptionId &&
        storedSubscription?.external_id &&
        storedSubscription.external_id === subscriptionId
    );
}

export async function POST(request: NextRequest) {
    const identifier = getClientIdentifier(request);
    const provider = 'recurrente';

    try {
        // Apply rate limiting for webhook endpoint
        const { success } = await applyRateLimit(identifier, 'webhook');

        if (!success) {
            logSecurityEvent({
                event: 'rate_limit_exceeded',
                ip: identifier,
                path: '/api/webhooks/recurrente',
            });
            return rateLimitExceededResponse();
        }

        // Get raw body and signature
        const body = await request.text();
        const signature = request.headers.get('x-recurrente-signature');
        const secret = process.env.RECURRENTE_WEBHOOK_SECRET;

        // Validate webhook secret is configured
        try {
            validateWebhookSecret(secret);
        } catch (error) {
            logSecurityEvent({
                event: 'webhook_secret_not_configured',
                ip: identifier,
                path: '/api/webhooks/recurrente',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            });
            return NextResponse.json(
                { error: 'Service misconfigured' },
                { status: 503 }
            );
        }

        // Verify webhook signature
        if (!signature || !verifyWebhookSignature(body, signature, secret!)) {
            logSecurityEvent({
                event: 'invalid_webhook_signature',
                ip: identifier,
                path: '/api/webhooks/recurrente',
                details: {
                    hasSignature: !!signature,
                    bodyLength: body.length,
                },
            });
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Parse and validate webhook event structure
        const rawEvent = JSON.parse(body);
        const event = recurrenteWebhookEventSchema.parse(rawEvent) as WebhookEvent;

        // Idempotency: persist the event (unique by provider+external_event_id).
        // If we already processed it successfully, return 200 to stop retries.
        const adminClient = getAdminClient();
        try {
            if (isDrizzleEnabled()) {
                const insertResult = await drizzleInsertWebhookEvent({
                    provider,
                    externalEventId: event.id,
                    payload: rawEvent,
                });
                if (insertResult.kind === 'duplicate' && insertResult.processed) {
                    return NextResponse.json({ received: true, duplicate: true });
                }
            } else {
                const { error: insertError } = await adminClient
                    .from('payment_webhook_events')
                    .insert({
                        provider,
                        external_event_id: event.id,
                        payload: rawEvent,
                        processed: false,
                    });

                if (insertError) {
                    // PostgREST returns 23505 for unique violation.
                    const code = getDatabaseErrorCode(insertError);
                    if (code === '23505') {
                        const { data: existing } = await adminClient
                            .from('payment_webhook_events')
                            .select('processed')
                            .eq('provider', provider)
                            .eq('external_event_id', event.id)
                            .maybeSingle();

                        if (existing?.processed) {
                            return NextResponse.json({ received: true, duplicate: true });
                        }
                        // If not processed, continue (retry path).
                    } else {
                        throw insertError;
                    }
                }
            }
        } catch (dbError) {
            logWebhookEvent({
                provider,
                event: event.type,
                eventId: event.id,
                processed: false,
                error: dbError instanceof Error ? dbError : new Error(String(dbError)),
            });
            return NextResponse.json({ error: 'Webhook persistence failed' }, { status: 500 });
        }

        logWebhookEvent({
            provider,
            event: event.type,
            eventId: event.id,
            processed: false, // Will update after processing
        });

        try {
            // Handle different event types
            switch (event.type) {
                case 'checkout.completed':
                case 'payment_intent.succeeded':
                    await handleSuccessfulPayment(event);
                    break;

                case 'subscription.created':
                    await handleSubscriptionCreated(event);
                    break;

                case 'subscription.canceled':
                case 'subscription.cancelled':
                    await handleSubscriptionCanceled(event);
                    break;

                case 'payment_intent.failed':
                    await handlePaymentFailed(event);
                    break;

                default:
                    logWebhookEvent({
                        provider,
                        event: event.type,
                        eventId: event.id,
                        processed: false,
                    });
            }

            if (isDrizzleEnabled()) {
                await drizzleMarkWebhookProcessed(provider, event.id, null);
            } else {
                await adminClient
                    .from('payment_webhook_events')
                    .update({ processed: true, error: null })
                    .eq('provider', provider)
                    .eq('external_event_id', event.id);
            }

        } catch (processingError) {
            const processingMessage =
                processingError instanceof Error
                    ? processingError.message
                    : String(processingError);
            if (isDrizzleEnabled()) {
                await drizzleMarkWebhookProcessed(provider, event.id, processingMessage);
            } else {
                await adminClient
                    .from('payment_webhook_events')
                    .update({
                        processed: false,
                        error: processingMessage,
                    })
                    .eq('provider', provider)
                    .eq('external_event_id', event.id);
            }

            throw processingError;
        }

        logWebhookEvent({
            provider,
            event: event.type,
            eventId: event.id,
            processed: true,
        });

        return NextResponse.json({ received: true });
    } catch (error) {
        // Handle validation errors separately
        if (error instanceof ValidationError) {
            logWebhookEvent({
                provider: 'recurrente',
                event: 'unknown',
                processed: false,
                error: new Error(`Validation failed: ${error.message}`),
            });
            return validationErrorResponse(error);
        }

        logWebhookEvent({
            provider: 'recurrente',
            event: 'unknown',
            processed: false,
            error: error instanceof Error ? error : new Error(String(error)),
        });
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}

export async function handleSuccessfulPayment(event: WebhookEvent) {
    const { metadata, subscription_id } = event.data;
    const supabase = getAdminClient();
    const validatedMetadata = parsePaymentMetadata(metadata);
    const previousSubscription = await findStoredSubscription(supabase, {
        tenantId: validatedMetadata?.tenant_id || null,
        subscriptionId: subscription_id || null,
    });
    const checkoutContext = event.type === 'checkout.completed'
        ? await findStoredCheckoutContext(supabase, {
            checkoutId: event.data.id || null,
        })
        : null;

    if (!validatedMetadata && !previousSubscription && !checkoutContext) {
        logPaymentEvent({
            event: 'payment_succeeded',
            error: new Error('Missing recoverable payment metadata'),
        });
        return;
    }

    const preferStoredSubscriptionContext = shouldPreferStoredSubscriptionContext(
        subscription_id,
        previousSubscription
    );
    const storedMarketingContext = marketingContextFromSubscriptionRow(previousSubscription);
    const checkoutMarketingContext = marketingContextFromCheckoutContextRow(checkoutContext);
    const metadataMarketingContext = validatedMetadata
        ? marketingContextFromMetadata(validatedMetadata)
        : null;
    const tenantId = preferStoredSubscriptionContext
        ? previousSubscription?.tenant_id ||
            validatedMetadata?.tenant_id ||
            checkoutContext?.tenant_id ||
            null
        : validatedMetadata?.tenant_id ||
            previousSubscription?.tenant_id ||
            checkoutContext?.tenant_id ||
            null;
    const purchaserUserId = preferStoredSubscriptionContext
        ? previousSubscription?.purchaser_user_id ||
            previousSubscription?.user_id ||
            validatedMetadata?.purchaser_user_id ||
            checkoutContext?.purchaser_user_id ||
            null
        : validatedMetadata?.purchaser_user_id ||
            previousSubscription?.purchaser_user_id ||
            previousSubscription?.user_id ||
            checkoutContext?.purchaser_user_id ||
            null;

    if (!tenantId || !purchaserUserId) {
        logPaymentEvent({
            event: 'payment_succeeded',
            error: new Error('Missing tenant or purchaser context'),
        });
        return;
    }

    const planCode =
        validatedMetadata?.plan_code ||
        previousSubscription?.plan_code ||
        checkoutContext?.plan_code ||
        'PRO';
    const storedPlanStrategy = previousSubscription
        ? planStrategyFromStoredSubscription(previousSubscription.marketing_context as Json)
        : null;
    const checkoutPlanStrategy = checkoutContext
        ? planStrategyFromStoredSubscription(checkoutContext.marketing_context as Json)
        : null;
    const planStrategy = preferStoredSubscriptionContext
        ? storedPlanStrategy || validatedMetadata?.plan_strategy || checkoutPlanStrategy || null
        : validatedMetadata?.plan_strategy || storedPlanStrategy || checkoutPlanStrategy || null;
    const marketingContext = preferStoredSubscriptionContext
        ? storedMarketingContext || metadataMarketingContext || checkoutMarketingContext
        : metadataMarketingContext || storedMarketingContext || checkoutMarketingContext;
    const resolvedPath = preferStoredSubscriptionContext
        ? marketingContext?.path || validatedMetadata?.path || checkoutMarketingContext?.path || null
        : validatedMetadata?.path || marketingContext?.path || checkoutMarketingContext?.path || null;

    // Resolve the purchased variant from metadata (set by create-checkout). Fall back to
    // PRO_MONTHLY for legacy/null payloads so historical webhooks keep working.
    const variantCodeStr = validatedMetadata?.variant_code;
    const variantCode: ProVariantCode =
        variantCodeStr === 'PRO_QUARTERLY' ||
        variantCodeStr === 'PRO_ANNUAL' ||
        variantCodeStr === 'PRO_PASS_90D'
            ? variantCodeStr
            : 'PRO_MONTHLY';
    const variant = getProVariant(variantCode);

    // Calculate renewal date based on the variant's duration so quarterly/annual
    // purchases don't get a stale 1-month renew_at written to the DB.
    const renewAt = new Date(Date.now() + variant.durationDays * 24 * 60 * 60 * 1000);

    // Upsert subscription
    const subscriptionRecord: TablesInsert<'subscriptions'> = {
        tenant_id: tenantId,
        user_id: purchaserUserId,
        purchaser_user_id: purchaserUserId,
        plan_code: planCode,
        status: 'ACTIVE',
        provider: 'recurrente',
        external_id: subscription_id || event.data.id,
        start_at: new Date().toISOString(),
        renew_at: renewAt.toISOString(),
        cancel_at: null,
        billing_interval: billingIntervalForVariant(variantCode),
        payment_method: 'recurrente',
        price_amount_q: variant.priceQ,
        attribution_id:
            marketingContext?.attributionId ||
            previousSubscription?.attribution_id ||
            checkoutContext?.attribution_id ||
            null,
        marketing_context: ({
            ...getJsonObject(checkoutContext?.marketing_context as Json | undefined),
            ...getJsonObject(previousSubscription?.marketing_context as Json | undefined),
            ...(marketingContext || {}),
            ...(planStrategy ? { planStrategy } : {}),
        }) as Json,
    };
    try {
        if (isDrizzleEnabled()) {
            await drizzleUpsertSubscriptionByTenant({
                tenantId: subscriptionRecord.tenant_id,
                userId: subscriptionRecord.user_id,
                purchaserUserId: subscriptionRecord.purchaser_user_id,
                planCode: subscriptionRecord.plan_code,
                status: subscriptionRecord.status,
                provider: subscriptionRecord.provider,
                externalId: subscriptionRecord.external_id,
                startAt: subscriptionRecord.start_at,
                renewAt: subscriptionRecord.renew_at,
                cancelAt: subscriptionRecord.cancel_at,
                billingInterval: subscriptionRecord.billing_interval,
                paymentMethod: subscriptionRecord.payment_method,
                priceAmountQ: subscriptionRecord.price_amount_q,
                attributionId: subscriptionRecord.attribution_id,
                marketingContext: subscriptionRecord.marketing_context,
            });
        } else {
            const { error } = await supabase
                .from('subscriptions')
                .upsert(subscriptionRecord, {
                    onConflict: 'tenant_id',
                });

            if (error) {
                throw error;
            }
        }
    } catch (error) {
        logPaymentEvent({
            event: 'payment_succeeded',
            userId: purchaserUserId || undefined,
            provider: 'recurrente',
            externalId: subscription_id || event.data.id,
            error: error instanceof Error ? error : new Error(String(error)),
        });
        throw error;
    }

    logPaymentEvent({
        event: 'payment_succeeded',
        userId: purchaserUserId || undefined,
        provider: 'recurrente',
        externalId: subscription_id || event.data.id,
    });

    if (marketingContext) {
        await recordMarketingEventWithAdmin(supabase, {
            eventName: 'payment_succeeded',
            tenantId,
            userId: purchaserUserId,
            path: resolvedPath,
            planStrategy,
            metadata: {
                provider: 'recurrente',
                subscription_id: subscription_id || event.data.id,
            },
        }, marketingContext);

        if (previousSubscription?.status === 'PAST_DUE') {
            await recordMarketingEventWithAdmin(supabase, {
                eventName: 'failed_payment_recovered',
                tenantId,
                userId: purchaserUserId,
                path: resolvedPath,
                planStrategy,
                metadata: {
                    provider: 'recurrente',
                    subscription_id: subscription_id || event.data.id,
                },
            }, marketingContext);
        }

        if (previousSubscription?.status !== 'ACTIVE') {
            await recordMarketingEventWithAdmin(supabase, {
                eventName: 'subscription_activated',
                tenantId,
                userId: purchaserUserId,
                path: resolvedPath,
                planStrategy,
                metadata: {
                    provider: 'recurrente',
                    plan_code: planCode,
                    subscription_id: subscription_id || event.data.id,
                    previous_status: previousSubscription?.status || null,
                },
            }, marketingContext);
        }
    }

    await resolveFailedPaymentRecovery({
        tenantId,
        userId: purchaserUserId,
    });
}

export async function handleSubscriptionCreated(event: WebhookEvent) {
    // Similar to successful payment
    await handleSuccessfulPayment(event);
}

export async function handleSubscriptionCanceled(event: WebhookEvent) {
    const { metadata, subscription_id } = event.data;
    const validatedMetadata = parseRecurrenteMetadata(metadata);

    // Require either validated metadata or subscription_id
    if (!validatedMetadata && !subscription_id) {
        logPaymentEvent({
            event: 'subscription_canceled',
            error: new Error('No user_id or subscription_id'),
        });
        return;
    }

    const supabase = getAdminClient();
    const existingSubscription = await findStoredSubscription(supabase, {
        tenantId: validatedMetadata?.tenant_id || null,
        subscriptionId: subscription_id || null,
    });
    const preferStoredSubscriptionContext = shouldPreferStoredSubscriptionContext(
        subscription_id,
        existingSubscription
    );
    const storedMarketingContext = marketingContextFromSubscriptionRow(existingSubscription);
    const metadataMarketingContext = validatedMetadata
        ? marketingContextFromMetadata(validatedMetadata)
        : null;
    const storedPlanStrategy = existingSubscription
        ? planStrategyFromStoredSubscription(existingSubscription.marketing_context as Json)
        : null;
    const planStrategy = preferStoredSubscriptionContext
        ? storedPlanStrategy || validatedMetadata?.plan_strategy || null
        : validatedMetadata?.plan_strategy || storedPlanStrategy || null;
    const marketingContext = preferStoredSubscriptionContext
        ? storedMarketingContext || metadataMarketingContext
        : metadataMarketingContext || storedMarketingContext;
    const resolvedTenantId = preferStoredSubscriptionContext
        ? existingSubscription?.tenant_id || validatedMetadata?.tenant_id || null
        : validatedMetadata?.tenant_id || existingSubscription?.tenant_id || null;
    const resolvedUserId = preferStoredSubscriptionContext
        ? existingSubscription?.purchaser_user_id ||
            existingSubscription?.user_id ||
            validatedMetadata?.purchaser_user_id ||
            null
        : validatedMetadata?.purchaser_user_id ||
            existingSubscription?.purchaser_user_id ||
            existingSubscription?.user_id ||
            null;
    const resolvedPath = preferStoredSubscriptionContext
        ? marketingContext?.path || validatedMetadata?.path || null
        : validatedMetadata?.path || marketingContext?.path || null;

    // Update subscription status
    const cancelPayload = {
        status: 'CANCELED' as const,
        cancelAt: new Date().toISOString(),
        planCode: 'FREE' as const,
    };

    try {
        if (isDrizzleEnabled()) {
            if (subscription_id && preferStoredSubscriptionContext) {
                await drizzleUpdateSubscriptionByExternalId(subscription_id, cancelPayload);
            } else if (resolvedTenantId) {
                await drizzleUpdateSubscriptionByTenant(resolvedTenantId, cancelPayload);
            } else if (subscription_id) {
                await drizzleUpdateSubscriptionByExternalId(subscription_id, cancelPayload);
            }
        } else {
            const query = subscription_id && preferStoredSubscriptionContext
                ? supabase.from('subscriptions').update({
                    status: 'CANCELED',
                    cancel_at: cancelPayload.cancelAt,
                    plan_code: 'FREE',
                }).eq('external_id', subscription_id)
                : resolvedTenantId
                    ? supabase.from('subscriptions').update({
                        status: 'CANCELED',
                        cancel_at: cancelPayload.cancelAt,
                        plan_code: 'FREE',
                    }).eq('tenant_id', resolvedTenantId)
                    : supabase.from('subscriptions').update({
                        status: 'CANCELED',
                        cancel_at: cancelPayload.cancelAt,
                        plan_code: 'FREE',
                    }).eq('external_id', subscription_id);

            const { error } = await query;
            if (error) throw error;
        }
    } catch (error) {
        logPaymentEvent({
            event: 'subscription_canceled',
            userId: resolvedUserId || undefined,
            provider: 'recurrente',
            externalId: subscription_id,
            error: error instanceof Error ? error : new Error(String(error)),
        });
        throw error;
    }

    logPaymentEvent({
        event: 'subscription_canceled',
        userId: resolvedUserId || undefined,
        provider: 'recurrente',
        externalId: subscription_id,
    });

    if (marketingContext) {
        await recordMarketingEventWithAdmin(supabase, {
            eventName: 'subscription_canceled',
            tenantId: resolvedTenantId,
            userId: resolvedUserId,
            path: resolvedPath,
            planStrategy,
            metadata: {
                provider: 'recurrente',
                subscription_id: subscription_id || null,
            },
        }, marketingContext);
    }
}

export async function handlePaymentFailed(event: WebhookEvent) {
    const { metadata, subscription_id } = event.data;
    const supabase = getAdminClient();
    const validatedMetadata = parsePaymentMetadata(metadata);
    const existingSubscription = await findStoredSubscription(supabase, {
        tenantId: validatedMetadata?.tenant_id || null,
        subscriptionId: subscription_id || null,
    });

    if (!validatedMetadata && !existingSubscription) {
        logPaymentEvent({
            event: 'payment_failed',
            error: new Error('Missing recoverable payment metadata'),
        });
        return;
    }

    const preferStoredSubscriptionContext = shouldPreferStoredSubscriptionContext(
        subscription_id,
        existingSubscription
    );
    const storedMarketingContext = marketingContextFromSubscriptionRow(existingSubscription);
    const metadataMarketingContext = validatedMetadata
        ? marketingContextFromMetadata(validatedMetadata)
        : null;
    const storedPlanStrategy = existingSubscription
        ? planStrategyFromStoredSubscription(existingSubscription.marketing_context as Json)
        : null;
    const tenantId = preferStoredSubscriptionContext
        ? existingSubscription?.tenant_id || validatedMetadata?.tenant_id || null
        : validatedMetadata?.tenant_id || existingSubscription?.tenant_id || null;
    const purchaserUserId = preferStoredSubscriptionContext
        ? existingSubscription?.purchaser_user_id ||
            existingSubscription?.user_id ||
            validatedMetadata?.purchaser_user_id ||
            null
        : validatedMetadata?.purchaser_user_id ||
            existingSubscription?.purchaser_user_id ||
            existingSubscription?.user_id ||
            null;

    if (!tenantId || !purchaserUserId) {
        logPaymentEvent({
            event: 'payment_failed',
            error: new Error('Missing tenant or purchaser context'),
        });
        return;
    }

    const marketingContext = preferStoredSubscriptionContext
        ? storedMarketingContext || metadataMarketingContext
        : metadataMarketingContext || storedMarketingContext;
    const planStrategy = preferStoredSubscriptionContext
        ? storedPlanStrategy || validatedMetadata?.plan_strategy || null
        : validatedMetadata?.plan_strategy || storedPlanStrategy || null;
    const planCode = validatedMetadata?.plan_code || existingSubscription?.plan_code || 'PRO';
    const resolvedPath = preferStoredSubscriptionContext
        ? marketingContext?.path || validatedMetadata?.path || null
        : validatedMetadata?.path || marketingContext?.path || null;

    // Update subscription to past due
    try {
        if (isDrizzleEnabled()) {
            await drizzleUpdateSubscriptionByTenant(tenantId, { status: 'PAST_DUE' });
        } else {
            const { error } = await supabase
                .from('subscriptions')
                .update({
                    status: 'PAST_DUE',
                })
                .eq('tenant_id', tenantId);

            if (error) throw error;
        }

        logPaymentEvent({
            event: 'payment_failed',
            userId: purchaserUserId,
        });

        if (marketingContext) {
            await recordMarketingEventWithAdmin(supabase, {
                eventName: 'payment_failed',
                tenantId,
                userId: purchaserUserId,
                path: resolvedPath,
                planStrategy,
                metadata: {
                    provider: 'recurrente',
                    subscription_id: subscription_id || null,
                },
            }, marketingContext);
        }

        await triggerFailedPaymentRecovery({
            tenantId,
            userId: purchaserUserId,
            externalEventId: event.id,
            planCode,
        });
    } catch (error) {
        logPaymentEvent({
            event: 'payment_failed',
            userId: purchaserUserId,
            error: error instanceof Error ? error : new Error(String(error)),
        });
    }
}
