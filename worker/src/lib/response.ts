import type { AppContext } from '../types';

/**
 * Successful responses always look like:  { data: <payload>, meta?: {...} }
 * Error responses always look like:       { error: { code, message, details?, requestId } }
 */
export function ok<T>(c: AppContext, data: T, meta?: Record<string, unknown>, status = 200) {
  return c.json(meta ? { data, meta } : { data }, status as 200);
}

export function created<T>(c: AppContext, data: T) {
  return c.json({ data }, 201);
}

export function noContent(c: AppContext) {
  return c.body(null, 204);
}

export interface PageMeta {
  [key: string]: unknown;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
