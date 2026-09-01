import { z } from 'zod';
import { ApiError } from './errors';
import type { AppContext } from '../types';

/** Parse & validate a JSON request body, raising a consistent 422 on failure. */
export async function parseJson<T extends z.ZodTypeAny>(c: AppContext, schema: T): Promise<z.infer<T>> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw ApiError.unsupportedMedia('Expected Content-Type: application/json');
  }
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw ApiError.badRequest('Request body is not valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw ApiError.validation(flatten(result.error));
  return result.data;
}

/** Parse & validate the query string. */
export function parseQuery<T extends z.ZodTypeAny>(c: AppContext, schema: T): z.infer<T> {
  const result = schema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!result.success) throw ApiError.validation(flatten(result.error));
  return result.data;
}

export function flatten(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                           */
/* -------------------------------------------------------------------------- */

export const uuid = z.string().uuid('Must be a valid identifier');
export const optionalUuid = z
  .union([uuid, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');
export const optionalIsoDate = z
  .union([isoDate, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());

export const shortText = (max = 200) => z.string().trim().min(1, 'Required').max(max, `Must be at most ${max} characters`);
export const optionalText = (max = 2000) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v));

export const money = z.coerce.number().finite().min(0, 'Must be zero or greater').max(1_000_000_000);
export const optionalMoney = z
  .union([z.coerce.number().finite().min(0).max(1_000_000_000), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : (v as number)));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const sortDirection = z.enum(['asc', 'desc']).default('desc');

/** Whitelist-based sort column resolution — prevents SQL injection via ORDER BY. */
export function resolveSort(column: string | undefined, allowed: readonly string[], fallback: string): string {
  return column && allowed.includes(column) ? column : fallback;
}

/** Escapes the LIKE wildcards in user supplied search terms. */
export function likeTerm(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
