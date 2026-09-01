import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { adminIds, notify } from '../lib/notifications';
import { runAutomation } from '../lib/automation';
import { created, ok, pageMeta } from '../lib/response';
import {
  isoDate,
  likeTerm,
  money,
  optionalText,
  optionalUuid,
  paginationSchema,
  parseJson,
  parseQuery,
} from '../lib/validation';
import { isStaff, requireAuth, requireRole } from '../middleware/auth';
import type { AppEnv } from '../types';

export const expenseRoutes = new Hono<AppEnv>();
expenseRoutes.use('*', requireAuth());

const SELECT = `
  e.*, v.name AS vendor_name, d.name AS department_name, b.name AS branch_name,
  s.full_name AS submitted_by_name, ap.full_name AS approved_by_name
  FROM expenses e
  LEFT JOIN vendors v ON v.id = e.vendor_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN users s ON s.id = e.submitted_by
  LEFT JOIN users ap ON ap.id = e.approved_by
`;

const listQuery = paginationSchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  category: z.string().trim().max(60).optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(120).optional(),
  mine: z.enum(['true']).optional(),
});

expenseRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = parseQuery(c, listQuery);
  const where: string[] = [];
  const values: unknown[] = [];

  // Employees only see the expenses they submitted; staff see everything.
  if (!isStaff(user.role) || q.mine === 'true') {
    where.push('e.submitted_by = ?');
    values.push(user.id);
  } else {
    where.push('1 = 1');
  }
  if (q.status) {
    where.push('e.status = ?');
    values.push(q.status);
  }
  if (q.category) {
    where.push('e.category = ?');
    values.push(q.category);
  }
  if (q.branchId) {
    where.push('e.branch_id = ?');
    values.push(q.branchId);
  }
  if (q.departmentId) {
    where.push('e.department_id = ?');
    values.push(q.departmentId);
  }
  if (q.from) {
    where.push('e.expense_date >= ?');
    values.push(q.from);
  }
  if (q.to) {
    where.push('e.expense_date <= ?');
    values.push(q.to);
  }
  if (q.search) {
    where.push("(e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\')");
    values.push(likeTerm(q.search), likeTerm(q.search));
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (q.page - 1) * q.pageSize;
  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT ${SELECT} ${whereSql} ORDER BY e.expense_date DESC, e.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM expenses e ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);
  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

expenseRoutes.get('/stats', async (c) => {
  const user = c.get('user')!;
  const scope = isStaff(user.role) ? '1 = 1' : 'submitted_by = ?';
  const values = isStaff(user.role) ? [] : [user.id];
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total_expenses,
       COALESCE(SUM(amount), 0) AS total_amount,
       COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS approved_amount,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_approval,
       COALESCE(SUM(CASE WHEN expense_date >= ? THEN amount ELSE 0 END), 0) AS month_to_date
     FROM expenses WHERE ${scope}`,
  )
    .bind(monthStart, ...values)
    .first<Record<string, number>>();

  const { results: byCategory } = await c.env.DB.prepare(
    `SELECT COALESCE(category, 'uncategorised') AS category, COALESCE(SUM(amount), 0) AS amount
     FROM expenses WHERE ${scope} GROUP BY category ORDER BY amount DESC LIMIT 10`,
  )
    .bind(...values)
    .all();

  return ok(c, { ...(row ?? {}), by_category: byCategory ?? [] });
});

const expenseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: optionalText(2000),
  amount: money,
  expenseDate: isoDate,
  category: optionalText(60),
  vendorId: optionalUuid,
  departmentId: optionalUuid,
  branchId: optionalUuid,
  notes: optionalText(2000),
  receiptKey: optionalText(300),
});

expenseRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await parseJson(c, expenseSchema);
  if (body.expenseDate > new Date().toISOString().slice(0, 10)) {
    throw ApiError.validation({ expenseDate: ['The expense date cannot be in the future'] });
  }

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO expenses (id, title, description, amount, expense_date, category, vendor_id, department_id, branch_id,
                           submitted_by, status, receipt_key, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.title,
      body.description,
      body.amount,
      body.expenseDate,
      body.category,
      body.vendorId,
      body.departmentId,
      body.branchId,
      user.id,
      body.receiptKey,
      body.notes,
      ts,
      ts,
    )
    .run();

  await audit(c, 'expense.created', 'expense', id, { amount: body.amount });
  for (const admin of await adminIds(c.env)) {
    if (admin === user.id) continue;
    await notify(c.env, {
      userId: admin,
      title: 'Expense awaiting approval',
      message: `${body.title} — ${body.amount.toFixed(2)}`,
      actionUrl: '/expenses',
      dedupeKey: `expense-pending:${id}:${admin}`,
    });
  }

  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE e.id = ?`).bind(id).first();
  c.executionCtx.waitUntil(runAutomation(c.env, 'expense_added', { ...(row as Record<string, unknown>) }));
  return created(c, row);
});

expenseRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(`SELECT ${SELECT} WHERE e.id = ?`)
    .bind(c.req.param('id'))
    .first<{ submitted_by: string }>();
  if (!row) throw ApiError.notFound('Expense');
  if (!isStaff(user.role) && row.submitted_by !== user.id) throw ApiError.notFound('Expense');
  return ok(c, row);
});

expenseRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, expenseSchema.partial());

  const expense = await c.env.DB.prepare(`SELECT * FROM expenses WHERE id = ?`)
    .bind(id)
    .first<{ id: string; status: string; submitted_by: string }>();
  if (!expense) throw ApiError.notFound('Expense');

  const isOwner = expense.submitted_by === user.id;
  if (!isOwner && user.role !== 'admin') throw ApiError.forbidden();
  if (isOwner && user.role !== 'admin' && expense.status !== 'pending') {
    throw ApiError.conflict('An expense can only be edited while it is pending');
  }

  const map: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    amount: body.amount,
    expense_date: body.expenseDate,
    category: body.category,
    vendor_id: body.vendorId,
    department_id: body.departmentId,
    branch_id: body.branchId,
    receipt_key: body.receiptKey,
    notes: body.notes,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  await c.env.DB.prepare(`UPDATE expenses SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();
  await audit(c, 'expense.updated', 'expense', id, { fields: keys });
  return ok(c, await c.env.DB.prepare(`SELECT ${SELECT} WHERE e.id = ?`).bind(id).first());
});

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: optionalText(500),
});

expenseRoutes.post('/:id/decision', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, decisionSchema);

  const expense = await c.env.DB.prepare(`SELECT * FROM expenses WHERE id = ?`)
    .bind(id)
    .first<{ id: string; status: string; submitted_by: string; title: string; amount: number }>();
  if (!expense) throw ApiError.notFound('Expense');
  if (expense.status !== 'pending') throw ApiError.conflict('This expense has already been decided');
  if (expense.submitted_by === user.id) throw ApiError.forbidden('You cannot approve your own expense');
  if (body.decision === 'rejected' && !body.reason) {
    throw ApiError.validation({ reason: ['Give a reason when rejecting an expense'] });
  }

  await c.env.DB.prepare(
    `UPDATE expenses SET status = ?, approved_by = ?, approved_at = ?, rejected_reason = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(body.decision, user.id, body.decision === 'approved' ? now() : null, body.reason ?? null, now(), id)
    .run();

  await audit(c, `expense.${body.decision}`, 'expense', id, { amount: expense.amount });
  await notify(c.env, {
    userId: expense.submitted_by,
    title: `Expense ${body.decision}`,
    message: expense.title,
    actionUrl: '/expenses',
    dedupeKey: `expense-${body.decision}:${id}`,
  });

  return ok(c, await c.env.DB.prepare(`SELECT ${SELECT} WHERE e.id = ?`).bind(id).first());
});

expenseRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const expense = await c.env.DB.prepare(`SELECT status, submitted_by, receipt_key FROM expenses WHERE id = ?`)
    .bind(id)
    .first<{ status: string; submitted_by: string; receipt_key: string | null }>();
  if (!expense) throw ApiError.notFound('Expense');
  if (expense.submitted_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();
  if (expense.status === 'approved' && user.role !== 'admin') {
    throw ApiError.conflict('Approved expenses can only be removed by an administrator');
  }

  await c.env.DB.prepare(`DELETE FROM expenses WHERE id = ?`).bind(id).run();
  if (expense.receipt_key) await c.env.UPLOADS.delete(expense.receipt_key).catch(() => undefined);
  await audit(c, 'expense.deleted', 'expense', id);
  return ok(c, { success: true });
});

/* -------------------------------------------------------------------------- */
/* Budgets — branch & department utilisation for a given year                  */
/* -------------------------------------------------------------------------- */

export const budgetRoutes = new Hono<AppEnv>();
budgetRoutes.use('*', requireAuth());

budgetRoutes.get('/', async (c) => {
  const { year } = parseQuery(
    c,
    z.object({ year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()) }),
  );
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [branches, departments] = await Promise.all([
    c.env.DB.prepare(
      `SELECT b.id, b.name, b.budget,
              COALESCE((SELECT SUM(e.amount) FROM expenses e
                        WHERE e.branch_id = b.id AND e.status = 'approved'
                          AND e.expense_date BETWEEN ? AND ?), 0) AS spent
       FROM branches b WHERE b.deleted_at IS NULL ORDER BY b.name`,
    )
      .bind(from, to)
      .all<{ id: string; name: string; budget: number; spent: number }>(),
    c.env.DB.prepare(
      `SELECT d.id, d.name, d.budget, b.name AS branch_name,
              COALESCE((SELECT SUM(e.amount) FROM expenses e
                        WHERE e.department_id = d.id AND e.status = 'approved'
                          AND e.expense_date BETWEEN ? AND ?), 0) AS spent
       FROM departments d LEFT JOIN branches b ON b.id = d.branch_id
       WHERE d.deleted_at IS NULL ORDER BY d.name`,
    )
      .bind(from, to)
      .all<{ id: string; name: string; budget: number; spent: number; branch_name: string | null }>(),
  ]);

  const decorate = <T extends { budget: number; spent: number }>(row: T) => ({
    ...row,
    remaining: Number((row.budget - row.spent).toFixed(2)),
    utilization: row.budget > 0 ? Number(((row.spent / row.budget) * 100).toFixed(1)) : 0,
  });

  return ok(c, {
    year,
    branches: (branches.results ?? []).map(decorate),
    departments: (departments.results ?? []).map(decorate),
  });
});
