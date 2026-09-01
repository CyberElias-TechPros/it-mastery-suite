import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
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
import { notify, adminIds } from '../lib/notifications';
import type { AppEnv } from '../types';

/* -------------------------------------------------------------------------- */
/* Vendors                                                                     */
/* -------------------------------------------------------------------------- */

export const vendorRoutes = new Hono<AppEnv>();
vendorRoutes.use('*', requireAuth());

const vendorQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  serviceType: z.string().trim().max(60).optional(),
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  sort: z.enum(['name', 'created_at', 'contract_end_date', 'rating']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

vendorRoutes.get('/', async (c) => {
  const q = parseQuery(c, vendorQuery);
  const where = ['v.deleted_at IS NULL'];
  const values: unknown[] = [];

  if (q.serviceType) {
    where.push('v.service_type = ?');
    values.push(q.serviceType);
  }
  if (q.expiringWithinDays) {
    where.push('v.contract_end_date IS NOT NULL AND v.contract_end_date BETWEEN ? AND ?');
    values.push(
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() + q.expiringWithinDays * 86_400_000).toISOString().slice(0, 10),
    );
  }
  if (q.search) {
    where.push("(v.name LIKE ? ESCAPE '\\' OR v.contact_person LIKE ? ESCAPE '\\' OR v.email LIKE ? ESCAPE '\\')");
    const term = likeTerm(q.search);
    values.push(term, term, term);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sort = resolveSort(q.sort, ['name', 'created_at', 'contract_end_date', 'rating'], 'name');
  const direction = q.direction === 'desc' ? 'DESC' : 'ASC';
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT v.* FROM vendors v ${whereSql} ORDER BY v.${sort} ${direction} LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM vendors v ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);
  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

vendorRoutes.get('/service-types', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT service_type FROM vendors WHERE deleted_at IS NULL AND service_type IS NOT NULL AND service_type <> '' ORDER BY service_type`,
  ).all<{ service_type: string }>();
  return ok(c, (results ?? []).map((r) => r.service_type));
});

vendorRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM vendors WHERE id = ? AND deleted_at IS NULL`)
    .bind(c.req.param('id'))
    .first();
  if (!row) throw ApiError.notFound('Vendor');
  return ok(c, row);
});

const vendorSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    contactPerson: optionalText(120),
    email: z
      .union([z.string().trim().toLowerCase().email().max(254), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    phone: optionalText(40),
    address: optionalText(300),
    website: z
      .union([z.string().trim().url('Enter a valid URL including https://').max(300), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
    serviceType: optionalText(60),
    category: optionalText(60),
    rating: z
      .union([z.coerce.number().min(0).max(5), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : (v as number))),
    contractStartDate: optionalIsoDate,
    contractEndDate: optionalIsoDate,
    contractValue: optionalMoney,
    paymentTerms: optionalText(200),
    notes: optionalText(2000),
  })
  .refine((v) => !v.contractStartDate || !v.contractEndDate || v.contractEndDate >= v.contractStartDate, {
    message: 'Contract end date must be after the start date',
    path: ['contractEndDate'],
  });

vendorRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await parseJson(c, vendorSchema);
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO vendors (id, name, contact_person, email, phone, address, website, service_type, category, rating,
                          contract_start_date, contract_end_date, contract_value, payment_terms, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.name,
      body.contactPerson,
      body.email,
      body.phone,
      body.address,
      body.website,
      body.serviceType,
      body.category,
      body.rating,
      body.contractStartDate,
      body.contractEndDate,
      body.contractValue,
      body.paymentTerms,
      body.notes,
      ts,
      ts,
    )
    .run();
  await audit(c, 'vendor.created', 'vendor', id, { name: body.name });
  return created(c, await c.env.DB.prepare(`SELECT * FROM vendors WHERE id = ?`).bind(id).first());
});

vendorRoutes.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c, vendorSchema.innerType().partial());
  const map: Record<string, unknown> = {
    name: body.name,
    contact_person: body.contactPerson,
    email: body.email,
    phone: body.phone,
    address: body.address,
    website: body.website,
    service_type: body.serviceType,
    category: body.category,
    rating: body.rating,
    contract_start_date: body.contractStartDate,
    contract_end_date: body.contractEndDate,
    contract_value: body.contractValue,
    payment_terms: body.paymentTerms,
    notes: body.notes,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  const result = await c.env.DB.prepare(
    `UPDATE vendors SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(...keys.map((k) => map[k]), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Vendor');
  await audit(c, 'vendor.updated', 'vendor', id, { fields: keys });
  return ok(c, await c.env.DB.prepare(`SELECT * FROM vendors WHERE id = ?`).bind(id).first());
});

vendorRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const { total } = (await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = ?) +
            (SELECT COUNT(*) FROM expenses WHERE vendor_id = ?) AS total`,
  )
    .bind(id, id)
    .first<{ total: number }>()) ?? { total: 0 };
  if (total > 0) throw ApiError.conflict('This vendor is referenced by purchase orders or expenses and cannot be deleted');

  const result = await c.env.DB.prepare(`UPDATE vendors SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .bind(now(), now(), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Vendor');
  await audit(c, 'vendor.deleted', 'vendor', id);
  return ok(c, { success: true });
});

/* -------------------------------------------------------------------------- */
/* Purchase orders                                                             */
/* -------------------------------------------------------------------------- */

export const purchaseOrderRoutes = new Hono<AppEnv>();
purchaseOrderRoutes.use('*', requireAuth());

const PO_SELECT = `
  p.*, v.name AS vendor_name, r.full_name AS requested_by_name, a.full_name AS approved_by_name
  FROM purchase_orders p
  LEFT JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN users r ON r.id = p.requested_by
  LEFT JOIN users a ON a.id = p.approved_by
`;

const PO_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'ordered', 'received', 'cancelled'] as const;

purchaseOrderRoutes.get('/', async (c) => {
  const q = parseQuery(
    c,
    paginationSchema.extend({
      status: z.enum(PO_STATUSES).optional(),
      vendorId: z.string().uuid().optional(),
      search: z.string().trim().max(120).optional(),
    }),
  );
  const where = ['1 = 1'];
  const values: unknown[] = [];
  if (q.status) {
    where.push('p.status = ?');
    values.push(q.status);
  }
  if (q.vendorId) {
    where.push('p.vendor_id = ?');
    values.push(q.vendorId);
  }
  if (q.search) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.po_number LIKE ? ESCAPE '\\')");
    values.push(likeTerm(q.search), likeTerm(q.search));
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT ${PO_SELECT} ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM purchase_orders p ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);
  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

purchaseOrderRoutes.get('/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
            COALESCE(SUM(total_amount), 0) AS total_value
     FROM purchase_orders`,
  ).first();
  return ok(c, row ?? {});
});

const poSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: optionalText(2000),
  vendorId: optionalUuid,
  totalAmount: optionalMoney,
  notes: optionalText(2000),
});

purchaseOrderRoutes.post('/', async (c) => {
  const body = await parseJson(c, poSchema);
  const seq = await c.env.DB.prepare(
    `UPDATE counters SET value = value + 1 WHERE name = 'purchase_order' RETURNING value`,
  ).first<{ value: number }>();
  const poNumber = `PO-${new Date().getFullYear()}-${String(seq?.value ?? 1).padStart(5, '0')}`;

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO purchase_orders (id, po_number, title, description, vendor_id, status, total_amount, requested_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
  )
    .bind(id, poNumber, body.title, body.description, body.vendorId, body.totalAmount ?? 0, c.get('user')!.id, body.notes, ts, ts)
    .run();

  await audit(c, 'purchase_order.created', 'purchase_order', id, { poNumber });
  return created(c, await c.env.DB.prepare(`SELECT ${PO_SELECT} WHERE p.id = ?`).bind(id).first());
});

const PO_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  rejected: ['draft'],
  received: [],
  cancelled: [],
};

purchaseOrderRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, poSchema.partial().extend({ status: z.enum(PO_STATUSES).optional() }));

  const po = await c.env.DB.prepare(`SELECT * FROM purchase_orders WHERE id = ?`)
    .bind(id)
    .first<{ id: string; status: string; requested_by: string | null; po_number: string; title: string }>();
  if (!po) throw ApiError.notFound('Purchase order');

  const isOwner = po.requested_by === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) throw ApiError.forbidden();

  if (body.status && body.status !== po.status) {
    if (!(PO_TRANSITIONS[po.status] ?? []).includes(body.status)) {
      throw ApiError.conflict(`A ${po.status} purchase order cannot move to ${body.status}`);
    }
    // Approval decisions are an administrator responsibility and requesters
    // may not approve their own orders.
    if (['approved', 'rejected', 'ordered', 'received'].includes(body.status) && !isAdmin) {
      throw ApiError.forbidden('Only an administrator can perform this transition');
    }
  }
  if (!isAdmin && po.status !== 'draft' && (body.title || body.description || body.totalAmount !== undefined)) {
    throw ApiError.conflict('A submitted purchase order can no longer be edited');
  }

  const map: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    vendor_id: body.vendorId,
    total_amount: body.totalAmount,
    notes: body.notes,
    status: body.status,
  };
  if (body.status === 'approved') {
    map.approved_by = user.id;
    map.approved_at = now();
  }
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  await c.env.DB.prepare(`UPDATE purchase_orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();

  await audit(c, 'purchase_order.updated', 'purchase_order', id, { fields: keys, status: body.status });

  if (body.status === 'pending') {
    for (const admin of await adminIds(c.env)) {
      await notify(c.env, {
        userId: admin,
        title: `Purchase order ${po.po_number} needs approval`,
        message: po.title,
        actionUrl: '/purchase-orders',
        dedupeKey: `po-pending:${id}:${admin}`,
      });
    }
  }
  if ((body.status === 'approved' || body.status === 'rejected') && po.requested_by && po.requested_by !== user.id) {
    await notify(c.env, {
      userId: po.requested_by,
      title: `Purchase order ${po.po_number} ${body.status}`,
      message: po.title,
      actionUrl: '/purchase-orders',
      dedupeKey: `po-${body.status}:${id}`,
    });
  }

  return ok(c, await c.env.DB.prepare(`SELECT ${PO_SELECT} WHERE p.id = ?`).bind(id).first());
});

purchaseOrderRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const po = await c.env.DB.prepare(`SELECT status FROM purchase_orders WHERE id = ?`).bind(id).first<{ status: string }>();
  if (!po) throw ApiError.notFound('Purchase order');
  if (!['draft', 'cancelled', 'rejected'].includes(po.status)) {
    throw ApiError.conflict('Only draft, rejected or cancelled purchase orders can be deleted');
  }
  await c.env.DB.prepare(`DELETE FROM purchase_orders WHERE id = ?`).bind(id).run();
  await audit(c, 'purchase_order.deleted', 'purchase_order', id);
  return ok(c, { success: true });
});
