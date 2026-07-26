import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    valuesMock,
    insertMock,
    getDbMock,
    headersGetMock,
    loggerErrorMock,
    loggerWarnMock,
    getAppUserMock,
} = vi.hoisted(() => {
    const valuesMock = vi.fn();
    const insertMock = vi.fn(() => ({ values: valuesMock }));
    return {
        valuesMock,
        insertMock,
        getDbMock: vi.fn(() => ({ insert: insertMock })),
        headersGetMock: vi.fn(),
        loggerErrorMock: vi.fn(),
        loggerWarnMock: vi.fn(),
        getAppUserMock: vi.fn(),
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

vi.mock('@/db/client', () => ({
    getDb: getDbMock,
    schema: {},
}));

vi.mock('@/db/schema', () => ({
    userConsentLog: 'user_consent_log',
}));

vi.mock('@/lib/auth/session', () => ({
    getAppUser: getAppUserMock,
}));

import { recordSignupConsent } from '@/lib/actions/consent';
import {
    TOS_VERSION,
    PRIVACY_VERSION,
    FINANCIAL_DISCLAIMER_VERSION,
} from '@/lib/legal/versions';

describe('recordSignupConsent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        headersGetMock.mockReturnValue(null);
        valuesMock.mockResolvedValue(undefined);
        // Default: an authenticated session exists.
        getAppUserMock.mockResolvedValue({ id: 'user-123', email: 'user@example.com' });
    });

    it('derives the user id from the session and inserts three rows', async () => {
        await recordSignupConsent();

        expect(insertMock).toHaveBeenCalledTimes(3);
        expect(insertMock).toHaveBeenCalledWith('user_consent_log');
        expect(valuesMock).toHaveBeenCalledTimes(3);

        const inserted = valuesMock.mock.calls.map((c) => c[0]);
        const byDoc = Object.fromEntries(inserted.map((row) => [row.documentType, row]));

        expect(byDoc.tos).toMatchObject({
            userId: 'user-123',
            documentType: 'tos',
            version: TOS_VERSION,
        });
        expect(byDoc.privacy).toMatchObject({
            userId: 'user-123',
            documentType: 'privacy',
            version: PRIVACY_VERSION,
        });
        expect(byDoc.financial_disclaimer).toMatchObject({
            userId: 'user-123',
            documentType: 'financial_disclaimer',
            version: FINANCIAL_DISCLAIMER_VERSION,
        });
    });

    // Regression (audit 2026-07, P0): the action must be a NO-OP without an
    // authenticated session. Previously any visitor could forge consent rows
    // for any user by passing an arbitrary userId.
    it('inserts NOTHING when there is no authenticated session', async () => {
        getAppUserMock.mockResolvedValue(null);

        await recordSignupConsent();

        expect(valuesMock).not.toHaveBeenCalled();
        expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    });

    it('captures the first IP from x-forwarded-for and the user-agent', async () => {
        headersGetMock.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return '203.0.113.5, 10.0.0.1';
            if (name === 'user-agent') return 'Mozilla/Test';
            return null;
        });

        await recordSignupConsent();

        expect(valuesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-123',
                ipAddress: '203.0.113.5',
                userAgent: 'Mozilla/Test',
            }),
        );
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
        headersGetMock.mockImplementation((name: string) => {
            if (name === 'x-real-ip') return '198.51.100.7';
            return null;
        });

        await recordSignupConsent();

        expect(valuesMock).toHaveBeenCalledWith(
            expect.objectContaining({ ipAddress: '198.51.100.7', userAgent: null }),
        );
    });

    it('does not throw if one insert fails', async () => {
        valuesMock
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce(undefined);

        await expect(recordSignupConsent()).resolves.toBeUndefined();
        expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    });

    it('does not throw when every insert rejects', async () => {
        valuesMock.mockRejectedValue(new Error('network'));

        await expect(recordSignupConsent()).resolves.toBeUndefined();
        expect(loggerErrorMock).toHaveBeenCalledTimes(3);
    });
});
