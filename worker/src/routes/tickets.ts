import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { notify } from '../lib/notifications';
import { runAutomation } from '../lib/automation';
import { created, ok, pageMeta } from '../lib/response';
import { likeTerm, optionalUuid, paginationSchema, parseJson, parseQuery, resolveSort } from '../lib/validation';
import { isStaff, requireAuth } from '../middleware/auth';
import type { AppEnv, Env, Role } from '../types';

export const ticketRoutes = new Hono<AppEnv>();
ticketRoutes.use('*', requireAuth());

/** Response-time targets per priority, in hours. */
const SLA_HOURS: Record<string, number> = { critical: 4, high: 8, medium: 24, low: 72 };

const TICKET_SELECT = `
  t.*,
  cb.full_name AS created_by_name, cb.email AS created_by_email, cb.avatar_url AS created_by_avatar,
  ab.full_name AS assigned_to_name, ab.email AS assigned_to_email, ab.avatar_url AS assigned_to_avatar
`;
const TICKET_JOINS = `
  FROM tickets t
  LEFT JOIN users cb ON cb.id = t.created_by
  LEFT JOIN users ab ON ab.id = t.assigned_to
`;

interface TicketRow {
  id: string;
  ticket_number: string;
  status: string;
  priority: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  [key: string]: unknown;
}

/** Employees only ever see tickets they raised or are assigned to. */
function visibilityClause(role: Role): { sql: string; needsUser: boolean } {
  if (isStaff(role)) return { sql: '1 = 1', needsUser: false };
  return { sql: '(t.created_by = ? OR t.assigned_to = ?)', needsUser: true };
}

async function loadTicket(env: Env, id: string): Promise<TicketRow | null> {
  return env.DB.prepare(`SELECT ${TICKET_SELECT} ${TICKET_JOINS} WHERE t.id = ?`).bind(id).first<TicketRow>();
}

function assertCanView(ticket: TicketRow, userId: string, role: Role): void {
  if (isStaff(role)) return;
  if (ticket.created_by === userId || ticket.assigned_to === userId) return;
  throw ApiError.notFound('Ticket');
}

const listQuery = paginationSchema.extend({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z.enum(['it_support', 'software', 'hardware', 'network', 'other']).optional(),
  assignedTo: z.union([z.string().uuid(), z.literal('unassigned'), z.literal('me')]).optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  overdue: z.enum(['true']).optional(),
  sort: z.enum(['created_at', 'updated_at', 'priority', 'status', 'ticket_number']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

ticketRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const q = parseQuery(c, listQuery);

  const where: string[] = [];
  const values: unknown[] = [];

  const visibility = visibilityClause(user.role);
  where.push(visibility.sql);
  if (visibility.needsUser) values.push(user.id, user.id);

  if (q.status) {
    where.push('t.status = ?');
    values.push(q.status);
  }
  if (q.priority) {
    where.push('t.priority = ?');
    values.push(q.priority);
  }
  if (q.category) {
    where.push('t.category = ?');
    values.push(q.category);
  }
  if (q.assignedTo === 'unassigned') {
    where.push('t.assigned_to IS NULL');
  } else if (q.assignedTo === 'me') {
    where.push('t.assigned_to = ?');
    values.push(user.id);
  } else if (q.assignedTo) {
    where.push('t.assigned_to = ?');
    values.push(q.assignedTo);
  }
  if (q.createdBy) {
    where.push('t.created_by = ?');
    values.push(q.createdBy);
  }
  if (q.overdue === 'true') {
    where.push("t.sla_due_date IS NOT NULL AND t.sla_due_date < ? AND t.status IN ('open','in_progress')");
    values.push(now());
  }
  if (q.search) {
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' OR t.ticket_number LIKE ? ESCAPE '\\')");
    values.push(likeTerm(q.search), likeTerm(q.search), likeTerm(q.search));
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sortColumn = resolveSort(q.sort, ['created_at', 'updated_at', 'priority', 'status', 'ticket_number'], 'created_at');
  // Priority is stored as text; order it semantically rather than alphabetically.
  const orderExpr =
    sortColumn === 'priority'
      ? `CASE t.priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`
      : `t.${sortColumn}`;
  const direction = q.direction === 'asc' ? 'ASC' : 'DESC';
  const offset = (q.page - 1) * q.pageSize;

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(`SELECT ${TICKET_SELECT} ${TICKET_JOINS} ${whereSql} ORDER BY ${orderExpr} ${direction} LIMIT ? OFFSET ?`)
      .bind(...values, q.pageSize, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM tickets t ${whereSql}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  return ok(c, rows.results ?? [], pageMeta(q.page, q.pageSize, count?.total ?? 0));
});

ticketRoutes.get('/stats', async (c) => {
  const user = c.get('user')!;
  const visibility = visibilityClause(user.role);
  const values = visibility.needsUser ? [user.id, user.id] : [];

  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total_tickets,
       SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_tickets,
       SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
       SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed,
       SUM(CASE WHEN t.priority IN ('high','critical') AND t.status IN ('open','in_progress') THEN 1 ELSE 0 END) AS high_priority,
       SUM(CASE WHEN t.sla_due_date IS NOT NULL AND t.sla_due_date < '${now()}' AND t.status IN ('open','in_progress') THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN t.assigned_to IS NULL AND t.status IN ('open','in_progress') THEN 1 ELSE 0 END) AS unassigned
     FROM tickets t WHERE ${visibility.sql}`,
  )
    .bind(...values)
    .first<Record<string, number>>();

  return ok(c, {
    total_tickets: row?.total_tickets ?? 0,
    open_tickets: row?.open_tickets ?? 0,
    in_progress: row?.in_progress ?? 0,
    resolved: row?.resolved ?? 0,
    closed: row?.closed ?? 0,
    high_priority: row?.high_priority ?? 0,
    overdue: row?.overdue ?? 0,
    unassigned: row?.unassigned ?? 0,
  });
});

ticketRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const ticket = await loadTicket(c.env, c.req.param('id'));
  if (!ticket) throw ApiError.notFound('Ticket');
  assertCanView(ticket, user.id, user.role);
  return ok(c, ticket);
});

const createSchema = z.object({
  title: z.string().trim().min(5, 'Give the issue a descriptive title').max(200),
  description: z.string().trim().min(10, 'Describe the issue in at least 10 characters').max(10_000),
  category: z.enum(['it_support', 'software', 'hardware', 'network', 'other']).default('it_support'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assignedTo: optionalUuid,
  branchId: optionalUuid,
  assetId: optionalUuid,
});

ticketRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await parseJson(c, createSchema);

  // Only staff may create a ticket that is already assigned.
  const assignedTo = isStaff(user.role) ? body.assignedTo ?? null : null;

  const seq = await c.env.DB.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'ticket' RETURNING value`).first<{
    value: number;
  }>();
  const ticketNumber = `TKT-${String(seq?.value ?? 1).padStart(6, '0')}`;

  const id = newId();
  const ts = now();
  const slaDue = new Date(Date.now() + (SLA_HOURS[body.priority] ?? 24) * 3600 * 1000).toISOString();

  await c.env.DB.prepare(
    `INSERT INTO tickets (id, ticket_number, title, description, category, priority, status, created_by, assigned_to, branch_id, asset_id, sla_due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      ticketNumber,
      body.title,
      body.description,
      body.category,
      body.priority,
      user.id,
      assignedTo,
      body.branchId ?? null,
      body.assetId ?? null,
      slaDue,
      ts,
      ts,
    )
    .run();

  await audit(c, 'ticket.created', 'ticket', id, { ticketNumber, priority: body.priority });

  if (assignedTo && assignedTo !== user.id) {
    await notify(c.env, {
      userId: assignedTo,
      title: `Ticket ${ticketNumber} assigned to you`,
      message: body.title,
      type: 'ticket_assigned',
      relatedTicketId: id,
      actionUrl: `/tickets/${id}`,
      dedupeKey: `ticket-assigned:${id}:${assignedTo}`,
    });
  }

  const createdTicket = await loadTicket(c.env, id);
  c.executionCtx.waitUntil(runAutomation(c.env, 'ticket_created', { ...(createdTicket as Record<string, unknown>) }));
  return created(c, createdTicket);
});

const updateSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  category: z.enum(['it_support', 'software', 'hardware', 'network', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assignedTo: optionalUuid,
  resolution: z.union([z.string().trim().max(5000), z.literal(''), z.null()]).optional(),
});

/** Allowed status transitions — prevents impossible lifecycle states. */
const TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['open', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
};

ticketRoutes.put('/:id', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await parseJson(c, updateSchema);

  const ticket = await loadTicket(c.env, id);
  if (!ticket) throw ApiError.notFound('Ticket');
  assertCanView(ticket, user.id, user.role);

  const staff = isStaff(user.role);
  const isReporter = ticket.created_by === user.id;

  // Reporters may correct their own open ticket or close it; everything else
  // (assignment, priority, status workflow) is staff-only.
  if (!staff) {
    const allowed = ['title', 'description', 'status'] as const;
    const attempted = Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined);
    if (!isReporter || attempted.some((k) => !allowed.includes(k as (typeof allowed)[number]))) {
      throw ApiError.forbidden('Only support staff can change this ticket');
    }
    if (body.status && body.status !== 'closed') {
      throw ApiError.forbidden('You can only close your own ticket');
    }
    if ((body.title || body.description) && ticket.status !== 'open') {
      throw ApiError.conflict('This ticket can no longer be edited');
    }
  }

  if (body.status && body.status !== ticket.status) {
    const allowed = TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw ApiError.conflict(`A ${ticket.status} ticket cannot move to ${body.status}`);
    }
  }

  const patch: Record<string, unknown> = { updated_at: now() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.category !== undefined) patch.category = body.category;
  if (body.resolution !== undefined) patch.resolution = body.resolution || null;
  if (body.assignedTo !== undefined) patch.assigned_to = body.assignedTo;

  if (body.priority !== undefined && body.priority !== ticket.priority) {
    patch.priority = body.priority;
    // Re-base the SLA clock on the original creation time.
    const createdAt = new Date(String(ticket.created_at)).getTime();
    patch.sla_due_date = new Date(createdAt + (SLA_HOURS[body.priority] ?? 24) * 3600 * 1000).toISOString();
  }

  if (body.status !== undefined && body.status !== ticket.status) {
    patch.status = body.status;
    patch.resolved_at = body.status === 'resolved' ? now() : body.status === 'closed' ? ticket.resolved_at ?? now() : null;
    patch.closed_at = body.status === 'closed' ? now() : null;
  }

  const keys = Object.keys(patch);
  await c.env.DB.prepare(`UPDATE tickets SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => patch[k]), id)
    .run();

  await audit(c, 'ticket.updated', 'ticket', id, { fields: keys.filter((k) => k !== 'updated_at') });

  // Notifications for the state changes people actually care about.
  if (patch.assigned_to && patch.assigned_to !== ticket.assigned_to && patch.assigned_to !== user.id) {
    await notify(c.env, {
      userId: String(patch.assigned_to),
      title: `Ticket ${ticket.ticket_number} assigned to you`,
      message: String(patch.title ?? ticket.title),
      type: 'ticket_assigned',
      relatedTicketId: id,
      actionUrl: `/tickets/${id}`,
      dedupeKey: `ticket-assigned:${id}:${patch.assigned_to}`,
    });
  }
  if (patch.status && ticket.created_by !== user.id) {
    await notify(c.env, {
      userId: ticket.created_by,
      title: `Ticket ${ticket.ticket_number} is now ${String(patch.status).replace('_', ' ')}`,
      message: String(ticket.title),
      type: patch.status === 'resolved' ? 'ticket_resolved' : 'ticket_updated',
      relatedTicketId: id,
      actionUrl: `/tickets/${id}`,
      dedupeKey: `ticket-status:${id}:${patch.status}`,
    });
  }

  const updated = await loadTicket(c.env, id);
  c.executionCtx.waitUntil(runAutomation(c.env, 'ticket_updated', { ...(updated as Record<string, unknown>) }));
  return ok(c, updated);
});

/* -------------------------------------------------------------------------- */
/* Comments                                                                    */
/* -------------------------------------------------------------------------- */

ticketRoutes.get('/:id/comments', async (c) => {
  const user = c.get('user')!;
  const ticket = await loadTicket(c.env, c.req.param('id'));
  if (!ticket) throw ApiError.notFound('Ticket');
  assertCanView(ticket, user.id, user.role);

  // Internal notes are never sent to the requester.
  const internalClause = isStaff(user.role) ? '' : 'AND cm.is_internal = 0';
  const { results } = await c.env.DB.prepare(
    `SELECT cm.*, u.full_name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar
     FROM ticket_comments cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.ticket_id = ? ${internalClause}
     ORDER BY cm.created_at ASC`,
  )
    .bind(ticket.id)
    .all();

  return ok(c, results ?? []);
});

ticketRoutes.post('/:id/comments', async (c) => {
  const user = c.get('user')!;
  const body = await parseJson(
    c,
    z.object({
      comment: z.string().trim().min(1, 'Write a comment first').max(5000),
      isInternal: z.boolean().default(false),
    }),
  );

  const ticket = await loadTicket(c.env, c.req.param('id'));
  if (!ticket) throw ApiError.notFound('Ticket');
  assertCanView(ticket, user.id, user.role);
  if (body.isInternal && !isStaff(user.role)) throw ApiError.forbidden('Only staff can add internal notes');
  if (ticket.status === 'closed') throw ApiError.conflict('This ticket is closed');

  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO ticket_comments (id, ticket_id, user_id, comment, is_internal, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, ticket.id, user.id, body.comment, body.isInternal ? 1 : 0, now())
    .run();
  await c.env.DB.prepare(`UPDATE tickets SET updated_at = ? WHERE id = ?`).bind(now(), ticket.id).run();

  await audit(c, 'ticket.comment_added', 'ticket', ticket.id, { commentId: id, internal: body.isInternal });

  // Tell the other party there is a new public reply.
  if (!body.isInternal) {
    const recipients = new Set<string>([ticket.created_by, ...(ticket.assigned_to ? [ticket.assigned_to] : [])]);
    recipients.delete(user.id);
    for (const recipient of recipients) {
      await notify(c.env, {
        userId: recipient,
        title: `New comment on ${ticket.ticket_number}`,
        message: body.comment.slice(0, 140),
        type: 'ticket_updated',
        relatedTicketId: ticket.id,
        actionUrl: `/tickets/${ticket.id}`,
        dedupeKey: `ticket-comment:${id}:${recipient}`,
      });
    }
  }

  const row = await c.env.DB.prepare(
    `SELECT cm.*, u.full_name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar
     FROM ticket_comments cm LEFT JOIN users u ON u.id = cm.user_id WHERE cm.id = ?`,
  )
    .bind(id)
    .first();

  return created(c, row);
});
