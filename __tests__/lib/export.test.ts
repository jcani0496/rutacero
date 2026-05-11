import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const requireUserTenantMock = vi.fn();
const checkFeatureAccessMock = vi.fn();

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant: requireUserTenantMock,
}));

vi.mock('@/lib/utils/feature-access', () => ({
    checkFeatureAccess: checkFeatureAccessMock,
}));

// Per-test override for what supabase.from(...).select().eq().eq().order()
// returns for the `debts` table.
let nextDebtsResult: { data: unknown; error: unknown } = { data: [], error: null };
// Per-test override for the `payments` table query.
let nextPaymentsResult: { data: unknown; error: unknown } = { data: [], error: null };

function buildSupabaseMock() {
    const buildChain = (table: string) => {
        const finalResult = table === 'debts' ? nextDebtsResult : nextPaymentsResult;
        const chain = {
            select: () => chain,
            eq: () => chain,
            order: () => Promise.resolve(finalResult),
            // Some PRO functions hit different terminal methods; raw exports
            // only need select+eq+eq+order, so we keep this minimal.
            single: () => Promise.resolve(finalResult),
        };
        return chain;
    };

    return {
        from: (table: string) => buildChain(table),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    nextDebtsResult = { data: [], error: null };
    nextPaymentsResult = { data: [], error: null };
    requireUserTenantMock.mockResolvedValue({
        supabase: buildSupabaseMock(),
        user: { id: 'user-123' },
        tenantId: 'tenant-1',
    });
    checkFeatureAccessMock.mockResolvedValue({
        hasAccess: true,
        planCode: 'PRO',
        isPro: true,
    });
});

// ============================================
// FREE EXPORTS — RAW DEBTS
// ============================================

describe('exportRawDebts (FREE — right of portability)', () => {
    it('returns CSV with the expected raw header columns', async () => {
        nextDebtsResult = {
            data: [
                {
                    id: 'd1',
                    type: 'CREDIT_CARD',
                    creditor: 'BAC',
                    balance: 1000,
                    currency: 'GTQ',
                    apr: 24.5,
                    min_payment: 50,
                    statement_date: '2026-01-15',
                    due_date: 28,
                    next_payment_date: '2026-02-28',
                    installment_count: null,
                    installments_left: null,
                    fixed_payment: null,
                    status: 'ACTIVE',
                    notes: 'Some notes',
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-02T00:00:00Z',
                },
            ],
            error: null,
        };

        const { exportRawDebts } = await import('@/lib/actions/export');
        const result = await exportRawDebts();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        const csv = result.data as string;
        const [header, row] = csv.split('\n');

        expect(header).toBe(
            'id,type,creditor,balance,currency,apr,min_payment,statement_date,due_date,next_payment_date,installment_count,installments_left,fixed_payment,status,notes,created_at,updated_at'
        );
        // Row should NOT contain analytics columns (no health_score, etc.).
        expect(row).toContain('d1');
        expect(row).toContain('BAC');
        expect(row).toContain('1000');
    });

    it('does NOT call the PRO gate (free path — portability)', async () => {
        // Make the gate throw if anyone calls it. The function must not
        // touch the gate at all for the free portability export.
        checkFeatureAccessMock.mockImplementation(() => {
            throw new Error('checkFeatureAccess should not be called for raw exports');
        });

        const { exportRawDebts } = await import('@/lib/actions/export');
        const result = await exportRawDebts();

        expect(result.success).toBe(true);
        expect(checkFeatureAccessMock).not.toHaveBeenCalled();
    });

    it('returns success with empty data when the user has no debts', async () => {
        nextDebtsResult = { data: [], error: null };
        const { exportRawDebts } = await import('@/lib/actions/export');
        const result = await exportRawDebts();

        // FREE export still succeeds (header-only CSV) — the user is exercising
        // their portability right; "no rows" is a valid answer, not an error.
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        // Just the header row.
        expect((result.data as string).split('\n').length).toBe(1);
    });

    it('returns auth error when not authenticated', async () => {
        requireUserTenantMock.mockRejectedValueOnce(new Error('No autenticado'));
        const { exportRawDebts } = await import('@/lib/actions/export');
        const result = await exportRawDebts();
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No autenticado/);
    });

    it('escapes CSV cells containing commas and quotes correctly', async () => {
        nextDebtsResult = {
            data: [
                {
                    id: 'd2',
                    type: 'CREDIT_CARD',
                    creditor: 'BAC, "tarjeta"',
                    balance: 500,
                    currency: 'GTQ',
                    apr: null,
                    min_payment: null,
                    statement_date: null,
                    due_date: null,
                    next_payment_date: null,
                    installment_count: null,
                    installments_left: null,
                    fixed_payment: null,
                    status: 'ACTIVE',
                    notes: 'line1\nline2',
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-02T00:00:00Z',
                },
            ],
            error: null,
        };

        const { exportRawDebts } = await import('@/lib/actions/export');
        const result = await exportRawDebts();
        expect(result.success).toBe(true);

        const csv = result.data as string;
        // Creditor cell must be wrapped in quotes and inner quotes doubled
        // (RFC 4180 escaping). The exact escaped substring should appear.
        expect(csv).toContain('"BAC, ""tarjeta"""');
        // Notes with embedded newline must also be wrapped in quotes so the
        // newline does not break the row structure.
        expect(csv).toContain('"line1\nline2"');
    });
});

// ============================================
// FREE EXPORTS — RAW PAYMENTS
// ============================================

describe('exportRawPayments (FREE — right of portability)', () => {
    it('returns CSV with the expected raw header columns', async () => {
        nextPaymentsResult = {
            data: [
                {
                    id: 'p1',
                    debt_id: 'd1',
                    amount: 250,
                    currency: 'GTQ',
                    payment_date: '2026-02-15',
                    method: 'transferencia',
                    created_at: '2026-02-15T10:00:00Z',
                },
            ],
            error: null,
        };

        const { exportRawPayments } = await import('@/lib/actions/export');
        const result = await exportRawPayments();

        expect(result.success).toBe(true);
        const csv = result.data as string;
        const [header] = csv.split('\n');
        expect(header).toBe(
            'id,debt_id,amount,currency,payment_date,method,created_at'
        );
    });

    it('does NOT call the PRO gate (free path — portability)', async () => {
        checkFeatureAccessMock.mockImplementation(() => {
            throw new Error('checkFeatureAccess should not be called for raw exports');
        });

        const { exportRawPayments } = await import('@/lib/actions/export');
        const result = await exportRawPayments();

        expect(result.success).toBe(true);
        expect(checkFeatureAccessMock).not.toHaveBeenCalled();
    });
});

// ============================================
// PRO-GATED EXPORTS — REGRESSION GUARDS
// ============================================

describe('PRO-gated exports retain their gate', () => {
    it('exportDebtsCSV returns requiresUpgrade when feature access is denied', async () => {
        checkFeatureAccessMock.mockResolvedValueOnce({
            hasAccess: false,
            planCode: 'FREE',
            isPro: false,
        });

        const { exportDebtsCSV } = await import('@/lib/actions/export');
        const result = await exportDebtsCSV();

        expect(result.success).toBe(false);
        expect(result.requiresUpgrade).toBe(true);
        expect(result.error).toMatch(/PRO/);
    });

    it('exportPaymentsCSV returns requiresUpgrade when feature access is denied', async () => {
        checkFeatureAccessMock.mockResolvedValueOnce({
            hasAccess: false,
            planCode: 'FREE',
            isPro: false,
        });

        const { exportPaymentsCSV } = await import('@/lib/actions/export');
        const result = await exportPaymentsCSV();

        expect(result.success).toBe(false);
        expect(result.requiresUpgrade).toBe(true);
        expect(result.error).toMatch(/PRO/);
    });

    it('exportSummaryReport returns requiresUpgrade when feature access is denied', async () => {
        checkFeatureAccessMock.mockResolvedValueOnce({
            hasAccess: false,
            planCode: 'FREE',
            isPro: false,
        });

        const { exportSummaryReport } = await import('@/lib/actions/export');
        const result = await exportSummaryReport();

        expect(result.success).toBe(false);
        expect(result.requiresUpgrade).toBe(true);
    });

    it('exportPlanReportCSV returns requiresUpgrade when feature access is denied', async () => {
        checkFeatureAccessMock.mockResolvedValueOnce({
            hasAccess: false,
            planCode: 'FREE',
            isPro: false,
        });

        const { exportPlanReportCSV } = await import('@/lib/actions/export');
        const result = await exportPlanReportCSV();

        expect(result.success).toBe(false);
        expect(result.requiresUpgrade).toBe(true);
    });
});
