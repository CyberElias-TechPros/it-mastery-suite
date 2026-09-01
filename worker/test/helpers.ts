import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import app from '../src/index';

const ORIGIN = 'http://localhost:8080';

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

/** Issues a request against the worker exactly like a browser would. */
export async function request<T = any>(
  path: string,
  init: RequestInit & { token?: string; json?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  headers.set('origin', ORIGIN);
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }

  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`https://api.test${path}`, { ...init, headers, body }), env, ctx);
  await waitOnExecutionContext(ctx);

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

let counter = 0;

/** Registers a user and returns their access token. */
export async function createUser(role: 'admin' | 'technician' | 'employee' = 'employee') {
  counter += 1;
  const email = `user${counter}-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const registration = await request('/api/auth/register', {
    method: 'POST',
    json: { email, password: 'Passw0rd-test-123', fullName: `Test User ${counter}` },
  });
  if (registration.status !== 201) throw new Error(`registration failed: ${JSON.stringify(registration.body)}`);

  const user = registration.body.data.user;
  if (user.role !== role) {
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, user.id).run();
    user.role = role;
  }
  return { ...user, token: registration.body.data.accessToken, refreshToken: registration.body.data.refreshToken, password: 'Passw0rd-test-123' };
}
