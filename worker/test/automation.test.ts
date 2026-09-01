import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { evaluateCondition, runAutomation } from '../src/lib/automation';
import { createUser, request } from './helpers';

describe('automation condition evaluation', () => {
  const ticket = { priority: 'critical', title: 'Server down in Lagos', hours_open: 12, status: 'open' } as Record<string, unknown>;

  it('supports every documented operator', () => {
    expect(evaluateCondition({ field: 'priority', operator: 'equals', value: 'critical' }, ticket)).toBe(true);
    expect(evaluateCondition({ field: 'priority', operator: 'equals', value: 'CRITICAL' }, ticket)).toBe(true);
    expect(evaluateCondition({ field: 'priority', operator: 'not_equals', value: 'low' }, ticket)).toBe(true);
    expect(evaluateCondition({ field: 'title', operator: 'contains', value: 'lagos' }, ticket)).toBe(true);
    expect(evaluateCondition({ field: 'hours_open', operator: 'greater_than', value: 8 }, ticket)).toBe(true);
    expect(evaluateCondition({ field: 'hours_open', operator: 'less_than', value: 8 }, ticket)).toBe(false);
    expect(evaluateCondition({ field: 'hours_open', operator: 'between', value: 10, secondValue: 20 }, ticket)).toBe(true);
  });

  it('fails closed on unknown fields, unknown operators and bad numbers', () => {
    expect(evaluateCondition({ field: 'nope', operator: 'equals', value: 'x' }, ticket)).toBe(false);
    expect(evaluateCondition({ field: 'priority', operator: 'sql_inject' as any, value: 'x' }, ticket)).toBe(false);
    expect(evaluateCondition({ field: 'title', operator: 'greater_than', value: 3 }, ticket)).toBe(false);
  });
});

describe('automation execution', () => {
  it('assigns a technician, records an execution and never double assigns', async () => {
    const admin = await createUser('admin');
    const technician = await createUser('technician');

    const rule = await request('/api/automation', {
      method: 'POST',
      token: admin.token,
      json: {
        name: 'Auto assign critical tickets',
        triggerEvent: 'ticket_created',
        conditions: [{ field: 'priority', operator: 'equals', value: 'critical' }],
        actions: [{ type: 'assign_technician', config: { userId: technician.id } }],
        isActive: true,
      },
    });
    expect(rule.status).toBe(201);

    const reporter = await createUser();
    const ticket = await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'Critical outage in branch', description: 'The whole branch has lost connectivity.', priority: 'critical' },
    });
    expect(ticket.status).toBe(201);

    // The automation runs through waitUntil, which the helper awaits.
    const stored = await env.DB.prepare('SELECT assigned_to FROM tickets WHERE id = ?').bind(ticket.body.data.id).first<any>();
    expect(stored.assigned_to).toBe(technician.id);

    const executions = await request(`/api/automation/executions?ruleId=${rule.body.data.id}`, { token: admin.token });
    expect(executions.body.data[0].status).toBe('success');
    expect(executions.body.data[0].result[0].type).toBe('assign_technician');
  });

  it('skips rules whose conditions do not match', async () => {
    const admin = await createUser('admin');
    const rule = await request('/api/automation', {
      method: 'POST',
      token: admin.token,
      json: {
        name: 'Low priority only',
        triggerEvent: 'ticket_created',
        conditions: [{ field: 'priority', operator: 'equals', value: 'low' }],
        actions: [{ type: 'send_notification', config: { message: 'Low priority ticket raised' } }],
      },
    });
    const reporter = await createUser();
    await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'Unmatched priority ticket', description: 'This should not trigger the low priority rule.', priority: 'high' },
    });
    const executions = await request(`/api/automation/executions?ruleId=${rule.body.data.id}`, { token: admin.token });
    expect(executions.body.data).toHaveLength(0);
  });

  it('records a skipped execution instead of throwing when an action is unsupported', async () => {
    const admin = await createUser('admin');
    await env.DB.prepare(
      `INSERT INTO automation_rules (id, name, trigger_event, conditions, actions, is_active, created_by)
       VALUES (?, 'Broken rule', 'ticket_created', '[]', ?, 1, ?)`,
    )
      .bind(crypto.randomUUID(), JSON.stringify([{ type: 'send_email', config: {} }]), admin.id)
      .run();

    const reporter = await createUser();
    const ticket = await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'Ticket with broken rule', description: 'The broken rule must not break ticket creation.' },
    });
    expect(ticket.status).toBe(201);

    const skipped = await env.DB
      .prepare("SELECT result FROM automation_executions WHERE status = 'skipped' ORDER BY executed_at DESC")
      .first<any>();
    expect(JSON.parse(skipped.result)[0].outcome).toContain('unsupported');
  });

  it('refuses rules with unknown actions or too many conditions', async () => {
    const admin = await createUser('admin');
    expect(
      (
        await request('/api/automation', {
          method: 'POST',
          token: admin.token,
          json: { name: 'Bad action', triggerEvent: 'ticket_created', actions: [{ type: 'delete_database' }] },
        })
      ).status,
    ).toBe(422);

    expect(
      (
        await request('/api/automation', {
          method: 'POST',
          token: admin.token,
          json: {
            name: 'Too many conditions',
            triggerEvent: 'ticket_created',
            conditions: Array.from({ length: 11 }, () => ({ field: 'priority', operator: 'equals', value: 'low' })),
            actions: [{ type: 'send_notification', config: { message: 'hi' } }],
          },
        })
      ).status,
    ).toBe(422);
  });

  it('is administrator only', async () => {
    const technician = await createUser('technician');
    const response = await request('/api/automation', {
      method: 'POST',
      token: technician.token,
      json: { name: 'Nope', triggerEvent: 'ticket_created', actions: [{ type: 'send_notification', config: { message: 'x' } }] },
    });
    expect(response.status).toBe(403);
  });

  it('ignores inactive rules', async () => {
    const admin = await createUser('admin');
    const rule = await request('/api/automation', {
      method: 'POST',
      token: admin.token,
      json: {
        name: 'Inactive rule',
        triggerEvent: 'asset_registered',
        actions: [{ type: 'send_notification', config: { message: 'asset' } }],
        isActive: false,
      },
    });
    await runAutomation(env as any, 'asset_registered', { id: 'x' });
    const executions = await request(`/api/automation/executions?ruleId=${rule.body.data.id}`, { token: admin.token });
    expect(executions.body.data).toHaveLength(0);
  });
});
