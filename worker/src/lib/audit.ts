import { newId, now } from './db';
import { log } from './logger';
import type { AppContext, Env } from '../types';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const SENSITIVE_KEYS = /(password|token|secret|authorization|cookie)/i;

function redact(details: Record<string, unknown> | null | undefined): string | null {
  if (!details) return null;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    clean[k] = SENSITIVE_KEYS.test(k) ? '[redacted]' : v;
  }
  return JSON.stringify(clean);
}

/**
 * Persist an audit record. Audit logging must never break the primary
 * operation, so failures are logged and swallowed.
 */
export async function writeAudit(env: Env, entry: AuditEntry): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO activity_logs (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        entry.actorId ?? null,
        entry.action,
        entry.resourceType,
        entry.resourceId ?? null,
        redact(entry.details),
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.requestId ?? null,
        now(),
      )
      .run();
  } catch (error) {
    log('error', 'audit_write_failed', { action: entry.action, error: String(error) });
  }
}

/** Convenience wrapper that pulls actor / IP / request id straight off the context. */
export function audit(
  c: AppContext,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  details?: Record<string, unknown> | null,
): Promise<void> {
  return writeAudit(c.env, {
    actorId: c.get('user')?.id ?? null,
    action,
    resourceType,
    resourceId: resourceId ?? null,
    details: details ?? null,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent')?.slice(0, 300) ?? null,
    requestId: c.get('requestId'),
  });
}
