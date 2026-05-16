/**
 * Optional Upstash Redis cache for insights. Reads/writes fail silently so
 * the user-facing flow is never broken by cache issues.
 */

import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';
import type { InsightsResult } from './types';

const CACHE_VERSION = 'v1';
/** 6 hours — insights aren't time-sensitive; 4 recomputes per day is plenty. */
const TTL_SECONDS = 6 * 60 * 60;

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
    if (redisSingleton !== undefined) return redisSingleton;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        redisSingleton = null;
        return null;
    }
    try {
        redisSingleton = new Redis({ url, token });
    } catch (err) {
        logger.warn({ err }, '[insights:cache] failed to init Redis');
        redisSingleton = null;
    }
    return redisSingleton;
}

export function insightsCacheKey(userId: string): string {
    return `insights:${CACHE_VERSION}:${userId}`;
}

/**
 * Returns the cached InsightsResult or null on miss / cache disabled / error.
 */
export async function readInsightsCache(userId: string): Promise<InsightsResult | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
        const cached = await redis.get<InsightsResult>(insightsCacheKey(userId));
        return cached ?? null;
    } catch (err) {
        logger.warn({ err }, '[insights:cache] read failed');
        return null;
    }
}

export async function writeInsightsCache(
    userId: string,
    result: InsightsResult,
): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
        await redis.set(insightsCacheKey(userId), result, { ex: TTL_SECONDS });
    } catch (err) {
        logger.warn({ err }, '[insights:cache] write failed');
    }
}

/**
 * Invalidate insights for a user — call from server actions that mutate
 * debts/payments. Silent on failure.
 */
export async function invalidateInsightsCache(userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
        await redis.del(insightsCacheKey(userId));
    } catch (err) {
        logger.warn({ err }, '[insights:cache] invalidate failed');
    }
}
