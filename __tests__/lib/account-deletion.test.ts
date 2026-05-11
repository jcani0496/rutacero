import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireUserTenantMock = vi.fn();
const sendEmailMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

const adminInsertMock = vi.fn();
const adminUpdateMock = vi.fn();
const adminMaybeSingleMock = vi.fn();

vi.mock('@/lib/tenant/server', () => ({
    requireUserTenant: requireUserTenantMock,
}));

vi.mock('@/lib/emails/send-account-deletion-confirmation', () => ({
    sendAccountDeletionConfirmation: sendEmailMock,
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: loggerInfoMock,
        warn: loggerWarnMock,
        error: loggerErrorMock,
    },
}));

// Inputs the test can override per case.
let nextMaybeSingleResult: { data: unknown; error: unknown } = {
    data: null,
    error: null,
};
let nextInsertResult: { error: unknown } = { error: null };
// Result for the `cancelAccountDeletion` UPDATE-with-RETURNING chain
// (update().eq().is().is().select().maybeSingle()).
let nextUpdateReturningResult: { data: unknown; error: unknown } = {
    data: { id: 'req-9' },
    error: null,
};

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: () => ({
        from: (table: string) => ({
            insert: (payload: unknown) => {
                adminInsertMock(table, payload);
                return Promise.resolve(nextInsertResult);
            },
            select: () => {
                const chain = {
                    eq: () => chain,
                    is: () => chain,
                    maybeSingle: () => {
                        adminMaybeSingleMock(table);
                        return Promise.resolve(nextMaybeSingleResult);
                    },
                };
                return chain;
            },
            update: (payload: unknown) => {
                adminUpdateMock(table, payload);
                // UPDATE-with-RETURNING chain: update().eq().is().is().select().maybeSingle()
                const updateChain = {
                    eq: () => updateChain,
                    is: () => updateChain,
                    select: () => ({
                        maybeSingle: () =>
                            Promise.resolve(nextUpdateReturningResult),
                    }),
                };
                return updateChain;
            },
        }),
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    nextMaybeSingleResult = { data: null, error: null };
    nextInsertResult = { error: null };
    nextUpdateReturningResult = { data: { id: 'req-9' }, error: null };
    requireUserTenantMock.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        tenantId: 'tenant-1',
        supabase: {},
    });
    sendEmailMock.mockResolvedValue(undefined);
});

describe('requestAccountDeletion', () => {
    it('inserts a row with executes_at ~7 days out and returns ok', async () => {
        const before = Date.now();
        const { requestAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await requestAccountDeletion({ reason: 'Just trying it' });
        const after = Date.now();

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(adminInsertMock).toHaveBeenCalledWith(
            'account_deletion_requests',
            expect.objectContaining({
                user_id: 'user-123',
                reason: 'Just trying it',
                executes_at: expect.any(String),
            })
        );

        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const executesAtMs = new Date(result.executesAt).getTime();
        expect(executesAtMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
        expect(executesAtMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);

        expect(sendEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'user@example.com',
                gracePeriodDays: 7,
            })
        );
    });

    it('returns the existing pending row when one is already active (idempotent)', async () => {
        nextMaybeSingleResult = {
            data: { id: 'req-1', executes_at: '2026-05-16T13:00:00.000Z' },
            error: null,
        };
        const { requestAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await requestAccountDeletion({ reason: null });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.executesAt).toBe('2026-05-16T13:00:00.000Z');
        expect(adminInsertMock).not.toHaveBeenCalled();
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('returns sanitized error and logs internally when insert fails', async () => {
        nextInsertResult = {
            error: { code: '23505', message: 'duplicate key' },
        };
        const { requestAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await requestAccountDeletion({ reason: null });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No se pudo registrar la solicitud/);
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ code: '23505' }),
            expect.stringContaining('insert failed')
        );
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('still records the request when the email fails (best effort)', async () => {
        sendEmailMock.mockRejectedValueOnce(new Error('Resend down'));
        const { requestAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await requestAccountDeletion({ reason: null });
        expect(result.ok).toBe(true);
        expect(adminInsertMock).toHaveBeenCalled();
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.objectContaining({ err: 'Resend down' }),
            expect.stringContaining('email failed')
        );
    });
});

describe('cancelAccountDeletion', () => {
    it('flips canceled_at via atomic UPDATE-with-RETURNING when an active row exists', async () => {
        nextUpdateReturningResult = { data: { id: 'req-9' }, error: null };
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(true);
        // The new path issues a single UPDATE (no separate SELECT) with
        // canceled_at set; row filtering happens in WHERE clauses.
        expect(adminUpdateMock).toHaveBeenCalledWith(
            'account_deletion_requests',
            expect.objectContaining({ canceled_at: expect.any(String) })
        );
        expect(adminMaybeSingleMock).not.toHaveBeenCalled();
    });

    it('returns error when no active row matched (already canceled, executed, or never existed)', async () => {
        nextUpdateReturningResult = { data: null, error: null };
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No hay solicitud activa/);
        // The UPDATE was attempted (it's how we "claim"), but no row matched.
        expect(adminUpdateMock).toHaveBeenCalled();
    });

    it('returns error when cron has already claimed the row (regression: race window closed)', async () => {
        // Simulating the race: cron set executed_at between user click and
        // server action. The atomic UPDATE filter excludes the row, so
        // Supabase returns no data. The user's cancel intent is too late.
        nextUpdateReturningResult = { data: null, error: null };
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No hay solicitud activa/);
    });

    it('returns sanitized error when update fails', async () => {
        nextUpdateReturningResult = {
            data: null,
            error: { code: 'X', message: 'db down' },
        };
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No se pudo cancelar/);
        expect(loggerErrorMock).toHaveBeenCalled();
    });
});
