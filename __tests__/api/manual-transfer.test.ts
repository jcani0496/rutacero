import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireUserTenantMock = vi.fn();
const recordEventMock = vi.fn();
const sendEmailMock = vi.fn();
const applyRateLimitMock = vi.fn();
const rateLimitExceededResponseMock = vi.fn(
    () => new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429 })
);

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant: requireUserTenantMock,
}));
vi.mock('@/lib/funnel/events', () => ({
    recordMarketingEvent: recordEventMock,
}));
class BankAccountConfigErrorMock extends Error {
    constructor() {
        super('BANK_TRANSFER_INSTRUCTIONS_JSON has no valid accounts configured.');
        this.name = 'BankAccountConfigError';
    }
}
vi.mock('@/lib/resend/transfer', () => ({
    sendTransferInstructionsEmail: sendEmailMock,
    BankAccountConfigError: BankAccountConfigErrorMock,
}));
vi.mock('@/lib/rate-limit', () => ({
    applyRateLimit: applyRateLimitMock,
    getClientIdentifier: () => 'test-id',
    rateLimitExceededResponse: rateLimitExceededResponseMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ success: true });
});

function makeRequest(body: unknown) {
    return new Request('http://localhost/api/billing/manual-transfer', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('POST /api/billing/manual-transfer', () => {
    it('returns 429 when rate-limited', async () => {
        applyRateLimitMock.mockResolvedValueOnce({ success: false });
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_QUARTERLY' }) as never);
        expect(res.status).toBe(429);
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('returns 401 when unauthenticated', async () => {
        requireUserTenantMock.mockRejectedValueOnce(new Error('No autenticado'));
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_QUARTERLY' }) as never);
        expect(res.status).toBe(401);
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('returns 400 for unknown variant', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: '11111111-1111-4111-8111-111111111111',
        });
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_FOO' }) as never);
        expect(res.status).toBe(400);
    });

    it('returns 400 for PRO_PASS_90D (Android-only) due to enum exclusion', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: '11111111-1111-4111-8111-111111111111',
        });
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_PASS_90D' }) as never);
        expect(res.status).toBe(400);
    });

    it('returns 400 when user has no email', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            user: { id: 'u-1', email: null },
            tenantId: '11111111-1111-4111-8111-111111111111',
        });
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_MONTHLY' }) as never);
        expect(res.status).toBe(400);
    });

    it('happy path returns referenceCode RC-<tenant>-<suffix>', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: '11111111-1111-4111-8111-111111111111',
        });
        sendEmailMock.mockResolvedValueOnce(undefined);
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_QUARTERLY' }) as never);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.referenceCode).toMatch(/^RC-[0-9A-F]{8}-[0-9A-Z]+-[0-9A-Z]{4}$/);
        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        expect(recordEventMock).toHaveBeenCalledTimes(1);
        expect(recordEventMock.mock.calls[0][0]).toMatchObject({
            eventName: 'checkout_started',
            metadata: expect.objectContaining({ method: 'manual_transfer' }),
        });
    });

    it('returns 502 when email send fails', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: '11111111-1111-4111-8111-111111111111',
        });
        sendEmailMock.mockRejectedValueOnce(new Error('Resend down'));
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_MONTHLY' }) as never);
        expect(res.status).toBe(502);
        expect(recordEventMock).not.toHaveBeenCalled();
    });

    it('returns 503 SERVICE_UNAVAILABLE when bank accounts are not configured', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            user: { id: 'u-1', email: 'u@example.com' },
            tenantId: '11111111-1111-4111-8111-111111111111',
        });
        sendEmailMock.mockRejectedValueOnce(new BankAccountConfigErrorMock());
        const { POST } = await import('@/app/api/billing/manual-transfer/route');
        const res = await POST(makeRequest({ variantCode: 'PRO_MONTHLY' }) as never);
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.error).toBe('SERVICE_UNAVAILABLE');
        expect(recordEventMock).not.toHaveBeenCalled();
    });
});
