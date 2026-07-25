import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    updateIdentityUserMock,
    getAppUserMock,
    revalidatePathMock,
    loggerErrorMock,
} = vi.hoisted(() => ({
    updateIdentityUserMock: vi.fn(),
    getAppUserMock: vi.fn(),
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

vi.mock('@/lib/auth/session', () => ({
    getAppUser: getAppUserMock,
}));

vi.mock('@/lib/auth/identity', () => ({
    updateIdentityUser: updateIdentityUserMock,
}));

import { updateDisplayName } from '@/lib/actions/profile';

describe('updateDisplayName', () => {
    beforeEach(() => {
        updateIdentityUserMock.mockReset();
        getAppUserMock.mockReset();
        revalidatePathMock.mockReset();
        loggerErrorMock.mockReset();

        getAppUserMock.mockResolvedValue({
            id: 'user-1',
            email: 'u@example.com',
            name: null,
        });
        updateIdentityUserMock.mockResolvedValue(undefined);
    });

    it('rejects names shorter than 2 characters', async () => {
        const result = await updateDisplayName({ fullName: 'a' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/corto/i);
        expect(updateIdentityUserMock).not.toHaveBeenCalled();
    });

    it('rejects names that are only whitespace', async () => {
        const result = await updateDisplayName({ fullName: '   ' });
        expect(result.success).toBe(false);
        expect(updateIdentityUserMock).not.toHaveBeenCalled();
    });

    it('rejects names longer than 80 characters', async () => {
        const longName = 'a'.repeat(81);
        const result = await updateDisplayName({ fullName: longName });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/largo/i);
        expect(updateIdentityUserMock).not.toHaveBeenCalled();
    });

    it('trims whitespace before saving and writes full_name + name', async () => {
        const result = await updateDisplayName({ fullName: '   María José   ' });
        expect(result.success).toBe(true);
        expect(updateIdentityUserMock).toHaveBeenCalledWith('user-1', {
            name: 'María José',
        });
    });

    it('returns success and revalidates paths on valid input', async () => {
        const result = await updateDisplayName({ fullName: 'Ana' });
        expect(result.success).toBe(true);
        expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
        expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard');
        expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    });

    it('returns error when the user is not authenticated', async () => {
        getAppUserMock.mockResolvedValue(null);
        const result = await updateDisplayName({ fullName: 'Ana' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/autenticado/i);
        expect(updateIdentityUserMock).not.toHaveBeenCalled();
    });

    it('returns error when identity update fails', async () => {
        updateIdentityUserMock.mockRejectedValue(new Error('boom'));
        const result = await updateDisplayName({ fullName: 'Ana' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/guardar/i);
    });

    it('catches unexpected errors and returns a structured failure', async () => {
        getAppUserMock.mockRejectedValue(new Error('unexpected'));
        const result = await updateDisplayName({ fullName: 'Ana' });
        expect(result.success).toBe(false);
        expect(loggerErrorMock).toHaveBeenCalled();
    });
});
