import { describe, it, expect, vi, beforeEach } from 'vitest';

const initMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
    init: initMock,
}));

describe('initSentry', () => {
    beforeEach(() => {
        initMock.mockClear();
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    });

    it('does not call Sentry.init when DSN is missing', async () => {
        const { initSentry } = await import('@/lib/observability/sentry-init');
        initSentry({ runtime: 'server' });
        expect(initMock).not.toHaveBeenCalled();
    });

    it('calls Sentry.init when DSN is present', async () => {
        process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example@sentry.io/1';
        vi.resetModules();
        const { initSentry } = await import('@/lib/observability/sentry-init');
        initSentry({ runtime: 'server' });
        expect(initMock).toHaveBeenCalledTimes(1);
        expect(initMock.mock.calls[0][0]).toMatchObject({
            dsn: 'https://example@sentry.io/1',
        });
    });
});
