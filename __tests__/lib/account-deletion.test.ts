import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireUserTenantMock = vi.fn();
const sendEmailMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();
const selectMock = vi.fn();

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

vi.mock('@/db/schema', () => ({
    accountDeletionRequests: {
        id: 'id',
        userId: 'user_id',
        canceledAt: 'canceled_at',
        executedAt: 'executed_at',
        executesAt: 'executes_at',
    },
}));

// Inputs the test can override per case.
/** Rows returned by the "is there an active request?" SELECT. */
let nextSelectRows: unknown[] = [];
/** Thrown by the INSERT when set. */
let nextInsertError: Error | null = null;
/** Rows returned by the cancel UPDATE ... RETURNING, or an Error to throw. */
let nextUpdateReturning: { id: string }[] | Error = [{ id: 'req-9' }];

vi.mock('@/db/client', () => ({
    getDb: () => ({
        select: (columns: unknown) => {
            selectMock(columns);
            const chain = {
                from: () => chain,
                where: () => chain,
                limit: () => Promise.resolve(nextSelectRows),
            };
            return chain;
        },
        insert: (table: unknown) => ({
            values: (payload: unknown) => {
                insertValuesMock(table, payload);
                return nextInsertError
                    ? Promise.reject(nextInsertError)
                    : Promise.resolve(undefined);
            },
        }),
        update: (table: unknown) => ({
            set: (payload: unknown) => {
                updateSetMock(table, payload);
                const chain = {
                    where: () => chain,
                    returning: () =>
                        nextUpdateReturning instanceof Error
                            ? Promise.reject(nextUpdateReturning)
                            : Promise.resolve(nextUpdateReturning),
                };
                return chain;
            },
        }),
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    nextSelectRows = [];
    nextInsertError = null;
    nextUpdateReturning = [{ id: 'req-9' }];
    requireUserTenantMock.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        tenantId: 'tenant-1',
        supabase: null,
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

        expect(insertValuesMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                userId: 'user-123',
                reason: 'Just trying it',
                executesAt: expect.any(Date),
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
        nextSelectRows = [
            { id: 'req-1', executesAt: new Date('2026-05-16T13:00:00.000Z') },
        ];
        const { requestAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await requestAccountDeletion({ reason: null });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.executesAt).toBe('2026-05-16T13:00:00.000Z');
        expect(insertValuesMock).not.toHaveBeenCalled();
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('returns sanitized error and logs internally when insert fails', async () => {
        nextInsertError = new Error('duplicate key value violates unique constraint');
        const { requestAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await requestAccountDeletion({ reason: null });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No se pudo registrar la solicitud/);
        expect(loggerErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.stringContaining('duplicate key') }),
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
        expect(insertValuesMock).toHaveBeenCalled();
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.objectContaining({ err: 'Resend down' }),
            expect.stringContaining('email failed')
        );
    });
});

describe('cancelAccountDeletion', () => {
    it('flips canceled_at via atomic UPDATE-with-RETURNING when an active row exists', async () => {
        nextUpdateReturning = [{ id: 'req-9' }];
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(true);
        // A single UPDATE (no separate SELECT) with canceled_at set; row
        // filtering happens in WHERE clauses.
        expect(updateSetMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ canceledAt: expect.any(Date) })
        );
        expect(selectMock).not.toHaveBeenCalled();
    });

    it('returns error when no active row matched (already canceled, executed, or never existed)', async () => {
        nextUpdateReturning = [];
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No hay solicitud activa/);
        // The UPDATE was attempted (it's how we "claim"), but no row matched.
        expect(updateSetMock).toHaveBeenCalled();
    });

    it('returns error when cron has already claimed the row (regression: race window closed)', async () => {
        // Simulating the race: cron set executed_at between user click and
        // server action. The atomic UPDATE filter excludes the row, so nothing
        // is returned. The user's cancel intent is too late.
        nextUpdateReturning = [];
        const { cancelAccountDeletion } = await import(
            '@/lib/actions/account-deletion'
        );

        const result = await cancelAccountDeletion();
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/No hay solicitud activa/);
    });

    it('returns sanitized error when update fails', async () => {
        nextUpdateReturning = new Error('db down');
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
