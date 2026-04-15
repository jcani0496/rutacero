import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/healthz/route';

describe('GET /api/healthz', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-09T05:20:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a minimal public health payload', async () => {
        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(body).toEqual({
            status: 'ok',
            timestamp: '2026-04-09T05:20:00.000Z',
        });
        expect(body).not.toHaveProperty('uptimeSeconds');
        expect(body).not.toHaveProperty('environment');
    });
});
