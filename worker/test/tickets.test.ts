import { describe, expect, it } from 'vitest';
import { createUser, request } from './helpers';

describe('tickets', () => {
  it('validates input before creating', async () => {
    const user = await createUser();
    const response = await request('/api/tickets', {
      method: 'POST',
      token: user.token,
      json: { title: 'no', description: 'short' },
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details.title).toBeTruthy();
  });

  it('creates a ticket with a generated number and SLA target', async () => {
    const user = await createUser();
    const response = await request('/api/tickets', {
      method: 'POST',
      token: user.token,
      json: { title: 'Laptop will not boot', description: 'It shows a blue screen every morning.', priority: 'high' },
    });
    expect(response.status).toBe(201);
    expect(response.body.data.ticket_number).toMatch(/^TKT-\d{6}$/);
    expect(new Date(response.body.data.sla_due_date).getTime()).toBeGreaterThan(Date.now());
    expect(response.body.data.status).toBe('open');
  });

  it('hides other people tickets from employees but shows them to staff', async () => {
    const reporter = await createUser();
    const stranger = await createUser();
    const technician = await createUser('technician');

    const createdTicket = await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'Printer jam on floor 3', description: 'Paper keeps jamming in the main tray.' },
    });
    const id = createdTicket.body.data.id;

    expect((await request(`/api/tickets/${id}`, { token: stranger.token })).status).toBe(404);
    expect((await request(`/api/tickets/${id}`, { token: reporter.token })).status).toBe(200);
    expect((await request(`/api/tickets/${id}`, { token: technician.token })).status).toBe(200);

    const strangerList = await request('/api/tickets', { token: stranger.token });
    expect(strangerList.body.data).toHaveLength(0);
  });

  it('prevents employees from reassigning or escalating tickets', async () => {
    const reporter = await createUser();
    const technician = await createUser('technician');
    const created = await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'VPN keeps disconnecting', description: 'Drops every ten minutes on the office wifi.' },
    });
    const id = created.body.data.id;

    const escalate = await request(`/api/tickets/${id}`, {
      method: 'PUT',
      token: reporter.token,
      json: { priority: 'critical' },
    });
    expect(escalate.status).toBe(403);

    const assign = await request(`/api/tickets/${id}`, {
      method: 'PUT',
      token: technician.token,
      json: { assignedTo: technician.id, status: 'in_progress' },
    });
    expect(assign.status).toBe(200);
    expect(assign.body.data.assigned_to).toBe(technician.id);
  });

  it('enforces the status lifecycle', async () => {
    const technician = await createUser('technician');
    const created = await request('/api/tickets', {
      method: 'POST',
      token: technician.token,
      json: { title: 'Server rack fan noise', description: 'Loud grinding noise coming from rack B.' },
    });
    const id = created.body.data.id;

    await request(`/api/tickets/${id}`, { method: 'PUT', token: technician.token, json: { status: 'resolved' } });
    const invalid = await request(`/api/tickets/${id}`, {
      method: 'PUT',
      token: technician.token,
      json: { status: 'open' },
    });
    expect(invalid.status).toBe(409);
  });

  it('keeps internal notes away from the requester', async () => {
    const reporter = await createUser();
    const technician = await createUser('technician');
    const created = await request('/api/tickets', {
      method: 'POST',
      token: reporter.token,
      json: { title: 'Email not syncing on phone', description: 'Outlook mobile stopped syncing yesterday.' },
    });
    const id = created.body.data.id;

    const internal = await request(`/api/tickets/${id}/comments`, {
      method: 'POST',
      token: technician.token,
      json: { comment: 'Suspect the mailbox quota, checking exchange.', isInternal: true },
    });
    expect(internal.status).toBe(201);

    const forbidden = await request(`/api/tickets/${id}/comments`, {
      method: 'POST',
      token: reporter.token,
      json: { comment: 'Any update?', isInternal: true },
    });
    expect(forbidden.status).toBe(403);

    const reporterView = await request(`/api/tickets/${id}/comments`, { token: reporter.token });
    expect(reporterView.body.data).toHaveLength(0);
    const staffView = await request(`/api/tickets/${id}/comments`, { token: technician.token });
    expect(staffView.body.data).toHaveLength(1);
  });

  it('notifies the assignee when a ticket is assigned', async () => {
    const technician = await createUser('technician');
    const admin = await createUser('admin');
    const created = await request('/api/tickets', {
      method: 'POST',
      token: admin.token,
      json: { title: 'Replace failed disk in NAS', description: 'Disk 3 reports SMART failures.', assignedTo: technician.id },
    });
    expect(created.status).toBe(201);

    const notifications = await request('/api/notifications', { token: technician.token });
    expect(notifications.body.data.length).toBeGreaterThan(0);
    expect(notifications.body.data[0].type).toBe('ticket_assigned');
  });

  it('paginates and reports totals', async () => {
    const technician = await createUser('technician');
    for (let i = 0; i < 3; i++) {
      await request('/api/tickets', {
        method: 'POST',
        token: technician.token,
        json: { title: `Bulk ticket number ${i}`, description: 'Created for pagination coverage in tests.' },
      });
    }
    const page = await request('/api/tickets?page=1&pageSize=2', { token: technician.token });
    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(page.body.meta.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid pagination values', async () => {
    const user = await createUser();
    const response = await request('/api/tickets?pageSize=5000', { token: user.token });
    expect(response.status).toBe(422);
  });
});
