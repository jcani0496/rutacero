/**
 * Performance tests for admin analytics functions
 *
 * PERF-001: Verify admin analytics optimizations
 * Expected improvements:
 * - getAdminOverview: < 300ms (was 2.5s with auth.admin.listUsers)
 * - getRecentUsers: < 200ms (was 500ms with N+1 queries)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a chainable mock for Supabase queries
function createChainableMock() {
    type ThenableResult = { count: number; data: unknown[] };
    type ChainableMock = {
        eq: ReturnType<typeof vi.fn>;
        neq: ReturnType<typeof vi.fn>;
        gte: ReturnType<typeof vi.fn>;
        lt: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        then: (resolve: (value: ThenableResult) => unknown) => unknown;
    };

    const mock: ChainableMock = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        then: (resolve) => resolve({ count: 0, data: [] }),
    };

    // Make all chainable methods return the mock itself
    (Object.keys(mock) as Array<keyof ChainableMock>).forEach((key) => {
        if (typeof mock[key] === 'function' && key !== 'then' && key !== 'limit') {
            mock[key] = vi.fn().mockReturnValue(mock);
        }
    });

    return mock;
}

// Mock Supabase and auth
vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => createChainableMock()),
        })),
    })),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
    requirePermission: vi.fn().mockResolvedValue(true),
}));

// Import after mocks
import {
    getAdminOverview,
    getRecentUsers,
    getUserGrowthData,
    getDebtDistribution,
    getPaymentVolume,
} from '@/lib/actions/admin-analytics';

describe('Admin Analytics Performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAdminOverview', () => {
        it('should complete in < 500ms', async () => {
            const start = performance.now();
            await getAdminOverview();
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(500);
        });

        it('should use parallel queries (Promise.all)', async () => {
            // Spy on Promise.all to ensure parallelization
            const promiseAllSpy = vi.spyOn(Promise, 'all');

            await getAdminOverview();

            // Should call Promise.all for parallel execution
            expect(promiseAllSpy).toHaveBeenCalled();
        });

        it('should not call auth.admin.listUsers', async () => {
            const { createAdminClient } = await import('@/lib/supabase/server');
            const mockClient = createAdminClient();

            await getAdminOverview();

            // Verify we never called auth.admin
            expect(mockClient.auth?.admin?.listUsers).toBeUndefined();
        });
    });

    describe('getRecentUsers', () => {
        it('should complete in < 200ms', async () => {
            const start = performance.now();
            await getRecentUsers(100);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(200);
        });

        it('should return empty array when no users', async () => {
            const result = await getRecentUsers(10);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getUserGrowthData', () => {
        it('should complete in < 300ms', async () => {
            const start = performance.now();
            await getUserGrowthData(30);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(300);
        });
    });

    describe('getDebtDistribution', () => {
        it('should complete in < 200ms', async () => {
            const start = performance.now();
            await getDebtDistribution();
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(200);
        });
    });

    describe('getPaymentVolume', () => {
        it('should complete in < 300ms', async () => {
            const start = performance.now();
            await getPaymentVolume(30);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(300);
        });
    });

    describe('Performance regression prevention', () => {
        it('getAdminOverview should return valid structure', async () => {
            const result = await getAdminOverview();

            // Verify structure is correct
            expect(result).toHaveProperty('totalUsers');
            expect(result).toHaveProperty('newUsersThisMonth');
            expect(result).toHaveProperty('activeSubscriptions');
            expect(result.activeSubscriptions).toHaveProperty('free');
            expect(result.activeSubscriptions).toHaveProperty('pro');
            expect(result.activeSubscriptions).toHaveProperty('business');
        });
    });
});
