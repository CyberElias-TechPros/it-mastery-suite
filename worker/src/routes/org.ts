import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { created, ok } from '../lib/response';
import { optionalMoney, optionalText, optionalUuid, parseJson } from '../lib/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AppEnv } from '../types';

/* -------------------------------------------------------------------------- */
/* Branches                                                                    */
/* -------------------------------------------------------------------------- */

export const branchRoutes = new Hono<AppEnv>();
branchRoutes.use('*', requireAuth());

const BRANCH_SELECT = `
  b.*, m.full_name AS manager_name,
  (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id AND u.deleted_at IS NULL) AS user_count,
  (SELECT COUNT(*) FROM departments d WHERE d.branch_id = b.id AND d.deleted_at IS NULL) AS department_count,
  (SELECT COUNT(*) FROM assets a WHERE a.branch_id = b.id AND a.deleted_at IS NULL) AS asset_count
  FROM branches b
  LEFT JOIN users m ON m.id = b.manager_id
`;

branchRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT ${BRANCH_SELECT} WHERE b.deleted_at IS NULL ORDER BY b.name`).all();
  return ok(c, results ?? []);
});

branchRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT ${BRANCH_SELECT} WHERE b.id = ? AND b.deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first();
  if (!row) throw ApiError.notFound('Branch');
  return ok(c, row);
});

const branchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .union([z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers or dashes'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  address: optionalText(300),
  city: optionalText(120),
  country: optionalText(120),
  phone: optionalText(40),
  budget: optionalMoney,
  managerId: optionalUuid,
});

branchRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await parseJson(c, branchSchema);
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO branches (id, name, code, address, city, country, phone, budget, manager_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.name, body.code, body.address, body.city, body.country, body.phone, body.budget ?? 0, body.managerId, ts, ts)
    .run();
  await audit(c, 'branch.created', 'branch', id, { name: body.name });
  return created(c, await c.env.DB.prepare(`SELECT ${BRANCH_SELECT} WHERE b.id = ?`).bind(id).first());
});

branchRoutes.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c, branchSchema.partial());
  const map: Record<string, unknown> = {
    name: body.name,
    code: body.code,
    address: body.address,
    city: body.city,
    country: body.country,
    phone: body.phone,
    budget: body.budget,
    manager_id: body.managerId,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  const result = await c.env.DB.prepare(
    `UPDATE branches SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(...keys.map((k) => map[k]), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Branch');

  await audit(c, 'branch.updated', 'branch', id, { fields: keys });
  return ok(c, await c.env.DB.prepare(`SELECT ${BRANCH_SELECT} WHERE b.id = ?`).bind(id).first());
});

branchRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const links = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE branch_id = ? AND deleted_at IS NULL) AS users,
       (SELECT COUNT(*) FROM assets WHERE branch_id = ? AND deleted_at IS NULL) AS assets,
       (SELECT COUNT(*) FROM departments WHERE branch_id = ? AND deleted_at IS NULL) AS departments`,
  )
    .bind(id, id, id)
    .first<{ users: number; assets: number; departments: number }>();

  if (links && links.users + links.assets + links.departments > 0) {
    throw ApiError.conflict('Reassign the users, departments and assets in this branch before deleting it');
  }

  const result = await c.env.DB.prepare(`UPDATE branches SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .bind(now(), now(), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Branch');
  await audit(c, 'branch.deleted', 'branch', id);
  return ok(c, { success: true });
});

/* -------------------------------------------------------------------------- */
/* Departments                                                                 */
/* -------------------------------------------------------------------------- */

export const departmentRoutes = new Hono<AppEnv>();
departmentRoutes.use('*', requireAuth());

const DEPT_SELECT = `
  d.*, m.full_name AS manager_name, b.name AS branch_name,
  (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.deleted_at IS NULL) AS user_count
  FROM departments d
  LEFT JOIN users m ON m.id = d.manager_id
  LEFT JOIN branches b ON b.id = d.branch_id
`;

departmentRoutes.get('/', async (c) => {
  const branchId = new URL(c.req.url).searchParams.get('branchId');
  const sql = `SELECT ${DEPT_SELECT} WHERE d.deleted_at IS NULL ${branchId ? 'AND d.branch_id = ?' : ''} ORDER BY d.name`;
  const stmt = branchId ? c.env.DB.prepare(sql).bind(branchId) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return ok(c, results ?? []);
});

const deptSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: optionalText(20),
  branchId: optionalUuid,
  managerId: optionalUuid,
  budget: optionalMoney,
});

departmentRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await parseJson(c, deptSchema);
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO departments (id, name, code, branch_id, manager_id, budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.name, body.code, body.branchId, body.managerId, body.budget ?? 0, ts, ts)
    .run();
  await audit(c, 'department.created', 'department', id, { name: body.name });
  return created(c, await c.env.DB.prepare(`SELECT ${DEPT_SELECT} WHERE d.id = ?`).bind(id).first());
});

departmentRoutes.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c, deptSchema.partial());
  const map: Record<string, unknown> = {
    name: body.name,
    code: body.code,
    branch_id: body.branchId,
    manager_id: body.managerId,
    budget: body.budget,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  const result = await c.env.DB.prepare(
    `UPDATE departments SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(...keys.map((k) => map[k]), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Department');
  await audit(c, 'department.updated', 'department', id, { fields: keys });
  return ok(c, await c.env.DB.prepare(`SELECT ${DEPT_SELECT} WHERE d.id = ?`).bind(id).first());
});

departmentRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const { total } = (await c.env.DB.prepare(
    `SELECT COUNT(*) AS total FROM users WHERE department_id = ? AND deleted_at IS NULL`,
  )
    .bind(id)
    .first<{ total: number }>()) ?? { total: 0 };
  if (total > 0) throw ApiError.conflict('Move the members of this department before deleting it');

  const result = await c.env.DB.prepare(
    `UPDATE departments SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(now(), now(), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Department');
  await audit(c, 'department.deleted', 'department', id);
  return ok(c, { success: true });
});
