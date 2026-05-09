import { describe, it, expect, vi, beforeEach } from 'vitest';

const requirePermissionMock = vi.fn();
const logAdminActionMock = vi.fn();
const adminInsertMock = vi.fn();
const adminUpsertMock = vi.fn();
const adminDeleteMock = vi.fn();
const adminSelectSingleMock = vi.fn();
const recordEventMock = vi.fn();
const logEventMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/lib/actions/admin-auth', () => ({
    requirePermission: requirePermissionMock,
    logAdminAction: logAdminActionMock,
}));

// Default upsert / insert results — tests can override via the mocks themselves.
let nextInsertResult: { error: unknown } = { error: null };
let nextUpsertResult: { error: unknown } = { error: null };
let nextDeleteResult: { error: unknown } = { error: null };

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: () => ({
        from: (table: string) => ({
            insert: (...args: unknown[]) => {
                adminInsertMock(table, ...args);
                return Promise.resolve(nextInsertResult);
            },
            upsert: (...args: unknown[]) => {
                adminUpsertMock(table, ...args);
                return Promise.resolve(nextUpsertResult);
            },
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve(adminSelectSingleMock(table)),
                }),
            }),
            // Rollback path: admin.from(...).delete().eq().eq().eq() returns { error }.
            delete: () => {
                adminDeleteMock(table);
                const chain = {
                    eq: () => chain,
                    then: (resolve: (value: { error: unknown }) => unknown) =>
                        Promise.resolve(nextDeleteResult).then(resolve),
                };
                return chain;
            },
        }),
    }),
}));

vi.mock('@/lib/funnel/events', () => ({
    recordMarketingEventWithAdmin: recordEventMock,
}));

vi.mock('@/lib/funnel/attribution', () => ({
    createMarketingContext: () => ({
        attributionId: 'attr-test',
        source: null,
        medium: null,
        campaignId: null,
        campaignName: null,
        creativeId: null,
        creativeName: null,
        partnerSlug: null,
        referralCode: null,
        landingVariant: null,
        offerVariant: null,
        ctaContext: null,
        path: null,
        firstTouch: null,
        lastTouch: null,
    }),
}));

vi.mock('@/lib/logger', () => ({
    logPaymentEvent: logEventMock,
    logger: {
        error: loggerErrorMock,
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    nextInsertResult = { error: null };
    nextUpsertResult = { error: null };
    nextDeleteResult = { error: null };
    adminSelectSingleMock.mockReturnValue({
        data: { created_by_user_id: 'owner-user-id' },
        error: null,
    });
});

describe('adminGrantManualSubscription', () => {
    it('throws when admin lacks permission', async () => {
        requirePermissionMock.mockRejectedValueOnce(new Error('Permission denied: subscriptions:update'));
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        await expect(
            adminGrantManualSubscription({
                tenantId: '00000000-0000-4000-8000-000000000001',
                variantCode: 'PRO_QUARTERLY',
                bankReference: 'BI-12345',
                notes: null,
            })
        ).rejects.toThrow(/Permission denied/);
        expect(adminInsertMock).not.toHaveBeenCalled();
        expect(adminUpsertMock).not.toHaveBeenCalled();
    });

    it('rejects PRO_PASS_90D as Android-only', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'a-1', email: 'a@x', role: 'ADMIN', displayName: null });
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        await expect(
            adminGrantManualSubscription({
                tenantId: '00000000-0000-4000-8000-000000000001',
                variantCode: 'PRO_PASS_90D' as 'PRO_QUARTERLY',
                bankReference: 'BI-12345',
                notes: null,
            })
        ).rejects.toThrow();
        expect(adminInsertMock).not.toHaveBeenCalled();
    });

    it('rejects bankReference shorter than 3 chars', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'a-1', email: 'a@x', role: 'ADMIN', displayName: null });
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        await expect(
            adminGrantManualSubscription({
                tenantId: '00000000-0000-4000-8000-000000000001',
                variantCode: 'PRO_QUARTERLY',
                bankReference: 'BI',
                notes: null,
            })
        ).rejects.toThrow();
        expect(adminInsertMock).not.toHaveBeenCalled();
    });

    it('inserts grant + upserts subscription on success', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'admin-uuid', email: 'a@x', role: 'ADMIN', displayName: null });
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        const result = await adminGrantManualSubscription({
            tenantId: '11111111-1111-4111-8111-111111111111',
            variantCode: 'PRO_QUARTERLY',
            bankReference: 'BI-12345',
            notes: 'Customer paid via Banco Industrial',
        });

        expect(result.ok).toBe(true);
        expect(typeof result.expiresAt).toBe('string');

        // Grant inserted
        expect(adminInsertMock).toHaveBeenCalledWith(
            'manual_payment_grants',
            expect.objectContaining({
                tenant_id: '11111111-1111-4111-8111-111111111111',
                granted_by_admin_id: 'admin-uuid',
                variant_code: 'PRO_QUARTERLY',
                price_amount_q: 119,
                duration_days: 90,
                bank_reference: 'BI-12345',
            })
        );

        // Subscription upserted with provider, payment_method, and start_at populated.
        expect(adminUpsertMock).toHaveBeenCalledWith(
            'subscriptions',
            expect.objectContaining({
                tenant_id: '11111111-1111-4111-8111-111111111111',
                plan_code: 'PRO',
                status: 'ACTIVE',
                billing_interval: 'quarterly',
                price_amount_q: 119,
                provider: 'manual_transfer',
                payment_method: 'manual_transfer',
                start_at: expect.any(String),
            }),
            expect.objectContaining({ onConflict: 'tenant_id' })
        );

        // Audit log recorded via logAdminAction
        expect(logAdminActionMock).toHaveBeenCalledWith(
            'admin-uuid',
            'subscription.manual_grant',
            'subscriptions',
            '11111111-1111-4111-8111-111111111111',
            expect.objectContaining({
                variantCode: 'PRO_QUARTERLY',
                priceQ: 119,
                bankReference: 'BI-12345',
                durationDays: 90,
            })
        );

        // Marketing event recorded
        expect(recordEventMock).toHaveBeenCalled();

        // Payment event logged
        expect(logEventMock).toHaveBeenCalled();

        // No rollback on success path
        expect(adminDeleteMock).not.toHaveBeenCalled();
    });

    it('maps PRO_MONTHLY to billing_interval=monthly', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'admin-uuid', email: 'a@x', role: 'ADMIN', displayName: null });
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        await adminGrantManualSubscription({
            tenantId: '22222222-2222-4222-8222-222222222222',
            variantCode: 'PRO_MONTHLY',
            bankReference: 'BANRURAL-001',
            notes: null,
        });
        expect(adminUpsertMock).toHaveBeenCalledWith(
            'subscriptions',
            expect.objectContaining({ billing_interval: 'monthly', price_amount_q: 49 }),
            expect.anything()
        );
    });

    it('maps PRO_ANNUAL to billing_interval=yearly', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'admin-uuid', email: 'a@x', role: 'ADMIN', displayName: null });
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');
        await adminGrantManualSubscription({
            tenantId: '33333333-3333-4333-8333-333333333333',
            variantCode: 'PRO_ANNUAL',
            bankReference: 'BAM-9999',
            notes: null,
        });
        expect(adminUpsertMock).toHaveBeenCalledWith(
            'subscriptions',
            expect.objectContaining({ billing_interval: 'yearly', price_amount_q: 399 }),
            expect.anything()
        );
    });

    it('throws sanitized error when grant insert fails (no raw DB error leaked)', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'admin-uuid', email: 'a@x', role: 'ADMIN', displayName: null });
        nextInsertResult = { error: { code: '23505', details: 'duplicate key value violates constraint xyz' } };
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');

        await expect(
            adminGrantManualSubscription({
                tenantId: '44444444-4444-4444-8444-444444444444',
                variantCode: 'PRO_QUARTERLY',
                bankReference: 'BI-DUP',
                notes: null,
            })
        ).rejects.toThrow('Error al registrar la concesión manual. Intenta nuevamente.');

        // Internal logger captured the real details
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ code: '23505' }),
            expect.stringContaining('manual_payment_grants insert failed')
        );
        // Did not proceed to subscription upsert
        expect(adminUpsertMock).not.toHaveBeenCalled();
        expect(logAdminActionMock).not.toHaveBeenCalled();
    });

    it('rolls back grant and throws sanitized error when subscription upsert fails', async () => {
        requirePermissionMock.mockResolvedValueOnce({ adminId: 'admin-uuid', email: 'a@x', role: 'ADMIN', displayName: null });
        nextUpsertResult = { error: { code: '23502', details: 'null value in column "user_id"' } };
        const { adminGrantManualSubscription } = await import('@/lib/actions/admin-billing');

        await expect(
            adminGrantManualSubscription({
                tenantId: '55555555-5555-4555-8555-555555555555',
                variantCode: 'PRO_QUARTERLY',
                bankReference: 'BI-ROLLBACK',
                notes: null,
            })
        ).rejects.toThrow('Error al activar la suscripción. Intenta nuevamente o contacta soporte.');

        // Real DB error logged internally
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ code: '23502' }),
            expect.stringContaining('subscriptions upsert failed')
        );
        // Compensation: rollback issued against manual_payment_grants
        expect(adminDeleteMock).toHaveBeenCalledWith('manual_payment_grants');
        // Did not record audit_logs / marketing event on failure
        expect(logAdminActionMock).not.toHaveBeenCalled();
        expect(recordEventMock).not.toHaveBeenCalled();
    });
});
