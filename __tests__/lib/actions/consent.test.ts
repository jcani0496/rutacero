import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    insertMock,
    fromMock,
    headersGetMock,
    loggerErrorMock,
} = vi.hoisted(() => {
    const insertMock = vi.fn();
    return {
        insertMock,
        fromMock: vi.fn(() => ({ insert: insertMock })),
        headersGetMock: vi.fn(),
        loggerErrorMock: vi.fn(),
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
        warn: vi.fn(),
        error: loggerErrorMock,
    },
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: () => ({
        from: fromMock,
    }),
}));

import { recordSignupConsent, recordUserConsent } from '@/lib/actions/consent';
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
        // Default: no headers present
        headersGetMock.mockReturnValue(null);
        insertMock.mockResolvedValue({ error: null });
    });

    it('inserts three rows (tos, privacy, financial_disclaimer) with correct versions', async () => {
        await recordSignupConsent('user-123');

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

    it('does not throw if one insert fails', async () => {
        insertMock
            .mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({ error: { message: 'boom' } })
            .mockResolvedValueOnce({ error: null });

        await expect(recordSignupConsent('user-456')).resolves.toBeUndefined();
        expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    });

    it('does not throw if an insert rejects', async () => {
        insertMock
            .mockResolvedValueOnce({ error: null })
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce({ error: null });

        await expect(recordSignupConsent('user-789')).resolves.toBeUndefined();
    });
});

describe('recordUserConsent', () => {
    beforeEach(() => {
        insertMock.mockReset();
        fromMock.mockClear();
        headersGetMock.mockReset();
        loggerErrorMock.mockReset();
        insertMock.mockResolvedValue({ error: null });
    });

    it('captures the first IP from x-forwarded-for and the user-agent', async () => {
        headersGetMock.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return '203.0.113.5, 10.0.0.1';
            if (name === 'user-agent') return 'Mozilla/Test';
            return null;
        });

        await recordUserConsent({
            userId: 'user-xyz',
            documentType: 'cookies',
            version: '2026-05-16',
        });

        expect(insertMock).toHaveBeenCalledWith({
            user_id: 'user-xyz',
            document_type: 'cookies',
            version: '2026-05-16',
            ip_address: '203.0.113.5',
            user_agent: 'Mozilla/Test',
        });
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
        headersGetMock.mockImplementation((name: string) => {
            if (name === 'x-real-ip') return '198.51.100.7';
            return null;
        });

        await recordUserConsent({
            userId: 'user-x',
            documentType: 'tos',
            version: '1',
        });

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({ ip_address: '198.51.100.7', user_agent: null }),
        );
    });

    it('logs but does not throw when insert returns an error', async () => {
        insertMock.mockResolvedValueOnce({ error: { message: 'rls' } });
        await expect(
            recordUserConsent({ userId: 'u', documentType: 'tos', version: '1' }),
        ).resolves.toBeUndefined();
        expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    });
});
