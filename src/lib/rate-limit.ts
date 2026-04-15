import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate Limiter Configuration
 *
 * Uses Upstash Redis when configured (production), falls back to in-memory
 * storage for development.
 */

// In-memory store for development (not recommended for production with multiple instances)
class InMemoryStore {
  private store = new Map<string, { count: number; reset: number }>();

  async get(key: string) {
    const item = this.store.get(key);
    if (!item) return null;

    // Clean up expired entries
    if (Date.now() > item.reset) {
      this.store.delete(key);
      return null;
    }

    return item.count;
  }

  async set(key: string, count: number, windowMs: number) {
    this.store.set(key, {
      count,
      reset: Date.now() + windowMs,
    });
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const current = await this.get(key);
    const newCount = (current || 0) + 1;
    await this.set(key, newCount, windowMs);
    return newCount;
  }

  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.reset) {
        this.store.delete(key);
      }
    }
  }
}

// Create in-memory store instance
const memoryStore = new InMemoryStore();

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => memoryStore.cleanup(), 5 * 60 * 1000);
}

// Create Redis client if credentials are available
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Rate limiter configurations for different routes
 */
export const rateLimiters = {
  // API routes - moderate limits
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
        analytics: true,
        prefix: 'ratelimit:api',
      })
    : null,

  // Checkout/payment routes - stricter limits to prevent abuse
  checkout: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
        analytics: true,
        prefix: 'ratelimit:checkout',
      })
    : null,

  // Webhook routes - generous limits for legitimate traffic
  webhook: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
        analytics: true,
        prefix: 'ratelimit:webhook',
      })
    : null,

  // Auth routes - moderate limits
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
        analytics: true,
        prefix: 'ratelimit:auth',
      })
    : null,

  // Login endpoints - stricter limits to reduce brute-force attempts
  login: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(8, '10 m'), // 8 attempts per 10 minutes
        analytics: true,
        prefix: 'ratelimit:login',
      })
    : null,
};

/**
 * In-memory rate limiter for development
 */
async function inMemoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; reset: Date }> {
  const count = await memoryStore.increment(identifier, windowMs);
  const success = count <= limit;
  const remaining = Math.max(0, limit - count);

  return {
    success,
    remaining,
    reset: new Date(Date.now() + windowMs),
  };
}

/**
 * Apply rate limiting to a request
 *
 * @param identifier - Unique identifier for the request (usually IP or user ID)
 * @param type - Type of rate limit to apply
 * @returns Rate limit result with success status and metadata
 */
export async function applyRateLimit(
  identifier: string,
  type: keyof typeof rateLimiters = 'api'
) {
  // Use Upstash Redis if available
  const limiter = rateLimiters[type];

  if (limiter) {
    return await limiter.limit(identifier);
  }

  // Fallback to in-memory rate limiting for development
  const limits = {
    api: { limit: 60, window: 60 * 1000 },
    checkout: { limit: 10, window: 60 * 1000 },
    webhook: { limit: 100, window: 60 * 1000 },
    auth: { limit: 30, window: 60 * 1000 },
    login: { limit: 8, window: 10 * 60 * 1000 },
  };

  const config = limits[type];
  const key = `${type}:${identifier}`;

  return await inMemoryRateLimit(key, config.limit, config.window);
}

/**
 * Get client identifier from request (IP address or user ID)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (works with most proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return ip;
}

/**
 * Rate limit response helper
 */
export function rateLimitExceededResponse() {
  return new Response(
    JSON.stringify({
      error: 'Demasiadas solicitudes',
      message: 'Por favor, intenta de nuevo más tarde',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
