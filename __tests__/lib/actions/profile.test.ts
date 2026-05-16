import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    updateUserMock,
    getUserMock,
    revalidatePathMock,
    loggerErrorMock,
} = vi.hoisted(() => ({
    updateUserMock: vi.fn(),
    getUserMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    loggerErrorMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: loggerErrorMock,
    },
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: getUserMock,
            updateUser: updateUserMock,
        },
    }),
}));

import { updateDisplayName } from '@/lib/actions/profile';

describe('updateDisplayName', () => {
    beforeEach(() => {
        updateUserMock.mockReset();
        getUserMock.mockReset();
        revalidatePathMock.mockReset();
        loggerErrorMock.mockReset();

        getUserMock.mockResolvedValue({
            data: { user: { id: 'user-1', email: 'u@example.com' } },
            error: null,
        });
        updateUserMock.mockResolvedValue({ data: { user: null }, error: null });
    });

    it('rejects names shorter than 2 characters', async () => {
        const result = await updateDisplayName({ fullName: 'a' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/corto/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('rejects names that are only whitespace', async () => {
        const result = await updateDisplayName({ fullName: '   ' });
        expect(result.success).toBe(false);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('rejects names longer than 80 characters', async () => {
        const longName = 'a'.repeat(81);
        const result = await updateDisplayName({ fullName: longName });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/largo/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('trims whitespace before saving and writes full_name + name', async () => {
        const result = await updateDisplayName({ fullName: '   María José   ' });
        expect(result.success).toBe(true);
        expect(updateUserMock).toHaveBeenCalledWith({
            data: { full_name: 'María José', name: 'María José' },
        });
    });

    it('returns success and revalidates paths on valid input', async () => {
        const result = await updateDisplayName({ fullName: 'Ana López' });
        expect(result.success).toBe(true);
        expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
        expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard');
        expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    });

    it('returns error when supabase.auth.updateUser fails', async () => {
        updateUserMock.mockResolvedValueOnce({
            data: { user: null },
            error: new Error('boom'),
        });
        const result = await updateDisplayName({ fullName: 'Ana López' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no se pudo guardar/i);
        expect(loggerErrorMock).toHaveBeenCalled();
        expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it('returns error when the user is not authenticated', async () => {
        getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
        const result = await updateDisplayName({ fullName: 'Ana López' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no autenticado/i);
        expect(updateUserMock).not.toHaveBeenCalled();
    });
});
