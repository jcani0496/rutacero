/**
 * Next.js caching utilities
 * PERF-003: Centralized caching layer using Next.js unstable_cache
 *
 * Usage:
 * ```typescript
 * import { createCachedFunction } from '@/lib/cache/next-cache';
 *
 * export const getCachedDebts = createCachedFunction(
 *   getDebts,
 *   'user-debts',
 *   300, // 5 minutes
 *   ['debts']
 * );
 * ```
 */

import { unstable_cache, revalidateTag } from 'next/cache';

/**
 * Creates a cached version of an async function
 *
 * @param fn - The async function to cache
 * @param keyPrefix - Unique identifier for this cache entry
 * @param revalidateSeconds - How long to cache (in seconds)
 * @param tags - Cache tags for invalidation
 * @returns Cached version of the function
 */
export function createCachedFunction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyPrefix: string,
    revalidateSeconds: number,
    tags: string[]
): (...args: TArgs) => Promise<TResult> {
    return unstable_cache(fn, [keyPrefix], {
        revalidate: revalidateSeconds,
        tags,
    }) as unknown as (...args: TArgs) => Promise<TResult>;
}

/**
 * Invalidates all cache entries with a specific tag
 *
 * @param tag - The tag to invalidate
 */
export async function invalidateCacheByTag(tag: string): Promise<void> {
    revalidateTag(tag, 'max');
}

/**
 * Invalidates multiple cache tags at once
 *
 * @param tags - Array of tags to invalidate
 */
export async function invalidateMultipleTags(tags: string[]): Promise<void> {
    tags.forEach(tag => revalidateTag(tag, 'max'));
}

/**
 * Common cache tags used across the application
 */
export const CACHE_TAGS = {
    // User data
    USER_DEBTS: 'user-debts',
    USER_PAYMENTS: 'user-payments',
    USER_PLANS: 'user-plans',
    USER_PROFILE: 'user-profile',
    USER_FINANCES: 'user-finances',

    // Admin
    ADMIN_ANALYTICS: 'admin-analytics',
    ADMIN_USERS: 'admin-users',
    ADMIN_OVERVIEW: 'admin-overview',

    // Engine calculations
    ENGINE_PROJECTION: 'engine-projection',
    ENGINE_FORECAST: 'engine-forecast',
    ENGINE_RISK: 'engine-risk',
} as const;

/**
 * Common cache durations in seconds
 */
export const CACHE_DURATION = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 900, // 15 minutes
    VERY_LONG: 3600, // 1 hour
    DAY: 86400, // 24 hours
} as const;

/**
 * Helper to create user-specific cache keys
 *
 * @param userId - User ID
 * @param resource - Resource type
 * @returns Formatted cache key
 */
export function userCacheKey(userId: string, resource: string): string {
    return `user:${userId}:${resource}`;
}

/**
 * Helper to create admin-specific cache keys
 *
 * @param resource - Resource type
 * @returns Formatted cache key
 */
export function adminCacheKey(resource: string): string {
    return `admin:${resource}`;
}
