import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const requireUserTenantMock = vi.fn();
const revalidatePathMock = vi.fn();
const getReceiptSignedUrlMock = vi.fn();

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant: requireUserTenantMock,
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/storage/receipts', () => ({
    getReceiptSignedUrl: getReceiptSignedUrlMock,
}));

// Per-test override for the payments table response.
let nextPaymentRow: { data: unknown; error: unknown } = { data: null, error: null };
let nextUpdateResult: { error: unknown } = { error: null };

function buildSupabaseMock() {
    const selectChain = {
        select: vi.fn(() => selectChain),
        eq: vi.fn(() => selectChain),
        maybeSingle: vi.fn(() => Promise.resolve(nextPaymentRow)),
    };

    const updateChain = {
        update: vi.fn(() => updateChain),
        eq: vi.fn(() => {
            // Last .eq() in the chain resolves with the update result.
            return Object.assign(updateChain, {
                then: (resolve: (r: { error: unknown }) => void) =>
                    Promise.resolve(nextUpdateResult).then(resolve),
            });
        }),
    };

    return {
        from: vi.fn((_table: string) => ({
            ...selectChain,
            ...updateChain,
        })),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    nextPaymentRow = { data: null, error: null };
    nextUpdateResult = { error: null };
});

// ============================================
// updatePaymentReceipt
// ============================================

describe('updatePaymentReceipt', () => {
    it('rejects unauthenticated callers', async () => {
        requireUserTenantMock.mockRejectedValueOnce(new Error('No autenticado'));
        const { updatePaymentReceipt } = await import('@/lib/actions/payment-receipts');
        const result = await updatePaymentReceipt({
            paymentId: 'p-1',
            receiptPath: 'u/t/p.jpg',
        });
        expect(result).toEqual({ success: false, error: 'No autenticado' });
    });

    it('rejects missing inputs', async () => {
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { updatePaymentReceipt } = await import('@/lib/actions/payment-receipts');
        const result = await updatePaymentReceipt({ paymentId: '', receiptPath: '' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/inválidos/);
    });

    it('returns 404 when the payment does not belong to the tenant', async () => {
        nextPaymentRow = { data: null, error: null };
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { updatePaymentReceipt } = await import('@/lib/actions/payment-receipts');
        const result = await updatePaymentReceipt({
            paymentId: 'p-other',
            receiptPath: 'u/t/p.jpg',
        });
        expect(result).toEqual({ success: false, error: 'Pago no encontrado' });
        expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it('writes receipt path and revalidates /payments on success', async () => {
        nextPaymentRow = { data: { id: 'p-1' }, error: null };
        nextUpdateResult = { error: null };
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { updatePaymentReceipt } = await import('@/lib/actions/payment-receipts');
        const result = await updatePaymentReceipt({
            paymentId: 'p-1',
            receiptPath: 'u1/t1/p-1.jpg',
        });
        expect(result).toEqual({ success: true });
        expect(revalidatePathMock).toHaveBeenCalledWith('/payments');
    });

    it('surfaces update errors', async () => {
        nextPaymentRow = { data: { id: 'p-1' }, error: null };
        nextUpdateResult = { error: new Error('db boom') };
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { updatePaymentReceipt } = await import('@/lib/actions/payment-receipts');
        const result = await updatePaymentReceipt({
            paymentId: 'p-1',
            receiptPath: 'u1/t1/p-1.jpg',
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/guardando/);
    });
});

// ============================================
// getReceiptUrlAction
// ============================================

describe('getReceiptUrlAction', () => {
    it('rejects unauthenticated callers', async () => {
        requireUserTenantMock.mockRejectedValueOnce(new Error('No autenticado'));
        const { getReceiptUrlAction } = await import('@/lib/actions/payment-receipts');
        const result = await getReceiptUrlAction('p-1');
        expect(result).toEqual({ success: false, error: 'No autenticado' });
    });

    it('returns 404 when payment has no receipt', async () => {
        nextPaymentRow = { data: { receipt_url: null }, error: null };
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { getReceiptUrlAction } = await import('@/lib/actions/payment-receipts');
        const result = await getReceiptUrlAction('p-1');
        expect(result.success).toBe(false);
        expect((result as { error: string }).error).toMatch(/comprobante/);
    });

    it('returns a signed URL on success', async () => {
        nextPaymentRow = { data: { receipt_url: 'u/t/p.jpg' }, error: null };
        getReceiptSignedUrlMock.mockResolvedValueOnce('https://signed/abc');
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { getReceiptUrlAction } = await import('@/lib/actions/payment-receipts');
        const result = await getReceiptUrlAction('p-1');
        expect(result).toEqual({ success: true, url: 'https://signed/abc' });
    });

    it('handles signing failures', async () => {
        nextPaymentRow = { data: { receipt_url: 'u/t/p.jpg' }, error: null };
        getReceiptSignedUrlMock.mockRejectedValueOnce(new Error('sig fail'));
        requireUserTenantMock.mockResolvedValueOnce({
            supabase: buildSupabaseMock(),
            user: { id: 'u1' },
            tenantId: 't1',
        });
        const { getReceiptUrlAction } = await import('@/lib/actions/payment-receipts');
        const result = await getReceiptUrlAction('p-1');
        expect(result.success).toBe(false);
        expect((result as { error: string }).error).toMatch(/firmada/);
    });
});
