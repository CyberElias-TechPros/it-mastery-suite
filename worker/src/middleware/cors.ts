import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

function allowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Strict, credential-aware CORS. The API is called from a different origin
 * (Vercel) than where it is hosted (Cloudflare), and refresh tokens travel in
 * a cookie, so wildcard origins are not an option.
 *
 * In addition to the explicit allow-list, Vercel preview deployments of the
 * configured project can be permitted with a `https://*.vercel.app` entry.
 */
export const cors = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const origin = c.req.header('origin');
  const list = allowedOrigins(c.env.ALLOWED_ORIGINS);

  const isAllowed =
    !!origin &&
    list.some((allowed) => {
      if (allowed === origin) return true;
      if (allowed.startsWith('https://*.')) {
        const suffix = allowed.slice('https://*'.length); // ".vercel.app"
        return origin.startsWith('https://') && origin.endsWith(suffix);
      }
      return false;
    });

  if (c.req.method === 'OPTIONS') {
    if (!isAllowed) return c.body(null, 403);
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin!,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,x-request-id',
        'access-control-max-age': '86400',
        vary: 'Origin',
      },
    });
  }

  await next();

  if (isAllowed && origin) {
    c.header('access-control-allow-origin', origin);
    c.header('access-control-allow-credentials', 'true');
    c.header('access-control-expose-headers', 'x-request-id');
  }
  c.header('vary', 'Origin');
};

/** Baseline security headers for API responses. */
export const securityHeaders = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'no-referrer');
  c.header('x-frame-options', 'DENY');
  c.header('permissions-policy', 'geolocation=(), microphone=(), camera=()');
  c.header('cross-origin-resource-policy', 'same-site');
  if (!c.res.headers.has('cache-control')) c.header('cache-control', 'no-store');
};
