import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminClient } = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient,
}));

import { GET } from '@/app/api/readiness/route';

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/readiness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...ORIGINAL_ENV };
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
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
        createAdminClient.mockReturnValue({
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    limit: vi.fn(async () => ({
                        error: {
                            message: 'password authentication failed for user postgres',
                        },
                    })),
                })),
            })),
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
        createAdminClient.mockReturnValue({
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    limit: vi.fn(async () => ({
                        error: {
                            message: 'connection timeout',
                        },
                    })),
                })),
            })),
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
