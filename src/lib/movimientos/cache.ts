/**
 * Optional Upstash Redis cache for Movimientos. Reads/writes fail silently
 * so the user-facing flow is never broken by cache issues.
 *
 * Mirrors `src/lib/insights/cache.ts`. TTL is shorter (1 hour) because users
 * may register income/expense and expect to see it in the chart immediately.
 */

import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';
import type { Granularity, MovimientosResult } from './types';

const CACHE_VERSION = 'v2'; // v2: tenant-scoped keys (audit 2026-07 — cross-workspace leak)
/** 1 hour — short on purpose, see file header. */
const TTL_SECONDS = 60 * 60;

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
        logger.warn({ err }, '[movimientos:cache] failed to init Redis');
        redisSingleton = null;
    }
    return redisSingleton;
}

export function movimientosCacheKey(tenantId: string, userId: string, granularity: Granularity): string {
    return `movimientos:${CACHE_VERSION}:${tenantId}:${userId}:${granularity}`;
}

/**
 * Index-key listing every granularity-specific key for a user. Used so the
 * invalidator can wipe all 7 variants in one Redis call when a mutation
 * happens.
 */
function userIndexKey(tenantId: string, userId: string): string {
    return `movimientos:${CACHE_VERSION}:${tenantId}:${userId}:__index`;
}

export async function readMovimientosCache(
    tenantId: string,
    userId: string,
    granularity: Granularity,
): Promise<MovimientosResult | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
        const cached = await redis.get<MovimientosResult>(
            movimientosCacheKey(tenantId, userId, granularity),
        );
        return cached ?? null;
    } catch (err) {
        logger.warn({ err }, '[movimientos:cache] read failed');
        return null;
    }
}

export async function writeMovimientosCache(
    tenantId: string,
    userId: string,
    granularity: Granularity,
    result: MovimientosResult,
): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
        const key = movimientosCacheKey(tenantId, userId, granularity);
        await redis.set(key, result, { ex: TTL_SECONDS });
        // Track the key in the per-user index so invalidation can drop them all.
        await redis.sadd(userIndexKey(tenantId, userId), key);
        // Expire the index slightly later than the entries so it auto-cleans.
        await redis.expire(userIndexKey(tenantId, userId), TTL_SECONDS * 2);
    } catch (err) {
        logger.warn({ err }, '[movimientos:cache] write failed');
    }
}

/**
 * Invalidate every cached granularity for the user. Call from server actions
 * that mutate income/expense/budget/payment. Silent on failure.
 */
export async function invalidateMovimientosCache(tenantId: string, userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
        const idxKey = userIndexKey(tenantId, userId);
        const members = await redis.smembers(idxKey);
        if (members && members.length > 0) {
            await redis.del(...members);
        }
        await redis.del(idxKey);
    } catch (err) {
        logger.warn({ err }, '[movimientos:cache] invalidate failed');
    }
}
