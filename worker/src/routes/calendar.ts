import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { newId, now, parseJsonColumn } from '../lib/db';
import { audit } from '../lib/audit';
import { notify } from '../lib/notifications';
import { created, ok } from '../lib/response';
import { optionalText, optionalUuid, parseJson, parseQuery } from '../lib/validation';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

export const calendarRoutes = new Hono<AppEnv>();
calendarRoutes.use('*', requireAuth());

const SELECT = `
  e.*, u.full_name AS created_by_name, t.ticket_number AS related_ticket_number
  FROM calendar_events e
  LEFT JOIN users u ON u.id = e.created_by
  LEFT JOIN tickets t ON t.id = e.related_ticket_id
`;

interface EventRow {
  attendees: string;
  all_day: number;
  [key: string]: unknown;
}

const shape = (row: EventRow | null) =>
  row && { ...row, attendees: parseJsonColumn<string[]>(row.attendees, []), all_day: row.all_day === 1 };

calendarRoutes.get('/', async (c) => {
  const q = parseQuery(
    c,
    z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
      eventType: z.enum(['maintenance', 'meeting', 'deadline', 'other']).optional(),
      mine: z.enum(['true']).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(200),
    }),
  );

  const where = ['1 = 1'];
  const values: unknown[] = [];
  if (q.start) {
    where.push('e.end_date >= ?');
    values.push(q.start);
  }
  if (q.end) {
    where.push('e.start_date <= ?');
    values.push(q.end);
  }
  if (q.eventType) {
    where.push('e.event_type = ?');
    values.push(q.eventType);
  }
  if (q.mine === 'true') {
    where.push("(e.created_by = ? OR e.attendees LIKE ? ESCAPE '\\')");
    values.push(c.get('user')!.id, `%"${c.get('user')!.id}"%`);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.start_date ASC LIMIT ?`,
  )
    .bind(...values, q.limit)
    .all<EventRow>();

  return ok(c, (results ?? []).map(shape));
});

const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: optionalText(2000),
    startDate: z.string().datetime({ offset: true }).or(z.string().datetime()),
    endDate: z.string().datetime({ offset: true }).or(z.string().datetime()),
    eventType: z.enum(['maintenance', 'meeting', 'deadline', 'other']).default('other'),
    allDay: z.boolean().default(false),
    location: optionalText(200),
    attendees: z.array(z.string().uuid()).max(100).default([]),
    relatedTicketId: optionalUuid,
    reminderMinutes: z.coerce.number().int().min(0).max(10_080).default(15),
  })
  .refine((v) => new Date(v.endDate) > new Date(v.startDate), {
    message: 'The event must end after it starts',
    path: ['endDate'],
  });

calendarRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await parseJson(c, eventSchema);

  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO calendar_events (id, title, description, start_date, end_date, event_type, all_day, location, attendees,
                                  created_by, related_ticket_id, reminder_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.title,
      body.description,
      body.startDate,
      body.endDate,
      body.eventType,
      body.allDay ? 1 : 0,
      body.location,
      JSON.stringify(body.attendees),
      user.id,
      body.relatedTicketId,
      body.reminderMinutes,
      ts,
      ts,
    )
    .run();

  await audit(c, 'calendar.created', 'calendar_event', id, { title: body.title });
  for (const attendee of body.attendees.filter((a) => a !== user.id)) {
    await notify(c.env, {
      userId: attendee,
      title: `You were invited to "${body.title}"`,
      message: new Date(body.startDate).toUTCString(),
      actionUrl: '/calendar',
      dedupeKey: `event-invite:${id}:${attendee}`,
    });
  }

  return created(c, shape(await c.env.DB.prepare(`SELECT ${SELECT} WHERE e.id = ?`).bind(id).first<EventRow>()));
});

calendarRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const body = await parseJson(c, eventSchema.innerType().partial());

  const event = await c.env.DB.prepare(`SELECT * FROM calendar_events WHERE id = ?`)
    .bind(id)
    .first<{ created_by: string; start_date: string; end_date: string }>();
  if (!event) throw ApiError.notFound('Event');
  if (event.created_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  const start = body.startDate ?? event.start_date;
  const end = body.endDate ?? event.end_date;
  if (new Date(end) <= new Date(start)) {
    throw ApiError.validation({ endDate: ['The event must end after it starts'] });
  }

  const map: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    start_date: body.startDate,
    end_date: body.endDate,
    event_type: body.eventType,
    all_day: body.allDay === undefined ? undefined : body.allDay ? 1 : 0,
    location: body.location,
    attendees: body.attendees ? JSON.stringify(body.attendees) : undefined,
    related_ticket_id: body.relatedTicketId,
    reminder_minutes: body.reminderMinutes,
  };
  const keys = Object.keys(map).filter((k) => map[k] !== undefined);
  if (!keys.length) throw ApiError.badRequest('No changes supplied');
  map.updated_at = now();
  keys.push('updated_at');

  await c.env.DB.prepare(`UPDATE calendar_events SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => map[k]), id)
    .run();
  await audit(c, 'calendar.updated', 'calendar_event', id, { fields: keys });
  return ok(c, shape(await c.env.DB.prepare(`SELECT ${SELECT} WHERE e.id = ?`).bind(id).first<EventRow>()));
});

calendarRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const event = await c.env.DB.prepare(`SELECT created_by FROM calendar_events WHERE id = ?`)
    .bind(id)
    .first<{ created_by: string }>();
  if (!event) throw ApiError.notFound('Event');
  if (event.created_by !== user.id && user.role !== 'admin') throw ApiError.forbidden();

  await c.env.DB.prepare(`DELETE FROM calendar_events WHERE id = ?`).bind(id).run();
  await audit(c, 'calendar.deleted', 'calendar_event', id);
  return ok(c, { success: true });
});
