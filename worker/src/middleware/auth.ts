import type { MiddlewareHandler } from 'hono';
import { ApiError } from '../lib/errors';
import { verifyJwt } from '../lib/crypto';
import type { AppEnv, AuthUser, Role } from '../types';

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/**
 * Verifies the access token and loads the *current* user row, so that a role
 * change or deactivation takes effect immediately instead of when the token
 * expires.
 */
export const requireAuth = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const token = bearer(c.req.header('authorization'));
  if (!token) throw ApiError.unauthorized();

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) throw ApiError.unauthorized('Session expired or invalid');

  const user = await c.env.DB.prepare(
    `SELECT id, email, role, full_name, is_active FROM users WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(payload.sub)
    .first<{ id: string; email: string; role: Role; full_name: string | null; is_active: number }>();

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

  const authUser: AuthUser = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
  c.set('user', authUser);
  await next();
};

/** Role gate. Always applied *after* requireAuth. */
export const requireRole =
  (...roles: Role[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const user = c.get('user');
    if (!user) throw ApiError.unauthorized();
    if (!roles.includes(user.role)) throw ApiError.forbidden();
    await next();
  };

export const isStaff = (role: Role): boolean => role === 'admin' || role === 'technician';

/** Helper used inside handlers for record-level ownership checks. */
export function assertOwnerOrRole(user: AuthUser, ownerId: string | null | undefined, ...roles: Role[]): void {
  if (user.id === ownerId) return;
  if (roles.includes(user.role)) return;
  throw ApiError.forbidden();
}
