import type { AppContext } from '../types';

type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

/**
 * Structured JSON logging. Cloudflare's observability pipeline indexes these
 * fields, which makes `requestId` a usable correlation key in production.
 * Secrets, tokens and passwords must never be passed in.
 */
export function log(level: Level, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, message, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function requestLogger(c: AppContext, fields: LogFields = {}): LogFields {
  return {
    requestId: c.get('requestId'),
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    userId: c.get('user')?.id,
    ...fields,
  };
}
