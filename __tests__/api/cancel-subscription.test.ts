import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireUserTenantMock = vi.fn();
const applyRateLimitMock = vi.fn();
const rateLimitExceededResponseMock = vi.fn(
    () => new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429 })
);
const createAdminClientMock = vi.fn();
const adminUpdateMock = vi.fn();
const adminEqMock = vi.fn();
const userSelectSingleMock = vi.fn();
const userSupabaseFromMock = vi.fn();
const recurrenteCancelMock = vi.fn();
const getRecurrenteClientMock = vi.fn(() => ({
    cancelSubscription: recurrenteCancelMock,
}));

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant: requireUserTenantMock,
}));
vi.mock('@/lib/rate-limit', () => ({
    applyRateLimit: applyRateLimitMock,
    getClientIdentifier: () => 'test-id',
    rateLimitExceededResponse: rateLimitExceededResponseMock,
}));
vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: createAdminClientMock,
}));
vi.mock('@/lib/recurrente/client', () => ({
    getRecurrenteClient: getRecurrenteClientMock,
}));

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ success: true });

    // Default: user-scoped supabase SELECT returns an active PRO subscription.
    userSelectSingleMock.mockResolvedValue({
        data: {
            tenant_id: TENANT_ID,
            plan_code: 'PRO',
            status: 'ACTIVE',
            external_id: 'rcr_sub_123',
        },
        error: null,
    });
    userSupabaseFromMock.mockImplementation(() => ({
        select: () => ({
            eq: () => ({
                single: userSelectSingleMock,
            }),
        }),
    }));

    // Admin UPDATE chain: admin.from('subscriptions').update({...}).eq('tenant_id', X)
    adminEqMock.mockResolvedValue({ error: null });
    adminUpdateMock.mockReturnValue({ eq: adminEqMock });
    createAdminClientMock.mockReturnValue({
        from: vi.fn(() => ({ update: adminUpdateMock })),
    });

    recurrenteCancelMock.mockResolvedValue(undefined);
});

function makeRequest(body?: unknown) {
    return new Request('http://localhost/api/recurrente/cancel-subscription', {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/recurrente/cancel-subscription', () => {
    it('returns 429 when rate-limited', async () => {
        applyRateLimitMock.mockResolvedValueOnce({ success: false });
        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);
        expect(res.status).toBe(429);
        expect(adminUpdateMock).not.toHaveBeenCalled();
    });

    it('returns 500 when unauthenticated (requireUserTenant throws, caught by outer try/catch)', async () => {
        // The route does not handle auth errors specifically — they fall into the
        // generic catch which returns 500. This test pins that behavior so any
        // future change to a 401 is intentional.
        requireUserTenantMock.mockRejectedValueOnce(new Error('No autenticado'));
        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);
        expect(res.status).toBe(500);
        expect(adminUpdateMock).not.toHaveBeenCalled();
        expect(recurrenteCancelMock).not.toHaveBeenCalled();
    });

    it('happy path uses admin client for the UPDATE (not the user-scoped supabase)', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: { from: userSupabaseFromMock },
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: TENANT_ID,
        });

        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        // Recurrente cancel was invoked for the external subscription
        expect(recurrenteCancelMock).toHaveBeenCalledWith('rcr_sub_123');

        // Admin client was used for the UPDATE (this is the whole point of the fix)
        expect(createAdminClientMock).toHaveBeenCalledTimes(1);
        expect(adminUpdateMock).toHaveBeenCalledTimes(1);
        const updatePayload = adminUpdateMock.mock.calls[0][0];
        expect(updatePayload).toMatchObject({ status: 'CANCELED' });
        expect(typeof updatePayload.cancel_at).toBe('string');
        expect(adminEqMock).toHaveBeenCalledWith('tenant_id', TENANT_ID);
    });

    it('ignores tenantId supplied in the request body and uses the session tenantId', async () => {
        const ATTACKER_TENANT = '22222222-2222-4222-8222-222222222222';
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: { from: userSupabaseFromMock },
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: TENANT_ID,
        });

        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        // Try to inject a foreign tenant id in the body — route must ignore it
        const res = await POST(makeRequest({ tenantId: ATTACKER_TENANT }) as never);

        expect(res.status).toBe(200);
        // The UPDATE filter must be the session tenantId, never the body value
        expect(adminEqMock).toHaveBeenCalledWith('tenant_id', TENANT_ID);
        expect(adminEqMock).not.toHaveBeenCalledWith('tenant_id', ATTACKER_TENANT);
    });

    it('returns 404 when no subscription is found', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: { from: userSupabaseFromMock },
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: TENANT_ID,
        });
        userSelectSingleMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'not found' },
        });

        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);

        expect(res.status).toBe(404);
        expect(adminUpdateMock).not.toHaveBeenCalled();
    });

    it('returns 400 when subscription is already CANCELED', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: { from: userSupabaseFromMock },
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: TENANT_ID,
        });
        userSelectSingleMock.mockResolvedValueOnce({
            data: {
                tenant_id: TENANT_ID,
                plan_code: 'PRO',
                status: 'CANCELED',
                external_id: 'rcr_sub_123',
            },
            error: null,
        });

        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);

        expect(res.status).toBe(400);
        expect(adminUpdateMock).not.toHaveBeenCalled();
        expect(recurrenteCancelMock).not.toHaveBeenCalled();
    });

    it('still cancels locally when Recurrente API fails', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: { from: userSupabaseFromMock },
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: TENANT_ID,
        });
        recurrenteCancelMock.mockRejectedValueOnce(new Error('Recurrente down'));

        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);

        expect(res.status).toBe(200);
        expect(adminUpdateMock).toHaveBeenCalledTimes(1);
        expect(adminEqMock).toHaveBeenCalledWith('tenant_id', TENANT_ID);
    });

    it('returns 500 when the admin UPDATE fails', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: { from: userSupabaseFromMock },
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: TENANT_ID,
        });
        adminEqMock.mockResolvedValueOnce({
            error: { message: 'update failed' },
        });

        const { POST } = await import('@/app/api/recurrente/cancel-subscription/route');
        const res = await POST(makeRequest() as never);

        expect(res.status).toBe(500);
    });
});
