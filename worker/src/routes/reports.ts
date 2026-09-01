import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now, parseJsonColumn } from '../lib/db';
import { audit } from '../lib/audit';
import { created, ok } from '../lib/response';
import { optionalText, parseJson } from '../lib/validation';
import { isStaff, requireAuth } from '../middleware/auth';
import type { AppEnv, Env, Role } from '../types';

export const reportRoutes = new Hono<AppEnv>();
reportRoutes.use('*', requireAuth());

/* -------------------------------------------------------------------------- */
/* Dataset catalogue                                                           */
/* -------------------------------------------------------------------------- */
/**
 * Reports are executed against a fixed catalogue of datasets and columns.
 * Nothing from the request is ever interpolated into SQL — the field, filter
 * and sort names are resolved through these maps, values stay parameterised.
 */
interface Dataset {
  label: string;
  from: string;
  /** field id -> SQL expression */
  fields: Record<string, { label: string; sql: string; type: 'string' | 'number' | 'date' }>;
  /** Extra WHERE applied for non-staff users, with a `?` bound to the user id. */
  restrictedTo?: string;
  staffOnly?: boolean;
}

export const DATASETS: Record<string, Dataset> = {
  tickets: {
    label: 'Tickets',
    from: `tickets t LEFT JOIN users cb ON cb.id = t.created_by LEFT JOIN users ab ON ab.id = t.assigned_to`,
    fields: {
      ticket_number: { label: 'Ticket Number', sql: 't.ticket_number', type: 'string' },
      title: { label: 'Title', sql: 't.title', type: 'string' },
      status: { label: 'Status', sql: 't.status', type: 'string' },
      priority: { label: 'Priority', sql: 't.priority', type: 'string' },
      category: { label: 'Category', sql: 't.category', type: 'string' },
      created_by_name: { label: 'Created By', sql: 'cb.full_name', type: 'string' },
      assigned_to_name: { label: 'Assigned To', sql: 'ab.full_name', type: 'string' },
      created_at: { label: 'Created Date', sql: 't.created_at', type: 'date' },
      resolved_at: { label: 'Resolved Date', sql: 't.resolved_at', type: 'date' },
      sla_due_date: { label: 'SLA Due', sql: 't.sla_due_date', type: 'date' },
    },
    restrictedTo: '(t.created_by = ? OR t.assigned_to = ?)',
  },
  assets: {
    label: 'Assets',
    from: `assets a LEFT JOIN users u ON u.id = a.assigned_to LEFT JOIN branches b ON b.id = a.branch_id`,
    fields: {
      asset_tag: { label: 'Asset Tag', sql: 'a.asset_tag', type: 'string' },
      name: { label: 'Asset Name', sql: 'a.name', type: 'string' },
      category: { label: 'Category', sql: 'a.category', type: 'string' },
      status: { label: 'Status', sql: 'a.status', type: 'string' },
      purchase_cost: { label: 'Purchase Cost', sql: 'a.purchase_cost', type: 'number' },
      purchase_date: { label: 'Purchase Date', sql: 'a.purchase_date', type: 'date' },
      warranty_expiry: { label: 'Warranty Expiry', sql: 'a.warranty_expiry', type: 'date' },
      assigned_to_name: { label: 'Assigned To', sql: 'u.full_name', type: 'string' },
      branch_name: { label: 'Branch', sql: 'b.name', type: 'string' },
    },
  },
  expenses: {
    label: 'Expenses',
    from: `expenses e LEFT JOIN users s ON s.id = e.submitted_by LEFT JOIN vendors v ON v.id = e.vendor_id LEFT JOIN branches b ON b.id = e.branch_id`,
    fields: {
      title: { label: 'Title', sql: 'e.title', type: 'string' },
      amount: { label: 'Amount', sql: 'e.amount', type: 'number' },
      category: { label: 'Category', sql: 'e.category', type: 'string' },
      status: { label: 'Status', sql: 'e.status', type: 'string' },
      expense_date: { label: 'Expense Date', sql: 'e.expense_date', type: 'date' },
      submitted_by_name: { label: 'Submitted By', sql: 's.full_name', type: 'string' },
      vendor_name: { label: 'Vendor', sql: 'v.name', type: 'string' },
      branch_name: { label: 'Branch', sql: 'b.name', type: 'string' },
    },
    restrictedTo: 'e.submitted_by = ?',
  },
  diesel: {
    label: 'Diesel',
    from: `diesel_logs l LEFT JOIN branches b ON b.id = l.branch_id LEFT JOIN users u ON u.id = l.recorded_by`,
    fields: {
      date: { label: 'Date', sql: 'l.date', type: 'date' },
      branch_name: { label: 'Branch', sql: 'b.name', type: 'string' },
      consumed_stock: { label: 'Consumed (L)', sql: 'l.consumed_stock', type: 'number' },
      running_hours: { label: 'Running Hours', sql: 'l.running_hours', type: 'number' },
      total_cost: { label: 'Total Cost', sql: 'l.total_cost', type: 'number' },
      recorded_by_name: { label: 'Recorded By', sql: 'u.full_name', type: 'string' },
    },
  },
  vendors: {
    label: 'Vendors',
    from: `vendors v`,
    fields: {
      name: { label: 'Vendor', sql: 'v.name', type: 'string' },
      service_type: { label: 'Service Type', sql: 'v.service_type', type: 'string' },
      contract_start_date: { label: 'Contract Start', sql: 'v.contract_start_date', type: 'date' },
      contract_end_date: { label: 'Contract End', sql: 'v.contract_end_date', type: 'date' },
      contract_value: { label: 'Contract Value', sql: 'v.contract_value', type: 'number' },
      rating: { label: 'Rating', sql: 'v.rating', type: 'number' },
    },
  },
  users: {
    label: 'Users',
    from: `users u LEFT JOIN branches b ON b.id = u.branch_id LEFT JOIN departments d ON d.id = u.department_id`,
    staffOnly: true,
    fields: {
      full_name: { label: 'Name', sql: 'u.full_name', type: 'string' },
      email: { label: 'Email', sql: 'u.email', type: 'string' },
      role: { label: 'Role', sql: 'u.role', type: 'string' },
      branch_name: { label: 'Branch', sql: 'b.name', type: 'string' },
      department_name: { label: 'Department', sql: 'd.name', type: 'string' },
      created_at: { label: 'Joined', sql: 'u.created_at', type: 'date' },
      last_login_at: { label: 'Last Login', sql: 'u.last_login_at', type: 'date' },
    },
  },
};

const OPERATORS = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'LIKE',
} as const;

const configSchema = z.object({
  dataset: z.enum(Object.keys(DATASETS) as [string, ...string[]]),
  fields: z.array(z.string().max(60)).min(1, 'Select at least one field').max(20),
  filters: z
    .array(
      z.object({
        field: z.string().max(60),
        operator: z.enum(Object.keys(OPERATORS) as [keyof typeof OPERATORS, ...(keyof typeof OPERATORS)[]]),
        value: z.union([z.string().max(200), z.number(), z.boolean()]),
      }),
    )
    .max(10)
    .default([]),
  sort: z.object({ field: z.string().max(60), direction: z.enum(['asc', 'desc']) }).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export type ReportConfig = z.infer<typeof configSchema>;

interface ExecutionResult {
  columns: { id: string; label: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export async function runReport(env: Env, config: ReportConfig, user: { id: string; role: Role }): Promise<ExecutionResult> {
  const dataset = DATASETS[config.dataset];
  if (!dataset) throw ApiError.badRequest('Unknown dataset');
  if (dataset.staffOnly && !isStaff(user.role)) throw ApiError.forbidden('This dataset is restricted');

  const fields = config.fields.filter((f) => dataset.fields[f]);
  if (!fields.length) throw ApiError.validation({ fields: ['Select at least one valid field'] });

  const where: string[] = ['1 = 1'];
  const values: unknown[] = [];

  if (dataset.restrictedTo && !isStaff(user.role)) {
    where.push(dataset.restrictedTo);
    const placeholders = (dataset.restrictedTo.match(/\?/g) ?? []).length;
    for (let i = 0; i < placeholders; i++) values.push(user.id);
  }
  if (dataset.from.startsWith('assets')) where.push('a.deleted_at IS NULL');
  if (dataset.from.startsWith('vendors')) where.push('v.deleted_at IS NULL');
  if (dataset.from.startsWith('users')) where.push('u.deleted_at IS NULL');

  for (const filter of config.filters) {
    const column = dataset.fields[filter.field];
    if (!column) continue;
    const operator = OPERATORS[filter.operator];
    if (operator === 'LIKE') {
      where.push(`${column.sql} LIKE ?`);
      values.push(`%${String(filter.value)}%`);
    } else {
      where.push(`${column.sql} ${operator} ?`);
      values.push(filter.value);
    }
  }

  const sortField = config.sort && dataset.fields[config.sort.field] ? dataset.fields[config.sort.field].sql : null;
  const orderSql = sortField ? `ORDER BY ${sortField} ${config.sort!.direction === 'asc' ? 'ASC' : 'DESC'}` : '';

  const selectSql = fields.map((f) => `${dataset.fields[f].sql} AS "${f}"`).join(', ');
  const { results } = await env.DB.prepare(
    `SELECT ${selectSql} FROM ${dataset.from} WHERE ${where.join(' AND ')} ${orderSql} LIMIT ?`,
  )
    .bind(...values, config.limit)
    .all<Record<string, unknown>>();

  return {
    columns: fields.map((f) => ({ id: f, label: dataset.fields[f].label })),
    rows: results ?? [],
    rowCount: results?.length ?? 0,
  };
}

function toCsv(result: ExecutionResult): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    // Guard against CSV formula injection in spreadsheet apps.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = result.columns.map((col) => escape(col.label)).join(',');
  const body = result.rows.map((row) => result.columns.map((col) => escape(row[col.id])).join(','));
  return [header, ...body].join('\r\n');
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

reportRoutes.get('/datasets', (c) =>
  ok(
    c,
    Object.entries(DATASETS)
      .filter(([, d]) => !d.staffOnly || isStaff(c.get('user')!.role))
      .map(([id, d]) => ({
        id,
        label: d.label,
        fields: Object.entries(d.fields).map(([fieldId, f]) => ({ id: fieldId, label: f.label, type: f.type })),
      })),
  ),
);

reportRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, u.full_name AS created_by_name FROM custom_reports r
     LEFT JOIN users u ON u.id = r.created_by
     WHERE r.created_by = ? OR ? = 'admin'
     ORDER BY r.created_at DESC LIMIT 200`,
  )
    .bind(user.id, user.role)
    .all<{ config: string }>();
  return ok(c, (results ?? []).map((r) => ({ ...r, config: parseJsonColumn(r.config, {}) })));
});

const saveSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: optionalText(500),
  config: configSchema,
});

reportRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await parseJson(c, saveSchema);
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO custom_reports (id, name, description, config, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.name, body.description, JSON.stringify(body.config), user.id, ts, ts)
    .run();
  await audit(c, 'report.created', 'custom_report', id, { name: body.name });
  const row = await c.env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`).bind(id).first<{ config: string }>();
  return created(c, { ...row, config: parseJsonColumn(row!.config, {}) });
});

reportRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, saveSchema.partial());
  const report = await c.env.DB.prepare(`SELECT created_by FROM custom_reports WHERE id = ?`)
    .bind(id)
    .first<{ created_by: string }>();
  if (!report) throw ApiError.notFound('Report');
  if (report.created_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  const map: Record<string, unknown> = {
    name: body.name,
    description: body.description,
    config: body.config ? JSON.stringify(body.config) : undefined,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');
  await c.env.DB.prepare(`UPDATE custom_reports SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();
  await audit(c, 'report.updated', 'custom_report', id);
  const row = await c.env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`).bind(id).first<{ config: string }>();
  return ok(c, { ...row, config: parseJsonColumn(row!.config, {}) });
});

reportRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const report = await c.env.DB.prepare(`SELECT created_by FROM custom_reports WHERE id = ?`)
    .bind(id)
    .first<{ created_by: string }>();
  if (!report) throw ApiError.notFound('Report');
  if (report.created_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();
  await c.env.DB.prepare(`DELETE FROM custom_reports WHERE id = ?`).bind(id).run();
  await audit(c, 'report.deleted', 'custom_report', id);
  return ok(c, { success: true });
});

/** Ad-hoc preview (report builder) */
reportRoutes.post('/run', async (c) => {
  const config = await parseJson(c, configSchema);
  const result = await runReport(c.env, config, c.get('user')!);
  return ok(c, result);
});

/** Execute a saved report, optionally exporting CSV. */
reportRoutes.get('/:id/run', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const format = new URL(c.req.url).searchParams.get('format');

  const report = await c.env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`)
    .bind(id)
    .first<{ id: string; name: string; config: string; created_by: string }>();
  if (!report) throw ApiError.notFound('Report');
  if (report.created_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  const parsed = configSchema.safeParse(parseJsonColumn(report.config, {}));
  if (!parsed.success) throw ApiError.badRequest('This report has an invalid configuration and must be rebuilt');

  const result = await runReport(c.env, parsed.data, user);
  await c.env.DB.prepare(`UPDATE custom_reports SET last_run_at = ? WHERE id = ?`).bind(now(), id).run();
  await audit(c, 'report.executed', 'custom_report', id, { rows: result.rowCount, format: format ?? 'json' });

  if (format === 'csv') {
    const filename = `${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(toCsv(result), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  }
  return ok(c, result);
});
