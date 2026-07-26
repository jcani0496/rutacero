import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    requireAdminAuth,
    refreshAdminSession,
    logAdminAction,
    getDb,
} = vi.hoisted(() => ({
    requireAdminAuth: vi.fn(),
    refreshAdminSession: vi.fn(),
    logAdminAction: vi.fn(),
    getDb: vi.fn(),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
    requireAdminAuth,
    refreshAdminSession,
    logAdminAction,
}));

vi.mock('@/db/client', () => ({
    getDb,
    schema: {
        adminUsers: {
            id: 'id',
            email: 'email',
            displayName: 'display_name',
            updatedAt: 'updated_at',
        },
    },
}));

import { updateAdminProfile } from '@/lib/actions/admin-profile';

describe('updateAdminProfile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAdminAuth.mockResolvedValue({
            adminId: 'admin-1',
            email: 'admin@rutacero.gt',
            role: 'SUPER_ADMIN',
            displayName: 'Admin',
        });
        refreshAdminSession.mockResolvedValue(undefined);
        logAdminAction.mockResolvedValue(undefined);
    });

    it('rejects invalid email', async () => {
        const result = await updateAdminProfile({ displayName: 'Admin', email: 'not-an-email' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Email inválido/);
    });

    it('updates profile and refreshes session cookie', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => ({
                        limit: () => Promise.resolve([]),
                    }),
                }),
            }),
            update: () => ({
                set: () => ({
                    where: () => Promise.resolve(undefined),
                }),
            }),
        });

        const result = await updateAdminProfile({
            displayName: 'Juan Admin',
            email: 'juan@rutacero.gt',
        });

        expect(result.success).toBe(true);
        expect(result.session).toEqual({
            adminId: 'admin-1',
            email: 'juan@rutacero.gt',
            role: 'SUPER_ADMIN',
            displayName: 'Juan Admin',
        });
        expect(refreshAdminSession).toHaveBeenCalledWith(result.session);
        expect(logAdminAction).toHaveBeenCalledWith(
            'admin-1',
            'UPDATE_ADMIN_PROFILE',
            'admin_users',
            'admin-1',
            expect.objectContaining({ email: 'juan@rutacero.gt' }),
        );
    });
});
