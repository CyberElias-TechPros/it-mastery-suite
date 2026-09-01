import { newId, now, parseJsonColumn } from './db';
import { log } from './logger';
import { notify, adminIds } from './notifications';
import type { Env } from '../types';

/**
 * A deliberately small, safe rules engine.
 *
 * Rules are stored as data (never code), conditions are evaluated in the
 * worker against a plain event payload, and actions are limited to an explicit
 * whitelist. Every evaluation that matches is recorded in
 * `automation_executions` so operators can see what the system did.
 */

export type TriggerEvent =
  | 'ticket_created'
  | 'ticket_updated'
  | 'asset_registered'
  | 'expense_added'
  | 'diesel_low'
  | 'contract_expiring'
  | 'user_registered';

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number;
  secondValue?: string | number;
}

export interface RuleAction {
  type: 'assign_technician' | 'send_notification' | 'escalate_ticket' | 'update_status' | 'create_task' | string;
  config: Record<string, unknown>;
}

interface RuleRow {
  id: string;
  name: string;
  trigger_event: string;
  conditions: string;
  actions: string;
  is_active: number;
  created_by: string | null;
}

export function evaluateCondition(condition: RuleCondition, payload: Record<string, unknown>): boolean {
  const actual = payload[condition.field];
  const expected = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(actual ?? '').toLowerCase() === String(expected ?? '').toLowerCase();
    case 'not_equals':
      return String(actual ?? '').toLowerCase() !== String(expected ?? '').toLowerCase();
    case 'contains':
      return String(actual ?? '')
        .toLowerCase()
        .includes(String(expected ?? '').toLowerCase());
    case 'greater_than':
      return Number(actual) > Number(expected);
    case 'less_than':
      return Number(actual) < Number(expected);
    case 'between':
      return Number(actual) >= Number(expected) && Number(actual) <= Number(condition.secondValue ?? expected);
    default:
      return false;
  }
}

export function matches(conditions: RuleCondition[], payload: Record<string, unknown>): boolean {
  // No conditions means "always" — matching the wording shown in the UI.
  return conditions.every((condition) => evaluateCondition(condition, payload));
}

async function applyAction(
  env: Env,
  action: RuleAction,
  payload: Record<string, unknown>,
): Promise<{ type: string; outcome: string }> {
  const ticketId = typeof payload.id === 'string' ? payload.id : null;

  switch (action.type) {
    case 'assign_technician': {
      const userId = typeof action.config.userId === 'string' ? action.config.userId : null;
      if (!ticketId || !userId) return { type: action.type, outcome: 'skipped: missing ticket or user' };
      // Never overwrite an assignment a human already made.
      const result = await env.DB.prepare(
        `UPDATE tickets SET assigned_to = ?, updated_at = ? WHERE id = ? AND assigned_to IS NULL`,
      )
        .bind(userId, now(), ticketId)
        .run();
      if (result.meta.changes) {
        await notify(env, {
          userId,
          title: `Ticket ${payload.ticket_number ?? ''} assigned by automation`,
          message: String(payload.title ?? ''),
          type: 'ticket_assigned',
          relatedTicketId: ticketId,
          actionUrl: `/tickets/${ticketId}`,
          dedupeKey: `auto-assign:${ticketId}:${userId}`,
        });
        return { type: action.type, outcome: `assigned to ${userId}` };
      }
      return { type: action.type, outcome: 'skipped: already assigned' };
    }

    case 'escalate_ticket': {
      const priority = typeof action.config.priority === 'string' ? action.config.priority : 'high';
      if (!ticketId || !['low', 'medium', 'high', 'critical'].includes(priority)) {
        return { type: action.type, outcome: 'skipped: invalid configuration' };
      }
      await env.DB.prepare(`UPDATE tickets SET priority = ?, updated_at = ? WHERE id = ?`)
        .bind(priority, now(), ticketId)
        .run();
      return { type: action.type, outcome: `priority set to ${priority}` };
    }

    case 'update_status': {
      const status = typeof action.config.status === 'string' ? action.config.status : null;
      if (!ticketId || !status || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return { type: action.type, outcome: 'skipped: invalid configuration' };
      }
      await env.DB.prepare(`UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`)
        .bind(status, now(), ticketId)
        .run();
      return { type: action.type, outcome: `status set to ${status}` };
    }

    case 'send_notification': {
      const message = String(action.config.message ?? 'Automation rule triggered');
      const title = String(action.config.title ?? 'Automation');
      const targets =
        action.config.userId && typeof action.config.userId === 'string'
          ? [action.config.userId]
          : await adminIds(env);
      for (const target of targets) {
        await notify(env, {
          userId: target,
          title,
          message,
          actionUrl: ticketId ? `/tickets/${ticketId}` : null,
          dedupeKey: `auto-notify:${ticketId ?? newId()}:${target}:${title}`,
        });
      }
      return { type: action.type, outcome: `notified ${targets.length} user(s)` };
    }

    case 'create_task': {
      const title = String(action.config.title ?? `Follow-up: ${payload.title ?? 'automation task'}`);
      const owner = typeof action.config.userId === 'string' ? action.config.userId : (await adminIds(env))[0];
      if (!owner) return { type: action.type, outcome: 'skipped: no owner available' };
      const dueInDays = Number(action.config.dueInDays ?? 3);
      const start = new Date(Date.now() + dueInDays * 86_400_000);
      await env.DB.prepare(
        `INSERT INTO calendar_events (id, title, description, start_date, end_date, event_type, all_day, attendees, created_by, related_ticket_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'deadline', 1, ?, ?, ?, ?, ?)`,
      )
        .bind(
          newId(),
          title,
          'Created automatically by an automation rule',
          start.toISOString(),
          new Date(start.getTime() + 3_600_000).toISOString(),
          JSON.stringify([owner]),
          owner,
          ticketId,
          now(),
          now(),
        )
        .run();
      return { type: action.type, outcome: 'follow-up task created' };
    }

    default:
      return { type: action.type, outcome: 'skipped: unsupported action' };
  }
}

/**
 * Runs every active rule for an event. Failures are captured per rule so one
 * bad rule cannot break the request that triggered it.
 */
export async function runAutomation(env: Env, event: TriggerEvent, payload: Record<string, unknown>): Promise<void> {
  let rules: RuleRow[] = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM automation_rules WHERE trigger_event = ? AND is_active = 1`,
    )
      .bind(event)
      .all<RuleRow>();
    rules = results ?? [];
  } catch (error) {
    log('error', 'automation_load_failed', { event, error: String(error) });
    return;
  }

  for (const rule of rules) {
    const conditions = parseJsonColumn<RuleCondition[]>(rule.conditions, []);
    const actions = parseJsonColumn<RuleAction[]>(rule.actions, []);

    let status: 'success' | 'failed' | 'skipped' = 'success';
    let errorMessage: string | null = null;
    let outcomes: { type: string; outcome: string }[] = [];

    try {
      if (!matches(conditions, payload)) {
        continue; // Not applicable — do not create noise in the execution log.
      }
      outcomes = [];
      for (const action of actions) {
        outcomes.push(await applyAction(env, action, payload));
      }
      // A rule whose every action was a no-op is reported as skipped so the
      // execution log distinguishes "did nothing" from "did something".
      if (outcomes.length === 0 || outcomes.every((o) => o.outcome.startsWith('skipped'))) status = 'skipped';
    } catch (error) {
      status = 'failed';
      errorMessage = String(error).slice(0, 500);
      log('error', 'automation_action_failed', { ruleId: rule.id, error: errorMessage });
    }

    try {
      await env.DB.prepare(
        `INSERT INTO automation_executions (id, rule_id, trigger_data, result, status, error_message, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          newId(),
          rule.id,
          JSON.stringify(payload).slice(0, 4000),
          JSON.stringify(outcomes),
          status,
          errorMessage,
          now(),
        )
        .run();
    } catch (error) {
      log('error', 'automation_log_failed', { ruleId: rule.id, error: String(error) });
    }
  }
}
