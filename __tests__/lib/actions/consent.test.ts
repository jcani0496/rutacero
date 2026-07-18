import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    insertMock,
    fromMock,
    headersGetMock,
    loggerErrorMock,
    loggerWarnMock,
    getUserMock,
} = vi.hoisted(() => {
    const insertMock = vi.fn();
    return {
        insertMock,
        fromMock: vi.fn(() => ({ insert: insertMock })),
        headersGetMock: vi.fn(),
        loggerErrorMock: vi.fn(),
        loggerWarnMock: vi.fn(),
        getUserMock: vi.fn(),
    };
});

vi.mock('next/headers', () => ({
    headers: async () => ({
        get: headersGetMock,
    }),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: loggerWarnMock,
        error: loggerErrorMock,
    },
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: () => ({
        from: fromMock,
    }),
    createClient: async () => ({
        auth: { getUser: getUserMock },
    }),
}));

import { recordSignupConsent } from '@/lib/actions/consent';
import {
    TOS_VERSION,
    PRIVACY_VERSION,
    FINANCIAL_DISCLAIMER_VERSION,
} from '@/lib/legal/versions';

describe('recordSignupConsent', () => {
    beforeEach(() => {
        insertMock.mockReset();
        fromMock.mockClear();
        headersGetMock.mockReset();
        loggerErrorMock.mockReset();
        loggerWarnMock.mockReset();
        getUserMock.mockReset();
        headersGetMock.mockReturnValue(null);
        insertMock.mockResolvedValue({ error: null });
        // Default: an authenticated session exists.
        getUserMock.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
        });
    });

    it('derives the user id from the session and inserts three rows', async () => {
        await recordSignupConsent();

        expect(fromMock).toHaveBeenCalledTimes(3);
        expect(fromMock).toHaveBeenCalledWith('user_consent_log');
        expect(insertMock).toHaveBeenCalledTimes(3);

        const inserted = insertMock.mock.calls.map((c) => c[0]);
        const byDoc = Object.fromEntries(inserted.map((row) => [row.document_type, row]));

        expect(byDoc.tos).toMatchObject({
            user_id: 'user-123',
            document_type: 'tos',
            version: TOS_VERSION,
        });
        expect(byDoc.privacy).toMatchObject({
            user_id: 'user-123',
            document_type: 'privacy',
            version: PRIVACY_VERSION,
        });
        expect(byDoc.financial_disclaimer).toMatchObject({
            user_id: 'user-123',
            document_type: 'financial_disclaimer',
            version: FINANCIAL_DISCLAIMER_VERSION,
        });
    });

    // Regression (audit 2026-07, P0): the action must be a NO-OP without an
    // authenticated session. Previously any visitor could forge consent rows
    // for any user by passing an arbitrary userId.
    it('inserts NOTHING when there is no authenticated session', async () => {
        getUserMock.mockResolvedValue({ data: { user: null }, error: null });

        await recordSignupConsent();

        expect(insertMock).not.toHaveBeenCalled();
        expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    });

    it('inserts NOTHING when auth lookup errors', async () => {
        getUserMock.mockResolvedValue({
            data: { user: null },
            error: { message: 'jwt expired' },
        });

        await recordSignupConsent();

        expect(insertMock).not.toHaveBeenCalled();
        expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    });

    it('captures the first IP from x-forwarded-for and the user-agent', async () => {
        headersGetMock.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return '203.0.113.5, 10.0.0.1';
            if (name === 'user-agent') return 'Mozilla/Test';
            return null;
        });

        await recordSignupConsent();

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-123',
                ip_address: '203.0.113.5',
                user_agent: 'Mozilla/Test',
            }),
        );
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
        headersGetMock.mockImplementation((name: string) => {
            if (name === 'x-real-ip') return '198.51.100.7';
            return null;
        });

        await recordSignupConsent();

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({ ip_address: '198.51.100.7', user_agent: null }),
        );
    });

    it('does not throw if one insert fails', async () => {
        insertMock
            .mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({ error: { message: 'boom' } })
            .mockResolvedValueOnce({ error: null });

        await expect(recordSignupConsent()).resolves.toBeUndefined();
        expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    });

    it('does not throw if an insert rejects', async () => {
        insertMock
            .mockResolvedValueOnce({ error: null })
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce({ error: null });

        await expect(recordSignupConsent()).resolves.toBeUndefined();
    });
});
