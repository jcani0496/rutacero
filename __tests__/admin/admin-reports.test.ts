import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requirePermission, getDb } = vi.hoisted(() => ({
    requirePermission: vi.fn(),
    getDb: vi.fn(),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
    requirePermission,
}));

// Keep the real Drizzle schema: the custom-report allow-list resolves UI column
// names against real column metadata, so stubbing the tables would hide bugs.
vi.mock('@/db/client', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/db/client')>()),
    getDb,
}));

import { generateCustomReport } from '@/lib/actions/admin-reports';

describe('generateCustomReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requirePermission.mockResolvedValue({ adminId: 'admin-1', role: 'SUPER_ADMIN' });
    });

    it('rejects tables outside the allow-list', async () => {
        await expect(
            generateCustomReport({ table: 'admin_users', columns: ['email'] }),
        ).rejects.toThrow('Invalid table name');

        expect(getDb).not.toHaveBeenCalled();
    });

    it('rejects columns that are not exposed for the table', async () => {
        await expect(
            generateCustomReport({ table: 'debts', columns: ['password_hash'] }),
        ).rejects.toThrow('No valid columns selected');

        expect(getDb).not.toHaveBeenCalled();
    });

    it('selects only the requested columns and formats the rows', async () => {
        let capturedSelection: Record<string, unknown> = {};
        let capturedLimit = 0;

        getDb.mockReturnValue({
            select: (selection: Record<string, unknown>) => {
                capturedSelection = selection;
                return {
                    from: () => ({
                        where: () => ({
                            limit: (value: number) => {
                                capturedLimit = value;
                                return Promise.resolve([
                                    { creditor: 'Visa G&T', balance: '18500.00', status: 'ACTIVE' },
                                ]);
                            },
                        }),
                    }),
                };
            },
        });

        const result = await generateCustomReport({
            table: 'debts',
            columns: ['creditor', 'balance', 'status'],
            limit: 50,
        });

        expect(Object.keys(capturedSelection)).toEqual(['creditor', 'balance', 'status']);
        expect(capturedLimit).toBe(50);
        expect(result.headers).toEqual(['Acreedor', 'Saldo', 'Estado']);
        expect(result.rows).toEqual([['Visa G&T', '18500.00', 'ACTIVE']]);
    });
});
