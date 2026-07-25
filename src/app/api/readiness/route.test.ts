import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDb } = vi.hoisted(() => ({
    getDb: vi.fn(),
}));

vi.mock('@/db/client', () => ({
    getDb,
}));

import { GET } from '@/app/api/readiness/route';

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/readiness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...ORIGINAL_ENV };
        process.env.DATABASE_URL = 'postgresql://rutacero:rutacero@localhost:54329/rutacero';
        process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-32chars-min';
        process.env.ADMIN_JWT_SECRET = 'secret';
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('hides missing env names in production responses', async () => {
        process.env = {
            ...process.env,
            NODE_ENV: 'production',
        };
        delete process.env.ADMIN_JWT_SECRET;

        const response = await GET();

        expect(response.status).toBe(503);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toEqual({
            status: 'not_ready',
            reason: 'missing_env',
        });
    });

    it('hides database error details in production responses', async () => {
        process.env = {
            ...process.env,
            NODE_ENV: 'production',
        };
        getDb.mockReturnValue({
            execute: vi.fn(async () => {
                throw new Error('password authentication failed for user postgres');
            }),
        });

        const response = await GET();

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            status: 'not_ready',
            reason: 'db_unreachable',
        });
    });

    it('keeps diagnostic details outside production', async () => {
        process.env = {
            ...process.env,
            NODE_ENV: 'test',
        };
        getDb.mockReturnValue({
            execute: vi.fn(async () => {
                throw new Error('connection timeout');
            }),
        });

        const response = await GET();

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
            status: 'not_ready',
            reason: 'db_unreachable',
            details: 'connection timeout',
        });
    });
});
