import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { now } from '../lib/db';
import { ok, pageMeta } from '../lib/response';
import { paginationSchema, parseQuery } from '../lib/validation';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use('*', requireAuth());

notificationRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = parseQuery(
    c,
    paginationSchema.extend({
      filter: z.enum(['all', 'unread', 'read']).default('all'),
      type: z.enum(['ticket_assigned', 'ticket_updated', 'ticket_resolved', 'system', 'mention']).optional(),
    }),
  );

  const where = ['user_id = ?'];
  const values: unknown[] = [user.id];
  if (q.filter === 'unread') where.push('is_read = 0');
  if (q.filter === 'read') where.push('is_read = 1');
  if (q.type) {
    where.push('type = ?');
    values.push(q.type);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all<{ is_read: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  return ok(
    c,
    (rows.results ?? []).map((r) => ({ ...r, is_read: r.is_read === 1 })),
    pageMeta(q.page, q.pageSize, count?.total ?? 0),
  );
});

notificationRoutes.get('/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
            SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS read
     FROM notifications WHERE user_id = ?`,
  )
    .bind(c.get('user')!.id)
    .first<{ total: number; unread: number; read: number }>();
  return ok(c, { total: row?.total ?? 0, unread: row?.unread ?? 0, read: row?.read ?? 0 });
});

notificationRoutes.put('/:id/read', async (c) => {
  const result = await c.env.DB.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
    .bind(c.req.param('id'), c.get('user')!.id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Notification');
  return ok(c, { success: true });
});

notificationRoutes.put('/read-all', async (c) => {
  const result = await c.env.DB.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`)
    .bind(c.get('user')!.id)
    .run();
  return ok(c, { success: true, updated: result.meta.changes ?? 0 });
});

notificationRoutes.delete('/:id', async (c) => {
  const result = await c.env.DB.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`)
    .bind(c.req.param('id'), c.get('user')!.id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Notification');
  return ok(c, { success: true });
});

notificationRoutes.delete('/', async (c) => {
  const q = parseQuery(c, z.object({ onlyRead: z.enum(['true', 'false']).default('true') }));
  const sql =
    q.onlyRead === 'true'
      ? `DELETE FROM notifications WHERE user_id = ? AND is_read = 1`
      : `DELETE FROM notifications WHERE user_id = ?`;
  const result = await c.env.DB.prepare(sql).bind(c.get('user')!.id).run();
  return ok(c, { success: true, deleted: result.meta.changes ?? 0, clearedAt: now() });
});
