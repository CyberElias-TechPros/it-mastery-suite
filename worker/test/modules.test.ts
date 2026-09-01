import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createUser, request } from './helpers';

describe('assets', () => {
  it('is read-only for employees', async () => {
    const employee = await createUser();
    const response = await request('/api/assets', {
      method: 'POST',
      token: employee.token,
      json: { assetTag: 'LT-001', name: 'ThinkPad T14' },
    });
    expect(response.status).toBe(403);
  });

  it('creates, updates and soft deletes an asset', async () => {
    const technician = await createUser('technician');
    const admin = await createUser('admin');

    const createdAsset = await request('/api/assets', {
      method: 'POST',
      token: technician.token,
      json: { assetTag: `LT-${Date.now()}`, name: 'ThinkPad T14', category: 'laptop', purchaseCost: 1200 },
    });
    expect(createdAsset.status).toBe(201);
    const id = createdAsset.body.data.id;

    const updated = await request(`/api/assets/${id}`, {
      method: 'PUT',
      token: technician.token,
      json: { status: 'maintenance' },
    });
    expect(updated.body.data.status).toBe('maintenance');

    expect((await request(`/api/assets/${id}`, { method: 'DELETE', token: technician.token })).status).toBe(403);
    expect((await request(`/api/assets/${id}`, { method: 'DELETE', token: admin.token })).status).toBe(200);
    expect((await request(`/api/assets/${id}`, { token: admin.token })).status).toBe(404);
  });

  it('rejects a duplicate asset tag with a conflict', async () => {
    const technician = await createUser('technician');
    const tag = `SRV-${Date.now()}`;
    await request('/api/assets', { method: 'POST', token: technician.token, json: { assetTag: tag, name: 'Server A' } });
    const duplicate = await request('/api/assets', {
      method: 'POST',
      token: technician.token,
      json: { assetTag: tag, name: 'Server B' },
    });
    expect(duplicate.status).toBe(409);
  });
});

describe('expenses', () => {
  it('creates a pending expense and hides it from other employees', async () => {
    const employee = await createUser();
    const other = await createUser();
    const response = await request('/api/expenses', {
      method: 'POST',
      token: employee.token,
      json: { title: 'Router replacement', amount: 250.5, expenseDate: new Date().toISOString().slice(0, 10) },
    });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('pending');

    const otherList = await request('/api/expenses', { token: other.token });
    expect(otherList.body.data).toHaveLength(0);
  });

  it('refuses future dated expenses', async () => {
    const employee = await createUser();
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const response = await request('/api/expenses', {
      method: 'POST',
      token: employee.token,
      json: { title: 'Prepaid support', amount: 100, expenseDate: future },
    });
    expect(response.status).toBe(422);
  });

  it('only lets an administrator approve, and never their own expense', async () => {
    const employee = await createUser();
    const admin = await createUser('admin');

    const expense = await request('/api/expenses', {
      method: 'POST',
      token: employee.token,
      json: { title: 'UPS battery', amount: 90, expenseDate: new Date().toISOString().slice(0, 10) },
    });
    const id = expense.body.data.id;

    expect(
      (await request(`/api/expenses/${id}/decision`, { method: 'POST', token: employee.token, json: { decision: 'approved' } }))
        .status,
    ).toBe(403);

    const approved = await request(`/api/expenses/${id}/decision`, {
      method: 'POST',
      token: admin.token,
      json: { decision: 'approved' },
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('approved');

    const again = await request(`/api/expenses/${id}/decision`, {
      method: 'POST',
      token: admin.token,
      json: { decision: 'rejected', reason: 'Duplicate' },
    });
    expect(again.status).toBe(409);

    const own = await request('/api/expenses', {
      method: 'POST',
      token: admin.token,
      json: { title: 'Own expense', amount: 10, expenseDate: new Date().toISOString().slice(0, 10) },
    });
    const selfApprove = await request(`/api/expenses/${own.body.data.id}/decision`, {
      method: 'POST',
      token: admin.token,
      json: { decision: 'approved' },
    });
    expect(selfApprove.status).toBe(403);
  });

  it('feeds approved spend into budget utilisation', async () => {
    const admin = await createUser('admin');
    const branch = await request('/api/branches', {
      method: 'POST',
      token: admin.token,
      json: { name: 'HQ', code: `HQ${Date.now() % 100000}`, budget: 1000 },
    });
    const employee = await createUser();
    const expense = await request('/api/expenses', {
      method: 'POST',
      token: employee.token,
      json: {
        title: 'Cabling',
        amount: 250,
        expenseDate: new Date().toISOString().slice(0, 10),
        branchId: branch.body.data.id,
      },
    });
    await request(`/api/expenses/${expense.body.data.id}/decision`, {
      method: 'POST',
      token: admin.token,
      json: { decision: 'approved' },
    });

    const budgets = await request(`/api/budgets?year=${new Date().getFullYear()}`, { token: admin.token });
    const row = budgets.body.data.branches.find((b: any) => b.id === branch.body.data.id);
    expect(row.spent).toBe(250);
    expect(row.utilization).toBe(25);
  });
});

describe('users administration', () => {
  it('blocks role changes for non administrators', async () => {
    const technician = await createUser('technician');
    const victim = await createUser();
    const response = await request(`/api/users/${victim.id}`, {
      method: 'PUT',
      token: technician.token,
      json: { role: 'admin' },
    });
    expect(response.status).toBe(403);
  });

  it('protects the last administrator', async () => {
    const admin = await createUser('admin');
    await env.DB.prepare("UPDATE users SET role = 'employee' WHERE role = 'admin' AND id != ?").bind(admin.id).run();
    const response = await request(`/api/users/${admin.id}`, {
      method: 'PUT',
      token: admin.token,
      json: { role: 'employee' },
    });
    expect(response.status).toBe(400);
  });

  it('soft deletes a user and revokes their sessions', async () => {
    const admin = await createUser('admin');
    const victim = await createUser();
    const response = await request(`/api/users/${victim.id}`, { method: 'DELETE', token: admin.token });
    expect(response.status).toBe(200);
    expect((await request('/api/auth/me', { token: victim.token })).status).toBe(401);
  });
});

describe('knowledge base', () => {
  it('only lets staff publish, and counts views once per hour', async () => {
    const employee = await createUser();
    const technician = await createUser('technician');

    expect(
      (
        await request('/api/knowledge-base', {
          method: 'POST',
          token: employee.token,
          json: { title: 'How to reset', content: 'x'.repeat(30) },
        })
      ).status,
    ).toBe(403);

    const article = await request('/api/knowledge-base', {
      method: 'POST',
      token: technician.token,
      json: { title: 'How to reset your password', content: 'Follow these steps to reset your password safely.', tags: ['password'] },
    });
    expect(article.status).toBe(201);
    const id = article.body.data.id;

    const first = await request(`/api/knowledge-base/${id}/view`, { method: 'POST', token: employee.token });
    const second = await request(`/api/knowledge-base/${id}/view`, { method: 'POST', token: employee.token });
    expect(first.body.data.counted).toBe(true);
    expect(second.body.data.counted).toBe(false);

    const rating = await request(`/api/knowledge-base/${id}/rating`, {
      method: 'PUT',
      token: employee.token,
      json: { rating: 5 },
    });
    expect(rating.body.data.rating).toBe(5);
  });
});

describe('reports', () => {
  it('runs an ad-hoc report and rejects unknown fields', async () => {
    const admin = await createUser('admin');
    await request('/api/tickets', {
      method: 'POST',
      token: admin.token,
      json: { title: 'Reportable ticket item', description: 'Ensures the report has at least one row.' },
    });

    const run = await request('/api/reports/run', {
      method: 'POST',
      token: admin.token,
      json: { dataset: 'tickets', fields: ['ticket_number', 'status'], filters: [], limit: 10 },
    });
    expect(run.status).toBe(200);
    expect(run.body.data.columns).toHaveLength(2);
    expect(run.body.data.rows.length).toBeGreaterThan(0);

    const injection = await request('/api/reports/run', {
      method: 'POST',
      token: admin.token,
      json: { dataset: 'tickets', fields: ['ticket_number; DROP TABLE users;--'] },
    });
    expect(injection.status).toBe(422);
  });

  it('keeps the users dataset away from employees', async () => {
    const employee = await createUser();
    const response = await request('/api/reports/run', {
      method: 'POST',
      token: employee.token,
      json: { dataset: 'users', fields: ['email'] },
    });
    expect(response.status).toBe(403);
  });
});

describe('attachments', () => {
  it('rejects unsupported file types and enforces ticket access', async () => {
    const reporter = await createUser();
    const stranger = await createUser();
    const ticket = await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'Attachment test ticket', description: 'Used to verify upload authorisation rules.' },
    });
    const ticketId = ticket.body.data.id;

    const badType = new FormData();
    badType.append('file', new File(['<script>alert(1)</script>'], 'evil.html', { type: 'text/html' }), 'evil.html');
    badType.append('resourceType', 'ticket');
    badType.append('resourceId', ticketId);
    const rejected = await request('/api/attachments', { method: 'POST', token: reporter.token, body: badType });
    expect(rejected.status).toBe(415);

    const good = new FormData();
    good.append('file', new File(['hello world'], 'notes.txt', { type: 'text/plain' }), 'notes.txt');
    good.append('resourceType', 'ticket');
    good.append('resourceId', ticketId);
    const uploaded = await request('/api/attachments', { method: 'POST', token: reporter.token, body: good });
    expect(uploaded.status).toBe(201);

    const download = await request(`/api/attachments/${uploaded.body.data.id}/download`, { token: stranger.token });
    expect(download.status).toBe(403);

    const ownerDownload = await request(`/api/attachments/${uploaded.body.data.id}/download`, { token: reporter.token });
    expect(ownerDownload.status).toBe(200);
  });
});

describe('system', () => {
  it('exposes health only to administrators', async () => {
    const employee = await createUser();
    const admin = await createUser('admin');
    expect((await request('/api/system/health', { token: employee.token })).status).toBe(403);
    const health = await request('/api/system/health', { token: admin.token });
    expect(health.status).toBe(200);
    expect(health.body.data.metrics.length).toBeGreaterThan(3);
  });

  it('records an audit trail for privileged actions', async () => {
    const admin = await createUser('admin');
    await request('/api/branches', {
      method: 'POST',
      token: admin.token,
      json: { name: 'Audit Branch', code: `AB${Date.now() % 100000}` },
    });
    const activity = await request('/api/system/activity?action=branch.created', { token: admin.token });
    expect(activity.body.data.length).toBeGreaterThan(0);
    expect(activity.body.data[0].user_id).toBe(admin.id);
  });
});
