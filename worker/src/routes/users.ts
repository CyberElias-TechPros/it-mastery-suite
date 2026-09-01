import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { hashPassword } from '../lib/crypto';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { ok, created, pageMeta } from '../lib/response';
import { likeTerm, optionalUuid, paginationSchema, parseJson, parseQuery, resolveSort } from '../lib/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { USER_PUBLIC_COLUMNS, publicUser, type UserRow } from './users.shared';
import type { AppEnv } from '../types';

export const userRoutes = new Hono<AppEnv>();

userRoutes.use('*', requireAuth());

const listQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.enum(['admin', 'technician', 'employee']).optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
  sort: z.enum(['full_name', 'email', 'role', 'created_at']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

/** Directory listing — every authenticated user may see colleagues (name/role/branch). */
userRoutes.get('/', async (c) => {
  const q = parseQuery(c, listQuery);
  const where: string[] = ['u.deleted_at IS NULL'];
  const values: unknown[] = [];

  if (q.role) {
    where.push('u.role = ?');
    values.push(q.role);
  }
  if (q.branchId) {
    where.push('u.branch_id = ?');
    values.push(q.branchId);
  }
  if (q.departmentId) {
    where.push('u.department_id = ?');
    values.push(q.departmentId);
  }
  if (q.active) {
    where.push('u.is_active = ?');
    values.push(q.active === 'true' ? 1 : 0);
  }
  if (q.search) {
    where.push('(u.full_name LIKE ? ESCAPE \'\\\' OR u.email LIKE ? ESCAPE \'\\\')');
    values.push(likeTerm(q.search), likeTerm(q.search));
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sort = resolveSort(q.sort, ['full_name', 'email', 'role', 'created_at'], 'full_name');
  const direction = q.direction === 'asc' || !q.direction ? 'ASC' : 'DESC';
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(
      `SELECT ${USER_PUBLIC_COLUMNS.split(', ').map((col) => `u.${col}`).join(', ')},
              b.name AS branch_name, d.name AS department_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN departments d ON d.id = u.department_id
       ${whereSql}
       ORDER BY ${sort} ${direction}
       LIMIT ? OFFSET ?`,
    )
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM users u ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

userRoutes.get('/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total_users,
       SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
       SUM(CASE WHEN role = 'technician' THEN 1 ELSE 0 END) AS technicians,
       SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) AS employees,
       SUM(CASE WHEN branch_id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_users,
       SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users
     FROM users WHERE deleted_at IS NULL`,
  ).first<Record<string, number>>();

  const total = row?.total_users ?? 0;
  return ok(c, {
    totalUsers: total,
    admins: row?.admins ?? 0,
    technicians: row?.technicians ?? 0,
    employees: row?.employees ?? 0,
    assignedUsers: row?.assigned_users ?? 0,
    unassignedUsers: total - (row?.assigned_users ?? 0),
    activeUsers: row?.active_users ?? 0,
  });
});

/** Technicians & admins — used to populate assignment pickers. */
userRoutes.get('/assignable', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, full_name, email, role FROM users
     WHERE deleted_at IS NULL AND is_active = 1 AND role IN ('admin','technician')
     ORDER BY full_name`,
  ).all();
  return ok(c, results ?? []);
});

userRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first<UserRow>();
  if (!row) throw ApiError.notFound('User');
  return ok(c, publicUser(row));
});

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'technician', 'employee']).default('employee'),
  phone: z.string().trim().max(40).nullish(),
  department: z.string().trim().max(120).nullish(),
  branchId: optionalUuid,
  departmentId: optionalUuid,
});

userRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await parseJson(c, createUserSchema);
  const exists = await c.env.DB.prepare(`SELECT id FROM users WHERE email_lower = ?`)
    .bind(body.email)
    .first<{ id: string }>();
  if (exists) throw ApiError.conflict('A user with that email already exists');

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, email_lower, password_hash, full_name, role, phone, department, branch_id, department_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.email,
      body.email,
      await hashPassword(body.password),
      body.fullName,
      body.role,
      body.phone ?? null,
      body.department ?? null,
      body.branchId ?? null,
      body.departmentId ?? null,
      ts,
      ts,
    )
    .run();

  await audit(c, 'user.created', 'user', id, { role: body.role });
  const row = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<UserRow>();
  return created(c, publicUser(row!));
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['admin', 'technician', 'employee']).optional(),
  phone: z.string().trim().max(40).nullish(),
  department: z.string().trim().max(120).nullish(),
  branchId: optionalUuid,
  departmentId: optionalUuid,
  isActive: z.boolean().optional(),
});

userRoutes.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user')!;
  const body = await parseJson(c, updateUserSchema);

  const target = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<UserRow>();
  if (!target) throw ApiError.notFound('User');

  // Guard rails: an admin may not demote or deactivate themselves, and the last
  // remaining admin account must always stay an active admin.
  if (target.id === actor.id && (body.role && body.role !== 'admin')) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  if (target.id === actor.id && body.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  if (target.role === 'admin' && (body.role !== undefined && body.role !== 'admin' || body.isActive === false)) {
    const { total } = (await c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL`,
    ).first<{ total: number }>()) ?? { total: 0 };
    if (total <= 1) throw ApiError.conflict('At least one active administrator must remain');
  }

  const patch: Record<string, unknown> = { updated_at: now() };
  if (body.fullName !== undefined) patch.full_name = body.fullName;
  if (body.role !== undefined) patch.role = body.role;
  if (body.phone !== undefined) patch.phone = body.phone ?? null;
  if (body.department !== undefined) patch.department = body.department ?? null;
  if (body.branchId !== undefined) patch.branch_id = body.branchId;
  if (body.departmentId !== undefined) patch.department_id = body.departmentId;
  if (body.isActive !== undefined) patch.is_active = body.isActive ? 1 : 0;

  const keys = Object.keys(patch);
  await c.env.DB.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => patch[k]), id)
    .run();

  // Revoke sessions when access is reduced so the change is effective immediately.
  if (body.isActive === false || (body.role && body.role !== target.role)) {
    await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(now(), id)
      .run();
  }

  await audit(c, 'user.updated', 'user', id, { fields: keys.filter((k) => k !== 'updated_at') });
  const row = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<UserRow>();
  return ok(c, publicUser(row!));
});

/** Soft delete — historical tickets, expenses and audit rows stay intact. */
userRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user')!;
  if (id === actor.id) throw ApiError.badRequest('You cannot delete your own account');

  const target = await c.env.DB.prepare(`SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; role: string }>();
  if (!target) throw ApiError.notFound('User');

  if (target.role === 'admin') {
    const { total } = (await c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL`,
    ).first<{ total: number }>()) ?? { total: 0 };
    if (total <= 1) throw ApiError.conflict('At least one active administrator must remain');
  }

  const ts = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET deleted_at = ?, is_active = 0, email_lower = 'deleted:' || id, updated_at = ? WHERE id = ?`,
    ).bind(ts, ts, id),
    c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(ts, id),
  ]);

  await audit(c, 'user.deleted', 'user', id);
  return ok(c, { success: true });
});

const resetPasswordSchema = z.object({ newPassword: z.string().min(10).max(200) });

userRoutes.post('/:id/password', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c, resetPasswordSchema);
  const target = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string }>();
  if (!target) throw ApiError.notFound('User');

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(
      await hashPassword(body.newPassword),
      now(),
      id,
    ),
    c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(now(), id),
  ]);

  await audit(c, 'user.password_reset_by_admin', 'user', id);
  return ok(c, { success: true });
});
