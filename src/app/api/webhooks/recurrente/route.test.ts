import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    recordMarketingEventWithAdmin,
    resolveFailedPaymentRecovery,
    triggerFailedPaymentRecovery,
    logWebhookEvent,
    logPaymentEvent,
    logSecurityEvent,
    adminClient,
} = vi.hoisted(() => {
    const adminState = {
        byTenantId: new Map<string, SubscriptionRow>(),
        byExternalId: new Map<string, SubscriptionRow>(),
        checkoutContextsById: new Map<string, CheckoutContextRow>(),
        upserts: [] as Array<{ values: Record<string, unknown>; options: Record<string, unknown> }>,
        updates: [] as Array<{ values: Record<string, unknown>; filters: Array<[string, unknown]> }>,
    };

    function createSubscriptionsTable() {
        return {
            select: vi.fn(() => {
                const filters: Array<[string, unknown]> = [];
                const query = {
                    eq: vi.fn((column: string, value: unknown) => {
                        filters.push([column, value]);
                        return query;
                    }),
                    maybeSingle: vi.fn(async () => {
                        const tenantId = filters.find(([column]) => column === 'tenant_id')?.[1];
                        if (typeof tenantId === 'string') {
                            return { data: adminState.byTenantId.get(tenantId) ?? null };
                        }

                        const externalId = filters.find(([column]) => column === 'external_id')?.[1];
                        if (typeof externalId === 'string') {
                            return { data: adminState.byExternalId.get(externalId) ?? null };
                        }

                        return { data: null };
                    }),
                };

                return query;
            }),
            upsert: vi.fn(async (values: Record<string, unknown>, options: Record<string, unknown>) => {
                adminState.upserts.push({ values, options });
                return { error: null };
            }),
            update: vi.fn((values: Record<string, unknown>) => {
                const filters: Array<[string, unknown]> = [];
                return {
                    eq: vi.fn(async (column: string, value: unknown) => {
                        filters.push([column, value]);
                        adminState.updates.push({ values, filters: [...filters] });
                        return { error: null };
                    }),
                };
            }),
        };
    }

    function createCheckoutContextsTable() {
        return {
            select: vi.fn(() => {
                const filters: Array<[string, unknown]> = [];
                const query = {
                    eq: vi.fn((column: string, value: unknown) => {
                        filters.push([column, value]);
                        return query;
                    }),
                    maybeSingle: vi.fn(async () => {
                        const checkoutId = filters.find(([column]) => column === 'checkout_id')?.[1];
                        if (typeof checkoutId === 'string') {
                            return { data: adminState.checkoutContextsById.get(checkoutId) ?? null };
                        }

                        return { data: null };
                    }),
                };

                return query;
            }),
        };
    }

    return {
        recordMarketingEventWithAdmin: vi.fn(),
        resolveFailedPaymentRecovery: vi.fn(),
        triggerFailedPaymentRecovery: vi.fn(),
        logWebhookEvent: vi.fn(),
        logPaymentEvent: vi.fn(),
        logSecurityEvent: vi.fn(),
        adminClient: {
            state: adminState,
            from: vi.fn((table: string) => {
                if (table === 'subscriptions') {
                    return createSubscriptionsTable();
                }

                if (table === 'recurrente_checkout_contexts') {
                    return createCheckoutContextsTable();
                }

                throw new Error(`Unexpected table: ${table}`);
            }),
        },
    };
});

type SubscriptionRow = {
    tenant_id: string;
    user_id: string;
    purchaser_user_id: string | null;
    plan_code: string;
    status: string;
    attribution_id: string | null;
    marketing_context: Record<string, unknown>;
    external_id: string | null;
};

type CheckoutContextRow = {
    checkout_id: string;
    tenant_id: string;
    purchaser_user_id: string;
    plan_code: string;
    attribution_id: string | null;
    marketing_context: Record<string, unknown>;
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => adminClient),
}));

vi.mock('@/lib/funnel/events', () => ({
    recordMarketingEventWithAdmin,
}));

vi.mock('@/lib/lifecycle', () => ({
    resolveFailedPaymentRecovery,
    triggerFailedPaymentRecovery,
}));

vi.mock('@/lib/logger', () => ({
    logWebhookEvent,
    logPaymentEvent,
    logSecurityEvent,
}));

import {
    handlePaymentFailed,
    handleSubscriptionCanceled,
    handleSuccessfulPayment,
} from '@/app/api/webhooks/recurrente/route';

describe('recurrente webhook lifecycle handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        adminClient.state.byTenantId.clear();
        adminClient.state.byExternalId.clear();
        adminClient.state.checkoutContextsById.clear();
        adminClient.state.upserts.length = 0;
        adminClient.state.updates.length = 0;
    });

    it('recovers first checkout success from stored checkout context when metadata is missing', async () => {
        adminClient.state.checkoutContextsById.set('chk_123', {
            checkout_id: 'chk_123',
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            attribution_id: 'attr-checkout',
            marketing_context: {
                source: 'meta',
                medium: 'paid_social',
                path: '/checkout',
                ctaContext: 'pricing',
                planStrategy: 'HYBRID',
            },
        });

        await handleSuccessfulPayment({
            id: 'evt_checkout_success',
            type: 'checkout.completed',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'chk_123',
                subscription_id: 'sub_first',
            },
        });

        expect(adminClient.state.upserts).toHaveLength(1);
        expect(adminClient.state.upserts[0]).toMatchObject({
            values: expect.objectContaining({
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                user_id: '550e8400-e29b-41d4-a716-446655440001',
                purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
                plan_code: 'PRO',
                status: 'ACTIVE',
                external_id: 'sub_first',
                attribution_id: 'attr-checkout',
                marketing_context: expect.objectContaining({
                    source: 'meta',
                    medium: 'paid_social',
                    path: '/checkout',
                    ctaContext: 'pricing',
                    planStrategy: 'HYBRID',
                }),
            }),
            options: {
                onConflict: 'tenant_id',
            },
        });
        expect(recordMarketingEventWithAdmin).toHaveBeenCalledTimes(2);
        expect(recordMarketingEventWithAdmin).toHaveBeenNthCalledWith(
            1,
            adminClient,
            expect.objectContaining({
                eventName: 'payment_succeeded',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'HYBRID',
            }),
            expect.objectContaining({
                attributionId: 'attr-checkout',
                source: 'meta',
                medium: 'paid_social',
            })
        );
        expect(recordMarketingEventWithAdmin).toHaveBeenNthCalledWith(
            2,
            adminClient,
            expect.objectContaining({
                eventName: 'subscription_activated',
            }),
            expect.any(Object)
        );
        expect(resolveFailedPaymentRecovery).toHaveBeenCalledWith({
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440001',
        });
    });

    it('recovers payment success from stored subscription context when metadata is malformed', async () => {
        adminClient.state.byExternalId.set('sub_123', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '550e8400-e29b-41d4-a716-446655440001',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            status: 'PAST_DUE',
            attribution_id: 'attr-stored',
            marketing_context: {
                source: 'meta',
                medium: 'paid_social',
                path: '/checkout',
                ctaContext: 'pricing',
                planStrategy: 'HYBRID',
            },
            external_id: 'sub_123',
        });

        await handleSuccessfulPayment({
            id: 'evt_success',
            type: 'payment_intent.succeeded',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'pay_123',
                subscription_id: 'sub_123',
                metadata: {
                    tenant_id: 'not-a-uuid',
                },
            },
        });

        expect(adminClient.state.upserts).toHaveLength(1);
        expect(adminClient.state.upserts[0]).toMatchObject({
            values: expect.objectContaining({
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                user_id: '550e8400-e29b-41d4-a716-446655440001',
                purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
                plan_code: 'PRO',
                status: 'ACTIVE',
                external_id: 'sub_123',
                attribution_id: 'attr-stored',
                marketing_context: expect.objectContaining({
                    source: 'meta',
                    medium: 'paid_social',
                    path: '/checkout',
                    ctaContext: 'pricing',
                    planStrategy: 'HYBRID',
                }),
            }),
            options: {
                onConflict: 'tenant_id',
            },
        });

        expect(recordMarketingEventWithAdmin).toHaveBeenCalledTimes(3);
        expect(recordMarketingEventWithAdmin).toHaveBeenNthCalledWith(
            1,
            adminClient,
            expect.objectContaining({
                eventName: 'payment_succeeded',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'HYBRID',
            }),
            expect.objectContaining({
                attributionId: 'attr-stored',
                source: 'meta',
                medium: 'paid_social',
            })
        );
        expect(recordMarketingEventWithAdmin).toHaveBeenNthCalledWith(
            2,
            adminClient,
            expect.objectContaining({
                eventName: 'failed_payment_recovered',
            }),
            expect.any(Object)
        );
        expect(recordMarketingEventWithAdmin).toHaveBeenNthCalledWith(
            3,
            adminClient,
            expect.objectContaining({
                eventName: 'subscription_activated',
            }),
            expect.any(Object)
        );
        expect(resolveFailedPaymentRecovery).toHaveBeenCalledWith({
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440001',
        });
    });

    it('prefers the stored subscription over conflicting valid metadata on payment success', async () => {
        adminClient.state.byTenantId.set('550e8400-e29b-41d4-a716-446655440100', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440100',
            user_id: '550e8400-e29b-41d4-a716-446655440101',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440101',
            plan_code: 'BUSINESS',
            status: 'ACTIVE',
            attribution_id: 'attr-wrong',
            marketing_context: {
                source: 'wrong-source',
                medium: 'wrong-medium',
                path: '/wrong-checkout',
                ctaContext: 'wrong',
                planStrategy: 'SNOWBALL',
            },
            external_id: 'sub_wrong',
        });
        adminClient.state.byExternalId.set('sub_conflict', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '550e8400-e29b-41d4-a716-446655440001',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            status: 'PAST_DUE',
            attribution_id: 'attr-correct',
            marketing_context: {
                source: 'meta',
                medium: 'paid_social',
                path: '/checkout',
                ctaContext: 'pricing',
                planStrategy: 'HYBRID',
            },
            external_id: 'sub_conflict',
        });

        await handleSuccessfulPayment({
            id: 'evt_success_conflict',
            type: 'payment_intent.succeeded',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'pay_conflict',
                subscription_id: 'sub_conflict',
                metadata: {
                    tenant_id: '550e8400-e29b-41d4-a716-446655440100',
                    purchaser_user_id: '550e8400-e29b-41d4-a716-446655440101',
                    plan_code: 'PRO',
                    source: 'wrong-source',
                    medium: 'wrong-medium',
                    path: '/wrong-checkout',
                },
            },
        });

        expect(adminClient.state.upserts[0]).toMatchObject({
            values: expect.objectContaining({
                tenant_id: '550e8400-e29b-41d4-a716-446655440000',
                user_id: '550e8400-e29b-41d4-a716-446655440001',
                purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
                external_id: 'sub_conflict',
                attribution_id: 'attr-correct',
                marketing_context: expect.objectContaining({
                    source: 'meta',
                    medium: 'paid_social',
                    path: '/checkout',
                    ctaContext: 'pricing',
                    planStrategy: 'HYBRID',
                }),
            }),
        });
        expect(recordMarketingEventWithAdmin).toHaveBeenCalledWith(
            adminClient,
            expect.objectContaining({
                eventName: 'payment_succeeded',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'HYBRID',
            }),
            expect.objectContaining({
                attributionId: 'attr-correct',
                source: 'meta',
                medium: 'paid_social',
            })
        );
        expect(resolveFailedPaymentRecovery).toHaveBeenCalledWith({
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440001',
        });
    });

    it('marks subscriptions past due and triggers recovery when payment metadata cannot be trusted', async () => {
        adminClient.state.byExternalId.set('sub_456', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '550e8400-e29b-41d4-a716-446655440001',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            status: 'ACTIVE',
            attribution_id: 'attr-stored',
            marketing_context: {
                source: 'google',
                medium: 'cpc',
                path: '/checkout',
                ctaContext: 'checkout',
                planStrategy: 'SNOWBALL',
            },
            external_id: 'sub_456',
        });

        await handlePaymentFailed({
            id: 'evt_failed',
            type: 'payment_intent.failed',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'pay_456',
                subscription_id: 'sub_456',
                metadata: {
                    purchaser_user_id: 'invalid-user-id',
                },
            },
        });

        expect(adminClient.state.updates).toContainEqual({
            values: {
                status: 'PAST_DUE',
            },
            filters: [['tenant_id', '550e8400-e29b-41d4-a716-446655440000']],
        });
        expect(recordMarketingEventWithAdmin).toHaveBeenCalledWith(
            adminClient,
            expect.objectContaining({
                eventName: 'payment_failed',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'SNOWBALL',
            }),
            expect.objectContaining({
                attributionId: 'attr-stored',
                source: 'google',
                medium: 'cpc',
            })
        );
        expect(triggerFailedPaymentRecovery).toHaveBeenCalledWith({
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440001',
            externalEventId: 'evt_failed',
            planCode: 'PRO',
        });
    });

    it('prefers the stored subscription over conflicting valid metadata on payment failure', async () => {
        adminClient.state.byTenantId.set('550e8400-e29b-41d4-a716-446655440100', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440100',
            user_id: '550e8400-e29b-41d4-a716-446655440101',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440101',
            plan_code: 'BUSINESS',
            status: 'ACTIVE',
            attribution_id: 'attr-wrong',
            marketing_context: {
                source: 'wrong-source',
                medium: 'wrong-medium',
                path: '/wrong-checkout',
                ctaContext: 'wrong',
                planStrategy: 'SNOWBALL',
            },
            external_id: 'sub_wrong',
        });
        adminClient.state.byExternalId.set('sub_456_conflict', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '550e8400-e29b-41d4-a716-446655440001',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            status: 'ACTIVE',
            attribution_id: 'attr-correct',
            marketing_context: {
                source: 'google',
                medium: 'cpc',
                path: '/checkout',
                ctaContext: 'checkout',
                planStrategy: 'HYBRID',
            },
            external_id: 'sub_456_conflict',
        });

        await handlePaymentFailed({
            id: 'evt_failed_conflict',
            type: 'payment_intent.failed',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'pay_456_conflict',
                subscription_id: 'sub_456_conflict',
                metadata: {
                    tenant_id: '550e8400-e29b-41d4-a716-446655440100',
                    purchaser_user_id: '550e8400-e29b-41d4-a716-446655440101',
                    plan_code: 'PRO',
                    source: 'wrong-source',
                    medium: 'wrong-medium',
                    path: '/wrong-checkout',
                },
            },
        });

        expect(adminClient.state.updates).toContainEqual({
            values: {
                status: 'PAST_DUE',
            },
            filters: [['tenant_id', '550e8400-e29b-41d4-a716-446655440000']],
        });
        expect(recordMarketingEventWithAdmin).toHaveBeenCalledWith(
            adminClient,
            expect.objectContaining({
                eventName: 'payment_failed',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'HYBRID',
            }),
            expect.objectContaining({
                attributionId: 'attr-correct',
                source: 'google',
                medium: 'cpc',
            })
        );
        expect(triggerFailedPaymentRecovery).toHaveBeenCalledWith({
            tenantId: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440001',
            externalEventId: 'evt_failed_conflict',
            planCode: 'PRO',
        });
    });

    it('cancels subscriptions from stored context when cancellation metadata is missing', async () => {
        adminClient.state.byExternalId.set('sub_789', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '550e8400-e29b-41d4-a716-446655440001',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            status: 'ACTIVE',
            attribution_id: 'attr-stored',
            marketing_context: {
                source: 'partner',
                medium: 'referral',
                path: '/checkout',
                ctaContext: 'pricing',
                planStrategy: 'AVALANCHE',
            },
            external_id: 'sub_789',
        });

        await handleSubscriptionCanceled({
            id: 'evt_canceled',
            type: 'subscription.canceled',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'sub_789',
                subscription_id: 'sub_789',
            },
        });

        expect(adminClient.state.updates).toContainEqual({
            values: expect.objectContaining({
                status: 'CANCELED',
                plan_code: 'FREE',
                cancel_at: expect.any(String),
            }),
            filters: [['external_id', 'sub_789']],
        });
        expect(recordMarketingEventWithAdmin).toHaveBeenCalledWith(
            adminClient,
            expect.objectContaining({
                eventName: 'subscription_canceled',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'AVALANCHE',
            }),
            expect.objectContaining({
                attributionId: 'attr-stored',
                source: 'partner',
                medium: 'referral',
            })
        );
    });

    it('prefers the stored subscription over conflicting valid metadata on cancellation', async () => {
        adminClient.state.byTenantId.set('550e8400-e29b-41d4-a716-446655440100', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440100',
            user_id: '550e8400-e29b-41d4-a716-446655440101',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440101',
            plan_code: 'BUSINESS',
            status: 'ACTIVE',
            attribution_id: 'attr-wrong',
            marketing_context: {
                source: 'wrong-source',
                medium: 'wrong-medium',
                path: '/wrong-checkout',
                ctaContext: 'wrong',
                planStrategy: 'SNOWBALL',
            },
            external_id: 'sub_wrong',
        });
        adminClient.state.byExternalId.set('sub_789_conflict', {
            tenant_id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '550e8400-e29b-41d4-a716-446655440001',
            purchaser_user_id: '550e8400-e29b-41d4-a716-446655440001',
            plan_code: 'PRO',
            status: 'ACTIVE',
            attribution_id: 'attr-correct',
            marketing_context: {
                source: 'partner',
                medium: 'referral',
                path: '/checkout',
                ctaContext: 'pricing',
                planStrategy: 'AVALANCHE',
            },
            external_id: 'sub_789_conflict',
        });

        await handleSubscriptionCanceled({
            id: 'evt_canceled_conflict',
            type: 'subscription.canceled',
            created_at: '2026-04-05T00:00:00.000Z',
            data: {
                id: 'sub_789_conflict',
                subscription_id: 'sub_789_conflict',
                metadata: {
                    tenant_id: '550e8400-e29b-41d4-a716-446655440100',
                    purchaser_user_id: '550e8400-e29b-41d4-a716-446655440101',
                    source: 'wrong-source',
                    medium: 'wrong-medium',
                    path: '/wrong-checkout',
                },
            },
        });

        expect(adminClient.state.updates).toContainEqual({
            values: expect.objectContaining({
                status: 'CANCELED',
                plan_code: 'FREE',
                cancel_at: expect.any(String),
            }),
            filters: [['external_id', 'sub_789_conflict']],
        });
        expect(recordMarketingEventWithAdmin).toHaveBeenCalledWith(
            adminClient,
            expect.objectContaining({
                eventName: 'subscription_canceled',
                tenantId: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                path: '/checkout',
                planStrategy: 'AVALANCHE',
            }),
            expect.objectContaining({
                attributionId: 'attr-correct',
                source: 'partner',
                medium: 'referral',
            })
        );
    });
});
