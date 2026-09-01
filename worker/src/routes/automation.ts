import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now, parseJsonColumn } from '../lib/db';
import { audit } from '../lib/audit';
import { created, ok } from '../lib/response';
import { optionalText, paginationSchema, parseJson, parseQuery } from '../lib/validation';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AppEnv } from '../types';

export const automationRoutes = new Hono<AppEnv>();
automationRoutes.use('*', requireAuth());

const TRIGGERS = [
  'ticket_created',
  'ticket_updated',
  'asset_registered',
  'expense_added',
  'diesel_low',
  'contract_expiring',
  'user_registered',
] as const;

const ACTION_TYPES = ['assign_technician', 'send_notification', 'escalate_ticket', 'update_status', 'create_task'] as const;

const ruleSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: optionalText(500),
  triggerEvent: z.enum(TRIGGERS),
  conditions: z
    .array(
      z.object({
        field: z.string().trim().min(1).max(60),
        operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'between']),
        value: z.union([z.string().max(200), z.number()]),
        secondValue: z.union([z.string().max(200), z.number()]).optional(),
      }),
    )
    .max(10)
    .default([]),
  actions: z
    .array(z.object({ type: z.enum(ACTION_TYPES), config: z.record(z.unknown()).default({}) }))
    .min(1, 'Add at least one action')
    .max(5),
  isActive: z.boolean().default(true),
});

const shape = (row: { conditions: string; actions: string; is_active: number } & Record<string, unknown>) => ({
  ...row,
  conditions: parseJsonColumn(row.conditions, []),
  actions: parseJsonColumn(row.actions, []),
  is_active: row.is_active === 1,
});

automationRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM automation_executions e WHERE e.rule_id = r.id) AS execution_count
     FROM automation_rules r LEFT JOIN users u ON u.id = r.created_by
     ORDER BY r.created_at DESC`,
  ).all<{ conditions: string; actions: string; is_active: number }>();
  return ok(c, (results ?? []).map(shape));
});

automationRoutes.get('/executions', async (c) => {
  const q = parseQuery(c, paginationSchema.extend({ ruleId: z.string().uuid().optional() }));
  const where = q.ruleId ? 'WHERE e.rule_id = ?' : '';
  const values = q.ruleId ? [q.ruleId] : [];
  const { results } = await c.env.DB.prepare(
    `SELECT e.*, r.name AS rule_name FROM automation_executions e
     LEFT JOIN automation_rules r ON r.id = e.rule_id
     ${where} ORDER BY e.executed_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...values, q.pageSize, (q.page - 1) * q.pageSize)
    .all<{ trigger_data: string; result: string }>();

  return ok(
    c,
    (results ?? []).map((r) => ({
      ...r,
      trigger_data: parseJsonColumn(r.trigger_data, {}),
      result: parseJsonColumn(r.result, []),
    })),
  );
});

automationRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await parseJson(c, ruleSchema);
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO automation_rules (id, name, description, trigger_event, conditions, actions, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.name,
      body.description,
      body.triggerEvent,
      JSON.stringify(body.conditions),
      JSON.stringify(body.actions),
      body.isActive ? 1 : 0,
      c.get('user')!.id,
      ts,
      ts,
    )
    .run();
  await audit(c, 'automation.created', 'automation_rule', id, { name: body.name, trigger: body.triggerEvent });
  const row = await c.env.DB.prepare(`SELECT * FROM automation_rules WHERE id = ?`).bind(id).first<never>();
  return created(c, shape(row!));
});

automationRoutes.put('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c, ruleSchema.partial());
  const map: Record<string, unknown> = {
    name: body.name,
    description: body.description,
    trigger_event: body.triggerEvent,
    conditions: body.conditions ? JSON.stringify(body.conditions) : undefined,
    actions: body.actions ? JSON.stringify(body.actions) : undefined,
    is_active: body.isActive === undefined ? undefined : body.isActive ? 1 : 0,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  const result = await c.env.DB.prepare(`UPDATE automation_rules SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();
  if (!result.meta.changes) throw ApiError.notFound('Automation rule');
  await audit(c, 'automation.updated', 'automation_rule', id, { fields: keys });
  const row = await c.env.DB.prepare(`SELECT * FROM automation_rules WHERE id = ?`).bind(id).first<never>();
  return ok(c, shape(row!));
});

automationRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`DELETE FROM automation_rules WHERE id = ?`).bind(id).run();
  if (!result.meta.changes) throw ApiError.notFound('Automation rule');
  await audit(c, 'automation.deleted', 'automation_rule', id);
  return ok(c, { success: true });
});
