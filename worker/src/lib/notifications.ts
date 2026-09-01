import { newId, now } from './db';
import { log } from './logger';
import type { Env } from '../types';

export type NotificationType = 'ticket_assigned' | 'ticket_updated' | 'ticket_resolved' | 'system' | 'mention';

export interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  relatedTicketId?: string | null;
  actionUrl?: string | null;
  /** Optional idempotency key — prevents duplicate notifications per user. */
  dedupeKey?: string | null;
}

/**
 * Creates an in-app notification. Uses a per-user unique `dedupe_key` so
 * repeated cron sweeps or retried webhooks cannot spam a user.
 * Never throws: notification delivery must not roll back business operations.
 */
export async function notify(env: Env, input: NotificationInput): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, is_read, related_ticket_id, action_url, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        input.userId,
        input.title,
        input.message,
        input.type ?? 'system',
        input.relatedTicketId ?? null,
        input.actionUrl ?? null,
        input.dedupeKey ?? null,
        now(),
      )
      .run();
  } catch (error) {
    log('error', 'notification_failed', { userId: input.userId, error: String(error) });
  }
}

export async function notifyMany(env: Env, inputs: NotificationInput[]): Promise<void> {
  await Promise.all(inputs.map((i) => notify(env, i)));
}

/** All admins (used for approval workflows). */
export async function adminIds(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL`,
  ).all<{ id: string }>();
  return (results ?? []).map((r) => r.id);
}
