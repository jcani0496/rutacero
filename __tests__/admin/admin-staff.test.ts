import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requirePermission, logAdminAction, getDb } = vi.hoisted(() => ({
    requirePermission: vi.fn(),
    logAdminAction: vi.fn(),
    getDb: vi.fn(),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
    requirePermission,
    logAdminAction,
}));

vi.mock('@/db/client', () => ({
    getDb,
    schema: {
        adminUsers: {
            id: 'id',
            email: 'email',
            displayName: 'display_name',
            role: 'role',
            isActive: 'is_active',
            lastLoginAt: 'last_login_at',
            createdAt: 'created_at',
        },
    },
}));

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getAdminStaff, updateAdminStaff } from '@/lib/actions/admin-staff';

function mockSelect(rows: unknown[] | Error) {
    getDb.mockReturnValue({
        select: () => ({
            from: () => ({
                orderBy: () => (rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows)),
            }),
        }),
    });
}

const STAFF_ROW = {
    id: 'admin-1',
    email: 'ops@rutacero.com',
    displayName: 'Ops Lead',
    role: 'ADMIN',
    isActive: true,
    lastLoginAt: new Date('2026-07-01T10:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('getAdminStaff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requirePermission.mockResolvedValue({ adminId: 'admin-1', role: 'SUPER_ADMIN' });
    });

    it('maps admin_users rows to the staff shape', async () => {
        mockSelect([STAFF_ROW]);

        const staff = await getAdminStaff();

        expect(requirePermission).toHaveBeenCalledWith('staff:read');
        expect(staff).toEqual([
            {
                id: 'admin-1',
                email: 'ops@rutacero.com',
                display_name: 'Ops Lead',
                role: 'ADMIN',
                is_active: true,
                last_login_at: '2026-07-01T10:00:00.000Z',
                created_at: '2026-01-01T00:00:00.000Z',
            },
        ]);
    });

    it('filters by email or display name when a search term is given', async () => {
        mockSelect([STAFF_ROW, { ...STAFF_ROW, id: 'admin-2', email: 'legal@rutacero.com', displayName: null }]);

        const staff = await getAdminStaff('legal');

        expect(staff.map((member) => member.id)).toEqual(['admin-2']);
    });

    it('returns an empty list instead of throwing when the query fails', async () => {
        mockSelect(new Error('relation "admin_users" does not exist'));

        await expect(getAdminStaff()).resolves.toEqual([]);
    });
});

describe('updateAdminStaff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requirePermission.mockResolvedValue({ adminId: 'admin-1', role: 'ADMIN' });
    });

    it('refuses to change your own role before touching the database', async () => {
        const result = await updateAdminStaff({ id: 'admin-1', role: 'SUPPORT' });

        expect(result).toEqual({ success: false, error: 'No puedes cambiar tu propio rol.' });
        expect(getDb).not.toHaveBeenCalled();
    });

    it('refuses to deactivate your own user before touching the database', async () => {
        const result = await updateAdminStaff({ id: 'admin-1', isActive: false });

        expect(result).toEqual({ success: false, error: 'No puedes desactivar tu propio usuario.' });
        expect(getDb).not.toHaveBeenCalled();
    });

    it('rejects an update with no fields', async () => {
        const result = await updateAdminStaff({ id: 'admin-2' });

        expect(result).toEqual({ success: false, error: 'Sin cambios para aplicar.' });
        expect(getDb).not.toHaveBeenCalled();
    });
});
