import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

/**
 * Assigns / propagates a request id so that client errors, worker logs and
 * audit rows can be correlated.
 */
export const requestId = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const incoming = c.req.header('cf-ray') ?? c.req.header('x-request-id');
  const id = incoming && /^[\w-]{6,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  c.set('requestId', id);
  await next();
  c.header('x-request-id', id);
};
