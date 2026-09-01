import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { runAutomation } from '../lib/automation';
import { created, ok, pageMeta } from '../lib/response';
import {
  likeTerm,
  optionalIsoDate,
  optionalMoney,
  optionalText,
  optionalUuid,
  paginationSchema,
  parseJson,
  parseQuery,
  resolveSort,
} from '../lib/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AppEnv } from '../types';

export const assetRoutes = new Hono<AppEnv>();
assetRoutes.use('*', requireAuth());

const SELECT = `
  a.*,
  u.full_name AS assigned_to_name,
  d.name AS department_name,
  b.name AS branch_name
  FROM assets a
  LEFT JOIN users u ON u.id = a.assigned_to
  LEFT JOIN departments d ON d.id = a.department_id
  LEFT JOIN branches b ON b.id = a.branch_id
`;

const listQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'retired']).optional(),
  category: z.string().trim().max(60).optional(),
  assignedTo: z.union([z.string().uuid(), z.literal('me'), z.literal('unassigned')]).optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  sort: z.enum(['created_at', 'name', 'asset_tag', 'purchase_date', 'warranty_expiry']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

assetRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = parseQuery(c, listQuery);
  const where = ['a.deleted_at IS NULL'];
  const values: unknown[] = [];

  if (q.status) {
    where.push('a.status = ?');
    values.push(q.status);
  }
  if (q.category) {
    where.push('a.category = ?');
    values.push(q.category);
  }
  if (q.branchId) {
    where.push('a.branch_id = ?');
    values.push(q.branchId);
  }
  if (q.departmentId) {
    where.push('a.department_id = ?');
    values.push(q.departmentId);
  }
  if (q.assignedTo === 'unassigned') where.push('a.assigned_to IS NULL');
  else if (q.assignedTo === 'me') {
    where.push('a.assigned_to = ?');
    values.push(user.id);
  } else if (q.assignedTo) {
    where.push('a.assigned_to = ?');
    values.push(q.assignedTo);
  }
  if (q.search) {
    where.push("(a.name LIKE ? ESCAPE '\\' OR a.asset_tag LIKE ? ESCAPE '\\' OR a.serial_number LIKE ? ESCAPE '\\' OR a.model LIKE ? ESCAPE '\\')");
    const term = likeTerm(q.search);
    values.push(term, term, term, term);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sort = resolveSort(q.sort, ['created_at', 'name', 'asset_tag', 'purchase_date', 'warranty_expiry'], 'created_at');
  const direction = q.direction === 'asc' ? 'ASC' : 'DESC';
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT ${SELECT} ${whereSql} ORDER BY a.${sort} ${direction} LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM assets a ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

assetRoutes.get('/stats', async (c) => {
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total_assets,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_assets,
       SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_assets,
       SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_assets,
       SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) AS retired_assets,
       COALESCE(SUM(purchase_cost), 0) AS total_value,
       SUM(CASE WHEN warranty_expiry IS NOT NULL AND warranty_expiry <= ? AND warranty_expiry >= date('now') THEN 1 ELSE 0 END) AS warranty_expiring
     FROM assets WHERE deleted_at IS NULL`,
  )
    .bind(soon)
    .first<Record<string, number>>();
  return ok(c, row ?? {});
});

assetRoutes.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT category, COUNT(*) AS total FROM assets WHERE deleted_at IS NULL AND category IS NOT NULL GROUP BY category ORDER BY category`,
  ).all();
  return ok(c, results ?? []);
});

assetRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE a.id = ? AND a.deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first();
  if (!row) throw ApiError.notFound('Asset');
  return ok(c, row);
});

const assetSchema = z.object({
  assetTag: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dots or dashes'),
  name: z.string().trim().min(2).max(200),
  description: optionalText(2000),
  category: optionalText(60),
  model: optionalText(120),
  serialNumber: optionalText(120),
  purchaseDate: optionalIsoDate,
  purchaseCost: optionalMoney,
  warrantyExpiry: optionalIsoDate,
  status: z.enum(['active', 'inactive', 'maintenance', 'retired']).default('active'),
  assignedTo: optionalUuid,
  departmentId: optionalUuid,
  branchId: optionalUuid,
  location: optionalText(200),
  notes: optionalText(2000),
});

assetRoutes.post('/', requireRole('admin', 'technician'), async (c) => {
  const body = await parseJson(c, assetSchema);
  if (body.warrantyExpiry && body.purchaseDate && body.warrantyExpiry < body.purchaseDate) {
    throw ApiError.validation({ warrantyExpiry: ['Warranty expiry cannot be before the purchase date'] });
  }

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO assets (id, asset_tag, name, description, category, model, serial_number, purchase_date, purchase_cost,
                         warranty_expiry, status, assigned_to, department_id, branch_id, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.assetTag,
      body.name,
      body.description,
      body.category,
      body.model,
      body.serialNumber,
      body.purchaseDate,
      body.purchaseCost,
      body.warrantyExpiry,
      body.status,
      body.assignedTo,
      body.departmentId,
      body.branchId,
      body.location,
      body.notes,
      ts,
      ts,
    )
    .run();

  await audit(c, 'asset.created', 'asset', id, { assetTag: body.assetTag });
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE a.id = ?`).bind(id).first();
  c.executionCtx.waitUntil(runAutomation(c.env, 'asset_registered', { ...(row as Record<string, unknown>) }));
  return created(c, row);
});

assetRoutes.put('/:id', requireRole('admin', 'technician'), async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c, assetSchema.partial());

  const existing = await c.env.DB.prepare(`SELECT id FROM assets WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string }>();
  if (!existing) throw ApiError.notFound('Asset');

  const map: Record<string, unknown> = {
    asset_tag: body.assetTag,
    name: body.name,
    description: body.description,
    category: body.category,
    model: body.model,
    serial_number: body.serialNumber,
    purchase_date: body.purchaseDate,
    purchase_cost: body.purchaseCost,
    warranty_expiry: body.warrantyExpiry,
    status: body.status,
    assigned_to: body.assignedTo,
    department_id: body.departmentId,
    branch_id: body.branchId,
    location: body.location,
    notes: body.notes,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (keys.length === 0) throw ApiError.badRequest('No changes supplied');
  keys.push('updated_at');
  map.updated_at = now();

  await c.env.DB.prepare(`UPDATE assets SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();

  await audit(c, 'asset.updated', 'asset', id, { fields: keys });
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE a.id = ?`).bind(id).first();
  return ok(c, row);
});

assetRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`UPDATE assets SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .bind(now(), now(), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Asset');
  await audit(c, 'asset.deleted', 'asset', id);
  return ok(c, { success: true });
});
