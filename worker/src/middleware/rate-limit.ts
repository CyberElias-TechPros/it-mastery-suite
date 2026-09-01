import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../lib/errors';
import { log } from '../lib/logger';
import type { AppEnv } from '../types';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Identifier prefix, e.g. "login". */
  name: string;
  limit: number;
  windowSeconds: number;
  /** Derive the bucket key. Defaults to the client IP. */
  key?: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string;
}

/**
 * Fixed-window rate limiter backed by Workers KV.
 *
 * KV is eventually consistent, which is acceptable here: the goal is to blunt
 * credential stuffing / scraping, not to enforce exact quotas. Failures in KV
 * never block a request (fail-open) but are logged.
 */
export const rateLimit = (options: RateLimitOptions): MiddlewareHandler<AppEnv> => {
  const { name, limit, windowSeconds } = options;
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    const key = `rl:${name}:${options.key ? options.key(c) : ip}`;
    const nowMs = Date.now();

    let bucket: Bucket | null = null;
    try {
      bucket = await c.env.RATE_LIMIT.get<Bucket>(key, 'json');
    } catch (error) {
      log('warn', 'rate_limit_read_failed', { key: name, error: String(error) });
    }

    const fresh = !bucket || bucket.resetAt <= nowMs;
    const next_: Bucket = fresh
      ? { count: 1, resetAt: nowMs + windowSeconds * 1000 }
      : { count: bucket!.count + 1, resetAt: bucket!.resetAt };

    const remaining = Math.max(0, limit - next_.count);
    c.header('x-ratelimit-limit', String(limit));
    c.header('x-ratelimit-remaining', String(remaining));
    c.header('x-ratelimit-reset', String(Math.ceil(next_.resetAt / 1000)));

    if (next_.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((next_.resetAt - nowMs) / 1000));
      c.header('retry-after', String(retryAfter));
      throw ApiError.rateLimited(`Too many requests. Try again in ${retryAfter} seconds.`);
    }

    try {
      const ttl = Math.max(60, Math.ceil((next_.resetAt - nowMs) / 1000));
      await c.env.RATE_LIMIT.put(key, JSON.stringify(next_), { expirationTtl: ttl });
    } catch (error) {
      log('warn', 'rate_limit_write_failed', { key: name, error: String(error) });
    }

    await next();
  };
};
