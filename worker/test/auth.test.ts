import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createUser, request } from './helpers';

describe('authentication', () => {
  it('registers the first account as an administrator and issues tokens', async () => {
    const email = `first-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const response = await request('/api/auth/register', {
      method: 'POST',
      json: { email, password: 'Passw0rd-test-123', fullName: 'First Admin' },
    });
    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user).not.toHaveProperty('password_hash');
    expect(response.headers.get('set-cookie')).toContain('itsm_refresh=');
  });

  it('rejects weak passwords with field level errors', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      json: { email: 'weak@example.com', password: 'short', fullName: 'Weak' },
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.password).toBeTruthy();
  });

  it('does not reveal whether an email exists on failed sign-in', async () => {
    const user = await createUser();
    const wrongPassword = await request('/api/auth/login', {
      method: 'POST',
      json: { email: user.email, password: 'Wrong-password-000' },
    });
    const unknownEmail = await request('/api/auth/login', {
      method: 'POST',
      json: { email: 'nobody@example.com', password: 'Wrong-password-000' },
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('signs in with valid credentials', async () => {
    const user = await createUser();
    const response = await request('/api/auth/login', {
      method: 'POST',
      json: { email: user.email, password: user.password },
    });
    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(user.id);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const user = await createUser();
    const first = await request('/api/auth/refresh', { method: 'POST', json: { refreshToken: user.refreshToken } });
    expect(first.status).toBe(200);
    const reuse = await request('/api/auth/refresh', { method: 'POST', json: { refreshToken: user.refreshToken } });
    expect(reuse.status).toBe(401);
    // Reuse detection revokes the whole family.
    const rotated = await request('/api/auth/refresh', {
      method: 'POST',
      json: { refreshToken: first.body.data.refreshToken },
    });
    expect(rotated.status).toBe(401);
  });

  it('rejects tampered and unsigned tokens', async () => {
    const user = await createUser();
    const [header, payload] = user.token.split('.');
    const forged = `${header}.${payload}.invalidsignature`;
    expect((await request('/api/auth/me', { token: forged })).status).toBe(401);
    expect((await request('/api/auth/me', { token: 'not-a-token' })).status).toBe(401);
    expect((await request('/api/auth/me')).status).toBe(401);
  });

  it('returns the current profile and allows profile edits', async () => {
    const user = await createUser();
    const me = await request('/api/auth/me', { token: user.token });
    expect(me.body.data.email).toBe(user.email);

    const update = await request('/api/auth/me', {
      method: 'PUT',
      token: user.token,
      json: { fullName: 'Renamed Person', phone: '+2348000000' },
    });
    expect(update.status).toBe(200);
    expect(update.body.data.full_name).toBe('Renamed Person');
  });

  it('changes a password and revokes existing sessions', async () => {
    const user = await createUser();
    const change = await request('/api/auth/change-password', {
      method: 'POST',
      token: user.token,
      json: { currentPassword: user.password, newPassword: 'Brand-new-pass-99' },
    });
    expect(change.status).toBe(200);

    const oldRefresh = await request('/api/auth/refresh', { method: 'POST', json: { refreshToken: user.refreshToken } });
    expect(oldRefresh.status).toBe(401);

    const login = await request('/api/auth/login', {
      method: 'POST',
      json: { email: user.email, password: 'Brand-new-pass-99' },
    });
    expect(login.status).toBe(200);
  });

  it('blocks deactivated accounts immediately', async () => {
    const user = await createUser();
    await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(user.id).run();
    const me = await request('/api/auth/me', { token: user.token });
    expect(me.status).toBe(403);
  });

  it('never confirms account existence on password reset requests', async () => {
    const user = await createUser();
    const known = await request('/api/auth/password-reset/request', { method: 'POST', json: { email: user.email } });
    const unknown = await request('/api/auth/password-reset/request', {
      method: 'POST',
      json: { email: 'ghost@example.com' },
    });
    expect(known.body.data.message).toBe(unknown.body.data.message);
  });
});

describe('cors and security headers', () => {
  it('rejects preflight from an unknown origin', async () => {
    const ctx = new Request('https://api.test/api/tickets', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.com' },
    });
    const { default: app } = await import('../src/index');
    const { createExecutionContext, waitOnExecutionContext } = await import('cloudflare:test');
    const executionCtx = createExecutionContext();
    const response = await app.fetch(ctx, env, executionCtx);
    await waitOnExecutionContext(executionCtx);
    expect(response.status).toBe(403);
  });

  it('sets hardening headers on API responses', async () => {
    const response = await request('/api/system/ping');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});
