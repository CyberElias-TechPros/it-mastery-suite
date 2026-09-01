import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ApiError } from '../lib/errors';
import { log } from '../lib/logger';
import type { AppEnv } from '../types';

/**
 * Single funnel for every error leaving the API. Clients always receive a
 * structured payload; stack traces and driver messages never leave the worker.
 */
export const onError: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId');
  const path = new URL(c.req.url).pathname;

  if (err instanceof ApiError) {
    if (err.status >= 500) {
      log('error', 'request_failed', { requestId, path, code: err.code, message: err.message });
    } else {
      log('warn', 'request_rejected', { requestId, path, code: err.code, message: err.message });
    }
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details ?? undefined, requestId } },
      err.status as 400,
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: err.message || 'Request could not be processed', requestId } },
      err.status,
    );
  }

  const message = err instanceof Error ? err.message : String(err);

  // Translate the few D1 constraint failures that are meaningful to a client.
  if (/UNIQUE constraint failed/i.test(message)) {
    return c.json(
      { error: { code: 'CONFLICT', message: 'A record with these details already exists', requestId } },
      409,
    );
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'A referenced record does not exist', requestId } },
      400,
    );
  }
  if (/CHECK constraint failed/i.test(message)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'A submitted value is not allowed', requestId } }, 422);
  }

  log('error', 'unhandled_exception', {
    requestId,
    path,
    message,
    stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
  });

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Quote the request id when contacting support.',
        requestId,
      },
    },
    500,
  );
};

export const notFound: NotFoundHandler<AppEnv> = (c) =>
  c.json(
    { error: { code: 'NOT_FOUND', message: `No route matches ${c.req.method} ${new URL(c.req.url).pathname}`, requestId: c.get('requestId') } },
    404,
  );
