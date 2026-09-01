import { Hono } from 'hono';
import { z } from 'zod';
import { newId, now, parseJsonColumn } from '../lib/db';
import { ok, pageMeta } from '../lib/response';
import { paginationSchema, parseQuery } from '../lib/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AppEnv, Env } from '../types';

export const systemRoutes = new Hono<AppEnv>();

export interface Metric {
  metric_name: string;
  metric_value: string;
  status: 'healthy' | 'warning' | 'critical';
  recorded_at: string;
}

/** Live probes against the actual Cloudflare bindings this API depends on. */
export async function collectMetrics(env: Env): Promise<Metric[]> {
  const ts = now();
  const metrics: Metric[] = [];

  // --- D1 ------------------------------------------------------------------
  const dbStart = Date.now();
  let dbOk = true;
  try {
    await env.DB.prepare('SELECT 1').first();
  } catch {
    dbOk = false;
  }
  const dbLatency = Date.now() - dbStart;
  metrics.push({
    metric_name: 'Database (D1) latency',
    metric_value: dbOk ? `${dbLatency}ms` : 'unreachable',
    status: !dbOk ? 'critical' : dbLatency > 500 ? 'warning' : 'healthy',
    recorded_at: ts,
  });

  // --- KV ------------------------------------------------------------------
  const kvStart = Date.now();
  let kvOk = true;
  try {
    await env.CACHE.get('healthcheck');
  } catch {
    kvOk = false;
  }
  metrics.push({
    metric_name: 'Cache (KV) latency',
    metric_value: kvOk ? `${Date.now() - kvStart}ms` : 'unreachable',
    status: kvOk ? 'healthy' : 'critical',
    recorded_at: ts,
  });

  // --- R2 ------------------------------------------------------------------
  const r2Start = Date.now();
  let r2Ok = true;
  try {
    await env.UPLOADS.head('healthcheck');
  } catch {
    r2Ok = false;
  }
  metrics.push({
    metric_name: 'Object storage (R2) latency',
    metric_value: r2Ok ? `${Date.now() - r2Start}ms` : 'unreachable',
    status: r2Ok ? 'healthy' : 'critical',
    recorded_at: ts,
  });

  if (!dbOk) return metrics;

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > ?) AS active_sessions,
       (SELECT COUNT(*) FROM activity_logs WHERE action = 'auth.login_failed' AND created_at > ?) AS failed_logins,
       (SELECT COUNT(*) FROM tickets WHERE status IN ('open','in_progress')) AS open_tickets,
       (SELECT COUNT(*) FROM tickets WHERE sla_due_date < ? AND status IN ('open','in_progress')) AS overdue_tickets,
       (SELECT COUNT(*) FROM users WHERE is_active = 1 AND deleted_at IS NULL) AS active_users,
       (SELECT COUNT(*) FROM attachments WHERE deleted_at IS NULL) AS stored_files,
       (SELECT COALESCE(SUM(file_size), 0) FROM attachments WHERE deleted_at IS NULL) AS stored_bytes,
       (SELECT COUNT(*) FROM automation_executions WHERE status = 'failed' AND executed_at > ?) AS failed_automations`,
  )
    .bind(now(), dayAgo, now(), dayAgo)
    .first<Record<string, number>>();

  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  metrics.push(
    {
      metric_name: 'Active sessions',
      metric_value: String(row?.active_sessions ?? 0),
      status: 'healthy',
      recorded_at: ts,
    },
    {
      metric_name: 'Failed sign-ins (24h)',
      metric_value: String(row?.failed_logins ?? 0),
      status: (row?.failed_logins ?? 0) > 25 ? 'critical' : (row?.failed_logins ?? 0) > 10 ? 'warning' : 'healthy',
      recorded_at: ts,
    },
    { metric_name: 'Open tickets', metric_value: String(row?.open_tickets ?? 0), status: 'healthy', recorded_at: ts },
    {
      metric_name: 'Tickets breaching SLA',
      metric_value: String(row?.overdue_tickets ?? 0),
      status: (row?.overdue_tickets ?? 0) > 10 ? 'critical' : (row?.overdue_tickets ?? 0) > 0 ? 'warning' : 'healthy',
      recorded_at: ts,
    },
    { metric_name: 'Active users', metric_value: String(row?.active_users ?? 0), status: 'healthy', recorded_at: ts },
    {
      metric_name: 'Stored files',
      metric_value: `${row?.stored_files ?? 0} (${mb(row?.stored_bytes ?? 0)})`,
      status: 'healthy',
      recorded_at: ts,
    },
    {
      metric_name: 'Failed automations (24h)',
      metric_value: String(row?.failed_automations ?? 0),
      status: (row?.failed_automations ?? 0) > 0 ? 'warning' : 'healthy',
      recorded_at: ts,
    },
  );

  return metrics;
}

/** Unauthenticated liveness probe (no data disclosure). */
systemRoutes.get('/ping', async (c) => {
  let dbOk = true;
  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch {
    dbOk = false;
  }
  return c.json({ data: { status: dbOk ? 'ok' : 'degraded', environment: c.env.ENVIRONMENT } }, dbOk ? 200 : 503);
});

systemRoutes.use('/health', requireAuth(), requireRole('admin'));
systemRoutes.use('/metrics', requireAuth(), requireRole('admin'));
systemRoutes.use('/activity', requireAuth(), requireRole('admin'));

systemRoutes.get('/health', async (c) => {
  const metrics = await collectMetrics(c.env);
  const worst = metrics.some((m) => m.status === 'critical')
    ? 'critical'
    : metrics.some((m) => m.status === 'warning')
      ? 'warning'
      : 'healthy';

  const { results: alerts } = await c.env.DB.prepare(
    `SELECT id, metric_name, metric_value, status, recorded_at FROM system_metrics
     WHERE status IN ('warning','critical') ORDER BY recorded_at DESC LIMIT 20`,
  ).all();

  return ok(c, {
    status: worst,
    checkedAt: now(),
    environment: c.env.ENVIRONMENT,
    metrics,
    alerts: alerts ?? [],
  });
});

/** Historical series recorded by the scheduled worker. */
systemRoutes.get('/metrics', async (c) => {
  const q = parseQuery(c, z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) }));
  const since = new Date(Date.now() - q.hours * 3_600_000).toISOString();
  const { results } = await c.env.DB.prepare(
    `SELECT metric_name, metric_value, status, recorded_at FROM system_metrics
     WHERE recorded_at >= ? ORDER BY recorded_at ASC LIMIT 2000`,
  )
    .bind(since)
    .all();
  return ok(c, results ?? []);
});

/** Audit trail. */
systemRoutes.get('/activity', async (c) => {
  const q = parseQuery(
    c,
    paginationSchema.extend({
      action: z.string().trim().max(60).optional(),
      resourceType: z.string().trim().max(60).optional(),
      userId: z.string().uuid().optional(),
    }),
  );
  const where: string[] = ['1 = 1'];
  const values: unknown[] = [];
  if (q.action) {
    where.push('l.action = ?');
    values.push(q.action);
  }
  if (q.resourceType) {
    where.push('l.resource_type = ?');
    values.push(q.resourceType);
  }
  if (q.userId) {
    where.push('l.user_id = ?');
    values.push(q.userId);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(
      `SELECT l.*, u.full_name AS user_name, u.email AS user_email
       FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
       ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...values, q.pageSize, (q.page - 1) * q.pageSize)
      .all<{ details: string }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM activity_logs l ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  return ok(
    c,
    (rows.results ?? []).map((r) => ({ ...r, details: parseJsonColumn(r.details, null) })),
    pageMeta(q.page, q.pageSize, count?.total ?? 0),
  );
});

/** Persists the current probe results — called by the scheduled handler. */
export async function recordMetrics(env: Env): Promise<void> {
  const metrics = await collectMetrics(env);
  const ts = now();
  const statements = metrics.map((m) =>
    env.DB.prepare(
      `INSERT INTO system_metrics (id, metric_name, metric_value, status, recorded_at) VALUES (?, ?, ?, ?, ?)`,
    ).bind(newId(), m.metric_name, m.metric_value, m.status, ts),
  );
  if (statements.length) await env.DB.batch(statements);
}
