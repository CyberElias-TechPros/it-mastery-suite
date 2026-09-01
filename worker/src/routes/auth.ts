import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../lib/errors';
import { hashPassword, randomToken, sha256Hex, signJwt, verifyPassword } from '../lib/crypto';
import { newId, now } from '../lib/db';
import { audit } from '../lib/audit';
import { runAutomation } from '../lib/automation';
import { sendEmail } from '../lib/email';
import { ok, created } from '../lib/response';
import { parseJson } from '../lib/validation';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { publicUser, type UserRow } from './users.shared';
import type { AppContext, AppEnv, Env } from '../types';

const REFRESH_COOKIE = 'itsm_refresh';

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password must be at most 200 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'Password must contain both letters and numbers');

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10).max(200).optional() });

/* -------------------------------------------------------------------------- */
/* Session helpers                                                             */
/* -------------------------------------------------------------------------- */

function ttl(env: Env, key: 'ACCESS_TOKEN_TTL_SECONDS' | 'REFRESH_TOKEN_TTL_SECONDS', fallback: number): number {
  const parsed = Number.parseInt(env[key] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function setRefreshCookie(c: AppContext, token: string, maxAge: number): void {
  const secure = c.env.ENVIRONMENT !== 'development';
  const attrs = [
    `${REFRESH_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/api/auth',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
    // Cross-site (Vercel -> Cloudflare) requires SameSite=None; on plain-http
    // local development SameSite=None is rejected, so Lax is used instead.
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ].filter(Boolean);
  c.header('set-cookie', attrs.join('; '), { append: true });
}

function clearRefreshCookie(c: AppContext): void {
  const secure = c.env.ENVIRONMENT !== 'development';
  c.header(
    'set-cookie',
    `${REFRESH_COOKIE}=; HttpOnly; Path=/api/auth; Max-Age=0; ${secure ? 'Secure; SameSite=None' : 'SameSite=Lax'}`,
    { append: true },
  );
}

function cookieToken(c: AppContext): string | null {
  const header = c.req.header('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFRESH_COOKIE) return rest.join('=') || null;
  }
  return null;
}

async function issueSession(c: AppContext, user: UserRow) {
  const accessTtl = ttl(c.env, 'ACCESS_TOKEN_TTL_SECONDS', 900);
  const refreshTtl = ttl(c.env, 'REFRESH_TOKEN_TTL_SECONDS', 1_209_600);

  const accessToken = await signJwt(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
    c.env.JWT_SECRET,
    accessTtl,
  );
  const refreshToken = randomToken(32);

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      user.id,
      await sha256Hex(refreshToken),
      c.req.header('user-agent')?.slice(0, 300) ?? null,
      c.req.header('cf-connecting-ip') ?? null,
      new Date(Date.now() + refreshTtl * 1000).toISOString(),
      now(),
    )
    .run();

  setRefreshCookie(c, refreshToken, refreshTtl);

  return {
    accessToken,
    // Also returned in the body so that clients running on a different site
    // than the API (where third-party cookies may be blocked) keep working.
    refreshToken,
    expiresIn: accessTtl,
    user: publicUser(user),
  };
}

async function loadUserById(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`).bind(id).first<UserRow>();
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

export const authRoutes = new Hono<AppEnv>();

authRoutes.post(
  '/register',
  rateLimit({ name: 'register', limit: 5, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseJson(c, registerSchema);

    const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email_lower = ?`)
      .bind(body.email)
      .first<{ id: string }>();
    if (existing) {
      // Do not reveal that the address is taken beyond what is unavoidable for
      // a registration form; the message is deliberately neutral.
      throw ApiError.conflict('That email address cannot be used for a new account');
    }

    const { total } = (await c.env.DB.prepare(`SELECT COUNT(*) AS total FROM users`).first<{ total: number }>()) ?? {
      total: 0,
    };
    const bootstrapAdmin = total === 0 && c.env.BOOTSTRAP_ADMIN === 'true';

    const id = newId();
    const timestamp = now();
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, email_lower, password_hash, full_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.email,
        body.email,
        await hashPassword(body.password),
        body.fullName,
        bootstrapAdmin ? 'admin' : 'employee',
        timestamp,
        timestamp,
      )
      .run();

    const user = await loadUserById(c.env, id);
    if (!user) throw ApiError.internal('Account could not be created');

    await audit(c, 'user.registered', 'user', id, { bootstrapAdmin });
    c.executionCtx.waitUntil(
      runAutomation(c.env, 'user_registered', { id, role: user.role, email: user.email, department: user.department }),
    );
    return created(c, await issueSession(c, user));
  },
);

authRoutes.post(
  '/login',
  rateLimit({ name: 'login-ip', limit: 20, windowSeconds: 900 }),
  async (c) => {
    const body = await parseJson(c, loginSchema);

    // Second bucket keyed by account so one attacker cannot lock everyone out,
    // and so distributed attempts against one account are still throttled.
    const accountKey = `rl:login-account:${await sha256Hex(body.email)}`;
    const attempts = (await c.env.RATE_LIMIT.get<number>(accountKey, 'json')) ?? 0;
    if (attempts >= 10) throw ApiError.rateLimited('Too many failed sign-in attempts. Try again later.');

    const user = await c.env.DB.prepare(`SELECT * FROM users WHERE email_lower = ? AND deleted_at IS NULL`)
      .bind(body.email)
      .first<UserRow>();

    const valid = user ? await verifyPassword(body.password, user.password_hash) : false;

    if (!user || !valid) {
      await c.env.RATE_LIMIT.put(accountKey, JSON.stringify(attempts + 1), { expirationTtl: 900 });
      await audit(c, 'auth.login_failed', 'user', user?.id ?? null, { email: body.email });
      throw ApiError.unauthorized('Incorrect email or password');
    }
    if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

    await c.env.RATE_LIMIT.delete(accountKey);
    await c.env.DB.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).bind(now(), user.id).run();
    await audit(c, 'auth.login', 'user', user.id);

    return ok(c, await issueSession(c, user));
  },
);

authRoutes.post('/refresh', rateLimit({ name: 'refresh', limit: 120, windowSeconds: 900 }), async (c) => {
  const body = c.req.header('content-type')?.includes('application/json')
    ? await parseJson(c, refreshSchema)
    : { refreshToken: undefined };
  const token = cookieToken(c) ?? body.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token supplied');

  const hash = await sha256Hex(token);
  const session = await c.env.DB.prepare(`SELECT * FROM sessions WHERE refresh_token_hash = ?`)
    .bind(hash)
    .first<{ id: string; user_id: string; expires_at: string; revoked_at: string | null }>();

  if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
    // Reuse of a revoked token is a strong signal of theft: kill every session.
    if (session?.revoked_at) {
      await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .bind(now(), session.user_id)
        .run();
      await audit(c, 'auth.refresh_reuse_detected', 'user', session.user_id);
    }
    clearRefreshCookie(c);
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  const user = await loadUserById(c.env, session.user_id);
  if (!user || !user.is_active) {
    clearRefreshCookie(c);
    throw ApiError.unauthorized('Session is no longer valid');
  }

  // Rotate: the presented token is revoked and a brand new one is issued.
  await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE id = ?`).bind(now(), session.id).run();
  return ok(c, await issueSession(c, user));
});

authRoutes.post('/logout', async (c) => {
  const body = c.req.header('content-type')?.includes('application/json')
    ? await parseJson(c, refreshSchema)
    : { refreshToken: undefined };
  const token = cookieToken(c) ?? body.refreshToken;
  if (token) {
    await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL`)
      .bind(now(), await sha256Hex(token))
      .run();
  }
  clearRefreshCookie(c);
  return ok(c, { success: true });
});

authRoutes.post('/logout-all', requireAuth(), async (c) => {
  const user = c.get('user')!;
  await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(now(), user.id)
    .run();
  clearRefreshCookie(c);
  await audit(c, 'auth.logout_all', 'user', user.id);
  return ok(c, { success: true });
});

authRoutes.get('/me', requireAuth(), async (c) => {
  const user = await loadUserById(c.env, c.get('user')!.id);
  if (!user) throw ApiError.unauthorized();
  return ok(c, publicUser(user));
});

const updateMeSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.union([z.string().trim().max(40), z.literal(''), z.null()]).optional(),
  department: z.union([z.string().trim().max(120), z.literal(''), z.null()]).optional(),
  avatarUrl: z.union([z.string().trim().url().max(500), z.literal(''), z.null()]).optional(),
});

authRoutes.put('/me', requireAuth(), async (c) => {
  const body = await parseJson(c, updateMeSchema);
  const user = c.get('user')!;

  const fields: Record<string, unknown> = {};
  if (body.fullName !== undefined) fields.full_name = body.fullName;
  if (body.phone !== undefined) fields.phone = body.phone || null;
  if (body.department !== undefined) fields.department = body.department || null;
  if (body.avatarUrl !== undefined) fields.avatar_url = body.avatarUrl || null;

  if (Object.keys(fields).length > 0) {
    fields.updated_at = now();
    const keys = Object.keys(fields);
    await c.env.DB.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => fields[k]), user.id)
      .run();
    await audit(c, 'user.profile_updated', 'user', user.id, { fields: keys });
  }

  const updated = await loadUserById(c.env, user.id);
  return ok(c, publicUser(updated!));
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

authRoutes.post(
  '/change-password',
  requireAuth(),
  rateLimit({ name: 'change-password', limit: 10, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseJson(c, changePasswordSchema);
    const current = await loadUserById(c.env, c.get('user')!.id);
    if (!current) throw ApiError.unauthorized();

    if (!(await verifyPassword(body.currentPassword, current.password_hash))) {
      await audit(c, 'auth.password_change_failed', 'user', current.id);
      throw ApiError.unauthorized('Current password is incorrect');
    }
    if (await verifyPassword(body.newPassword, current.password_hash)) {
      throw ApiError.validation({ newPassword: ['Choose a password you have not used before'] });
    }

    await c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .bind(await hashPassword(body.newPassword), now(), current.id)
      .run();
    // Invalidate every other session after a credential change.
    await c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
      .bind(now(), current.id)
      .run();
    clearRefreshCookie(c);
    await audit(c, 'auth.password_changed', 'user', current.id);

    return ok(c, { success: true, message: 'Password updated. Please sign in again.' });
  },
);

authRoutes.post(
  '/password-reset/request',
  rateLimit({ name: 'password-reset', limit: 5, windowSeconds: 3600 }),
  async (c) => {
    const { email } = await parseJson(c, z.object({ email: emailSchema }));
    const user = await c.env.DB.prepare(`SELECT * FROM users WHERE email_lower = ? AND deleted_at IS NULL`)
      .bind(email)
      .first<UserRow>();

    if (user && user.is_active) {
      const token = randomToken(32);
      await c.env.DB.prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(newId(), user.id, await sha256Hex(token), new Date(Date.now() + 30 * 60 * 1000).toISOString(), now())
        .run();

      const link = `${(c.env.APP_URL ?? '').replace(/\/$/, '')}/auth?reset=${token}`;
      await sendEmail(c.env, {
        to: user.email,
        subject: 'Reset your TechPros ITSM password',
        text: `A password reset was requested for your account.\n\nOpen this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not request this you can safely ignore this email.`,
      });
      await audit(c, 'auth.password_reset_requested', 'user', user.id);
    }

    // Always the same response — never confirm whether an account exists.
    return ok(c, {
      success: true,
      message: 'If an account exists for that address, a password reset link has been sent.',
    });
  },
);

authRoutes.post(
  '/password-reset/confirm',
  rateLimit({ name: 'password-reset-confirm', limit: 10, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseJson(
      c,
      z.object({ token: z.string().min(10).max(200), newPassword: passwordSchema }),
    );
    const record = await c.env.DB.prepare(
      `SELECT * FROM password_reset_tokens WHERE token_hash = ?`,
    )
      .bind(await sha256Hex(body.token))
      .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

    if (!record || record.used_at || new Date(record.expires_at) <= new Date()) {
      throw ApiError.badRequest('This reset link is invalid or has expired');
    }

    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(
        await hashPassword(body.newPassword),
        now(),
        record.user_id,
      ),
      c.env.DB.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).bind(now(), record.id),
      c.env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).bind(
        now(),
        record.user_id,
      ),
    ]);

    await audit(c, 'auth.password_reset_completed', 'user', record.user_id);
    return ok(c, { success: true, message: 'Password updated. You can now sign in.' });
  },
);
