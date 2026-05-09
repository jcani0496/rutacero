import { describe, it, expect, vi, beforeEach } from 'vitest';

const requirePermissionMock = vi.fn();
const adminInsertMock = vi.fn();
const adminUpsertMock = vi.fn();
const adminSelectSingleMock = vi.fn();
const recordEventMock = vi.fn();
const logEventMock = vi.fn();

vi.mock('@/lib/actions/admin-auth', () => ({
    requirePermission: requirePermissionMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: () => ({
        from: (table: string) => ({
            insert: (...args: unknown[]) => {
                adminInsertMock(table, ...args);
                return Promise.resolve({ error: null });
            },
            upsert: (...args: unknown[]) => {
                adminUpsertMock(table, ...args);
                return Promise.resolve({ error: null });
            },
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve(adminSelectSingleMock(table)),
                }),
            }),
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
}));

beforeEach(() => {
    vi.clearAllMocks();
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

        // Subscription upserted
        expect(adminUpsertMock).toHaveBeenCalledWith(
            'subscriptions',
            expect.objectContaining({
                tenant_id: '11111111-1111-4111-8111-111111111111',
                plan_code: 'PRO',
                status: 'ACTIVE',
                billing_interval: 'quarterly',
                price_amount_q: 119,
                payment_method: 'manual_transfer',
            }),
            expect.objectContaining({ onConflict: 'tenant_id' })
        );

        // Marketing event recorded
        expect(recordEventMock).toHaveBeenCalled();

        // Payment event logged
        expect(logEventMock).toHaveBeenCalled();
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
});
