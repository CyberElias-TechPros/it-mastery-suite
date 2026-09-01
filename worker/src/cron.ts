import { newId, now } from './lib/db';
import { log } from './lib/logger';
import { notify } from './lib/notifications';
import { runAutomation } from './lib/automation';
import { recordMetrics } from './routes/system';
import type { Env } from './types';

/**
 * Scheduled work. Two crons are configured:
 *   - every 15 minutes: SLA sweep, event reminders, health metrics
 *   - daily at 06:00 UTC: retention cleanup, contract & warranty alerts
 */
export async function handleScheduled(event: ScheduledController, env: Env): Promise<void> {
  const isDaily = event.cron === '0 6 * * *';
  const started = Date.now();

  try {
    await Promise.all([slaSweep(env), eventReminders(env), recordMetrics(env)]);
    if (isDaily) {
      await Promise.all([contractExpiryAlerts(env), warrantyExpiryAlerts(env), retentionCleanup(env)]);
    }
    log('info', 'cron_completed', { cron: event.cron, durationMs: Date.now() - started });
  } catch (error) {
    log('error', 'cron_failed', { cron: event.cron, error: String(error) });
  }
}

/** Notify assignees (and admins) about tickets that have breached their SLA. */
async function slaSweep(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT id, ticket_number, title, assigned_to, created_by, priority
     FROM tickets
     WHERE status IN ('open','in_progress') AND sla_due_date IS NOT NULL AND sla_due_date < ?
     LIMIT 200`,
  )
    .bind(now())
    .all<{ id: string; ticket_number: string; title: string; assigned_to: string | null; created_by: string; priority: string }>();

  for (const ticket of results ?? []) {
    const recipient = ticket.assigned_to ?? ticket.created_by;
    await notify(env, {
      userId: recipient,
      title: `SLA breached on ${ticket.ticket_number}`,
      message: ticket.title,
      type: 'ticket_updated',
      relatedTicketId: ticket.id,
      actionUrl: `/tickets/${ticket.id}`,
      // One alert per ticket, ever — dedupe_key makes the sweep idempotent.
      dedupeKey: `sla-breach:${ticket.id}:${recipient}`,
    });
    await runAutomation(env, 'ticket_updated', { ...ticket, sla_breached: true });
  }
}

/** Remind attendees shortly before an event starts. */
async function eventReminders(env: Env): Promise<void> {
  const horizon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, title, start_date, attendees, created_by FROM calendar_events
     WHERE reminder_sent_at IS NULL AND start_date BETWEEN ? AND ? LIMIT 100`,
  )
    .bind(now(), horizon)
    .all<{ id: string; title: string; start_date: string; attendees: string; created_by: string }>();

  for (const event of results ?? []) {
    let attendees: string[] = [];
    try {
      attendees = JSON.parse(event.attendees ?? '[]');
    } catch {
      attendees = [];
    }
    const recipients = new Set([event.created_by, ...attendees]);
    for (const recipient of recipients) {
      await notify(env, {
        userId: recipient,
        title: `Starting soon: ${event.title}`,
        message: new Date(event.start_date).toUTCString(),
        actionUrl: '/calendar',
        dedupeKey: `event-reminder:${event.id}:${recipient}`,
      });
    }
    await env.DB.prepare(`UPDATE calendar_events SET reminder_sent_at = ? WHERE id = ?`).bind(now(), event.id).run();
  }
}

/** Warn administrators about vendor contracts expiring within 30 days. */
async function contractExpiryAlerts(env: Env): Promise<void> {
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { results: vendors } = await env.DB.prepare(
    `SELECT id, name, contract_end_date, service_type FROM vendors
     WHERE deleted_at IS NULL AND contract_end_date BETWEEN ? AND ? LIMIT 100`,
  )
    .bind(today, in30)
    .all<{ id: string; name: string; contract_end_date: string; service_type: string | null }>();

  if (!vendors?.length) return;
  const { results: admins } = await env.DB.prepare(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL`,
  ).all<{ id: string }>();

  for (const vendor of vendors) {
    const daysUntilExpiry = Math.ceil((new Date(vendor.contract_end_date).getTime() - Date.now()) / 86_400_000);
    for (const admin of admins ?? []) {
      await notify(env, {
        userId: admin.id,
        title: `Contract expiring: ${vendor.name}`,
        message: `Ends on ${vendor.contract_end_date} (${daysUntilExpiry} days)`,
        actionUrl: '/vendors',
        dedupeKey: `contract-expiry:${vendor.id}:${vendor.contract_end_date}:${admin.id}`,
      });
    }
    await runAutomation(env, 'contract_expiring', { ...vendor, days_until_expiry: daysUntilExpiry });
  }
}

/** Warn technicians about asset warranties expiring within 30 days. */
async function warrantyExpiryAlerts(env: Env): Promise<void> {
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { results: assets } = await env.DB.prepare(
    `SELECT id, name, asset_tag, warranty_expiry FROM assets
     WHERE deleted_at IS NULL AND warranty_expiry BETWEEN ? AND ? LIMIT 100`,
  )
    .bind(today, in30)
    .all<{ id: string; name: string; asset_tag: string; warranty_expiry: string }>();
  if (!assets?.length) return;

  const { results: staff } = await env.DB.prepare(
    `SELECT id FROM users WHERE role IN ('admin','technician') AND is_active = 1 AND deleted_at IS NULL`,
  ).all<{ id: string }>();

  for (const asset of assets) {
    for (const person of staff ?? []) {
      await notify(env, {
        userId: person.id,
        title: `Warranty expiring: ${asset.asset_tag}`,
        message: `${asset.name} warranty ends on ${asset.warranty_expiry}`,
        actionUrl: '/assets',
        dedupeKey: `warranty:${asset.id}:${asset.warranty_expiry}:${person.id}`,
      });
    }
  }
}

/**
 * Retention / hygiene:
 *  - expired and revoked sessions are removed
 *  - used or expired password reset tokens are removed
 *  - read notifications older than 90 days are removed
 *  - audit logs older than 365 days are removed
 *  - health metrics older than 30 days are removed
 *  - orphaned R2 objects (soft-deleted attachments) are purged
 */
async function retentionCleanup(env: Env): Promise<void> {
  const ts = now();
  const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)`).bind(
      ts,
      days(7),
    ),
    env.DB.prepare(`DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL`).bind(ts),
    env.DB.prepare(`DELETE FROM notifications WHERE is_read = 1 AND created_at < ?`).bind(days(90)),
    env.DB.prepare(`DELETE FROM activity_logs WHERE created_at < ?`).bind(days(365)),
    env.DB.prepare(`DELETE FROM system_metrics WHERE recorded_at < ?`).bind(days(30)),
    env.DB.prepare(`DELETE FROM automation_executions WHERE executed_at < ?`).bind(days(90)),
  ]);

  const { results: orphans } = await env.DB.prepare(
    `SELECT id, object_key FROM attachments WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 100`,
  )
    .bind(days(7))
    .all<{ id: string; object_key: string }>();

  for (const orphan of orphans ?? []) {
    await env.UPLOADS.delete(orphan.object_key).catch(() => undefined);
    await env.DB.prepare(`DELETE FROM attachments WHERE id = ?`).bind(orphan.id).run();
  }

  // Record a heartbeat so operators can confirm the cron actually runs.
  await env.DB.prepare(
    `INSERT INTO system_metrics (id, metric_name, metric_value, status, recorded_at) VALUES (?, ?, ?, 'healthy', ?)`,
  )
    .bind(newId(), 'Nightly maintenance', 'completed', ts)
    .run();
}
