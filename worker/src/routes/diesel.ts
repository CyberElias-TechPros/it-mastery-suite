import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { runAutomation } from '../lib/automation';
import { created, ok, pageMeta } from '../lib/response';
import { isoDate, optionalText, optionalUuid, paginationSchema, parseJson, parseQuery } from '../lib/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AppEnv } from '../types';

export const dieselRoutes = new Hono<AppEnv>();
dieselRoutes.use('*', requireAuth());

const SELECT = `
  l.*, u.full_name AS recorded_by_name, b.name AS branch_name
  FROM diesel_logs l
  LEFT JOIN users u ON u.id = l.recorded_by
  LEFT JOIN branches b ON b.id = l.branch_id
`;

const listQuery = paginationSchema.extend({
  branchId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

dieselRoutes.get('/', async (c) => {
  const q = parseQuery(c, listQuery);
  const where: string[] = ['1 = 1'];
  const values: unknown[] = [];
  if (q.branchId) {
    where.push('l.branch_id = ?');
    values.push(q.branchId);
  }
  if (q.from) {
    where.push('l.date >= ?');
    values.push(q.from);
  }
  if (q.to) {
    where.push('l.date <= ?');
    values.push(q.to);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT ${SELECT} ${whereSql} ORDER BY l.date DESC, l.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM diesel_logs l ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);
  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

dieselRoutes.get('/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(consumed_stock), 0) AS total_consumption,
       COALESCE(SUM(running_hours), 0)  AS total_hours,
       COALESCE(SUM(total_cost), 0)     AS total_cost,
       COUNT(*)                          AS entries
     FROM (SELECT * FROM diesel_logs ORDER BY date DESC LIMIT 30)`,
  ).first<Record<string, number>>();

  const latest = await c.env.DB.prepare(`SELECT * FROM diesel_logs ORDER BY date DESC, created_at DESC LIMIT 1`).first();
  const totalHours = row?.total_hours ?? 0;
  return ok(c, {
    totalConsumption: row?.total_consumption ?? 0,
    totalHours,
    totalCost: row?.total_cost ?? 0,
    entries: row?.entries ?? 0,
    avgPerHour: totalHours > 0 ? (row?.total_consumption ?? 0) / totalHours : 0,
    latest,
  });
});

const dieselSchema = z
  .object({
    date: isoDate,
    branchId: optionalUuid,
    generatorId: optionalText(60),
    openingStock: z.coerce.number().min(0).max(1_000_000),
    receivedStock: z.coerce.number().min(0).max(1_000_000).default(0),
    consumedStock: z.coerce.number().min(0).max(1_000_000),
    closingStock: z.coerce.number().min(0).max(1_000_000),
    runningHours: z.coerce.number().min(0).max(24 * 31).nullish(),
    costPerLiter: z.coerce.number().min(0).max(100_000).nullish(),
    notes: optionalText(1000),
  })
  .refine((v) => v.date <= new Date().toISOString().slice(0, 10), {
    message: 'The log date cannot be in the future',
    path: ['date'],
  })
  .refine(
    (v) => Math.abs(v.openingStock + v.receivedStock - v.consumedStock - v.closingStock) < 0.01,
    { message: 'Opening + received must equal consumed + closing', path: ['closingStock'] },
  );

dieselRoutes.post('/', requireRole('admin', 'technician'), async (c) => {
  const body = await parseJson(c, dieselSchema);
  const id = newId();
  const ts = now();
  const totalCost = body.costPerLiter != null ? Number((body.consumedStock * body.costPerLiter).toFixed(2)) : null;

  await c.env.DB.prepare(
    `INSERT INTO diesel_logs (id, date, branch_id, generator_id, opening_stock, received_stock, consumed_stock, closing_stock,
                              running_hours, cost_per_liter, total_cost, notes, recorded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.date,
      body.branchId,
      body.generatorId,
      body.openingStock,
      body.receivedStock,
      body.consumedStock,
      body.closingStock,
      body.runningHours ?? null,
      body.costPerLiter ?? null,
      totalCost,
      body.notes,
      c.get('user')!.id,
      ts,
      ts,
    )
    .run();

  await audit(c, 'diesel.created', 'diesel_log', id, { date: body.date, consumed: body.consumedStock });
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE l.id = ?`).bind(id).first();
  c.executionCtx.waitUntil(runAutomation(c.env, 'diesel_low', { ...(row as Record<string, unknown>) }));
  return created(c, row);
});

dieselRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const result = await c.env.DB.prepare(`DELETE FROM diesel_logs WHERE id = ?`).bind(c.req.param('id')).run();
  if (!result.meta.changes) throw ApiError.notFound('Diesel log');
  await audit(c, 'diesel.deleted', 'diesel_log', c.req.param('id'));
  return ok(c, { success: true });
});
