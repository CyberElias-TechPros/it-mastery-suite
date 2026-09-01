import { Hono } from 'hono';
import { now } from '../lib/db';
import { ok } from '../lib/response';
import { isStaff, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use('*', requireAuth());

/**
 * One round trip for the whole dashboard. Previously the client fired seven
 * parallel requests and stitched the numbers together in the browser; a single
 * aggregated query set is both faster and consistent.
 *
 * The payload is cached in KV for 60s per role+user to keep the D1 read volume
 * predictable as the organisation grows.
 */
dashboardRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const cacheKey = `dashboard:${user.id}`;
  const cached = await c.env.CACHE.get(cacheKey, 'json');
  if (cached) return ok(c, cached, { cached: true });

  const staff = isStaff(user.role);
  const scope = staff ? '1 = 1' : '(created_by = ? OR assigned_to = ?)';
  const ticketValues = staff ? [] : [user.id, user.id];
  const nowIso = now();
  const today = nowIso.slice(0, 10);
  const monthStart = `${nowIso.slice(0, 7)}-01`;
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [tickets, assets, expenses, diesel, misc, recentTickets] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
              SUM(CASE WHEN priority IN ('high','critical') AND status IN ('open','in_progress') THEN 1 ELSE 0 END) AS high_priority,
              SUM(CASE WHEN sla_due_date < ? AND status IN ('open','in_progress') THEN 1 ELSE 0 END) AS overdue
       FROM tickets WHERE ${scope}`,
    )
      .bind(nowIso, ...ticketValues)
      .first<Record<string, number>>(),

    c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance,
              SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) AS retired,
              SUM(CASE WHEN warranty_expiry BETWEEN ? AND ? THEN 1 ELSE 0 END) AS warranty_expiring
       FROM assets WHERE deleted_at IS NULL`,
    )
      .bind(today, in30Days)
      .first<Record<string, number>>(),

    c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN expense_date >= ? THEN amount ELSE 0 END), 0) AS month_to_date,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count
       FROM expenses ${staff ? '' : 'WHERE submitted_by = ?'}`,
    )
      .bind(monthStart, ...(staff ? [] : [user.id]))
      .first<Record<string, number>>(),

    c.env.DB.prepare(
      `SELECT consumed_stock, cost_per_liter, total_cost, date FROM diesel_logs ORDER BY date DESC, created_at DESC LIMIT 1`,
    ).first<{ consumed_stock: number; cost_per_liter: number | null; total_cost: number | null; date: string }>(),

    c.env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM calendar_events WHERE date(start_date) = ?) AS today_events,
         (SELECT COUNT(*) FROM vendors WHERE deleted_at IS NULL AND contract_end_date BETWEEN ? AND ?) AS expiring_contracts,
         (SELECT COALESCE(SUM(view_count), 0) FROM kb_articles WHERE deleted_at IS NULL AND is_published = 1) AS kb_views,
         (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0) AS unread_notifications`,
    )
      .bind(today, today, in30Days, user.id)
      .first<Record<string, number>>(),

    c.env.DB.prepare(
      `SELECT t.id, t.ticket_number, t.title, t.status, t.priority, t.created_at, t.sla_due_date,
              cb.full_name AS created_by_name, ab.full_name AS assigned_to_name
       FROM tickets t
       LEFT JOIN users cb ON cb.id = t.created_by
       LEFT JOIN users ab ON ab.id = t.assigned_to
       WHERE ${scope} ORDER BY t.created_at DESC LIMIT 5`,
    )
      .bind(...ticketValues)
      .all(),
  ]);

  const payload = {
    tickets: {
      total: tickets?.total ?? 0,
      open: tickets?.open ?? 0,
      inProgress: tickets?.in_progress ?? 0,
      resolved: tickets?.resolved ?? 0,
      highPriority: tickets?.high_priority ?? 0,
      overdue: tickets?.overdue ?? 0,
      slaCompliance:
        (tickets?.total ?? 0) > 0
          ? Math.round((((tickets?.total ?? 0) - (tickets?.overdue ?? 0)) / (tickets?.total ?? 1)) * 100)
          : 100,
    },
    assets: {
      total: assets?.total ?? 0,
      active: assets?.active ?? 0,
      maintenance: assets?.maintenance ?? 0,
      retired: assets?.retired ?? 0,
      warrantyExpiring: assets?.warranty_expiring ?? 0,
    },
    finance: {
      monthToDate: expenses?.month_to_date ?? 0,
      pendingAmount: expenses?.pending_amount ?? 0,
      pendingCount: expenses?.pending_count ?? 0,
    },
    diesel: {
      latestConsumption: diesel?.consumed_stock ?? 0,
      latestCost: diesel?.total_cost ?? (diesel ? (diesel.consumed_stock ?? 0) * (diesel.cost_per_liter ?? 0) : 0),
      latestDate: diesel?.date ?? null,
    },
    operations: {
      todayEvents: misc?.today_events ?? 0,
      expiringContracts: misc?.expiring_contracts ?? 0,
      kbViews: misc?.kb_views ?? 0,
      unreadNotifications: misc?.unread_notifications ?? 0,
    },
    recentTickets: recentTickets.results ?? [],
    generatedAt: nowIso,
  };

  // Fire-and-forget cache write; a failure here must not fail the request.
  c.executionCtx.waitUntil(
    c.env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 60 }).catch(() => undefined),
  );

  return ok(c, payload);
});
