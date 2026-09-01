import type { Env } from '../types';

export const now = (): string => new Date().toISOString();
export const newId = (): string => crypto.randomUUID();

export const toBool = (value: unknown): boolean => value === 1 || value === true || value === '1';
export const fromBool = (value: boolean | undefined | null): number => (value ? 1 : 0);

export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Builds `SET a = ?, b = ?` fragments from a partial patch, skipping undefined
 * values so that PATCH semantics ("only update what was sent") work correctly.
 */
export function buildUpdate(patch: Record<string, unknown>): { sql: string; values: unknown[] } {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  return {
    sql: keys.map((k) => `${k} = ?`).join(', '),
    values: keys.map((k) => patch[k]),
  };
}

/** Atomically increments a named counter and returns the new value. */
export async function nextCounter(env: Env, name: string): Promise<number> {
  const row = await env.DB.prepare(
    'UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value',
  )
    .bind(name)
    .first<{ value: number }>();
  if (row) return row.value;
  // Counter row missing (fresh DB / unknown counter): create it.
  await env.DB.prepare('INSERT OR IGNORE INTO counters (name, value) VALUES (?, 1)').bind(name).run();
  const created = await env.DB.prepare('SELECT value FROM counters WHERE name = ?')
    .bind(name)
    .first<{ value: number }>();
  return created?.value ?? 1;
}

export async function countRows(env: Env, sql: string, values: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql)
    .bind(...values)
    .first<{ total: number }>();
  return row?.total ?? 0;
}
