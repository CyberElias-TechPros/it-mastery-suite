import { generateJWT, verifyJWT } from '../utils/auth.js';

const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000; // Workers CPU ceiling (higher counts 500 auth paths)
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2$100000$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return { ok: false, legacy: true };
    let iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations)) return { ok: false, legacy: true };
    iterations = Math.min(Math.max(iterations, 1000), 600_000);
    const salt = unb64(parts[2]);
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      key,
      256,
    );
    const a = b64(new Uint8Array(bits));
    let diff = a.length ^ parts[3].length;
    for (let i = 0; i < Math.max(a.length, parts[3].length); i++)
      diff |= (a.charCodeAt(i) || 0) ^ (parts[3].charCodeAt(i) || 0);
    return { ok: diff === 0, legacy: false };
  } catch {
    return { ok: false, legacy: true };
  }
}

const safeUser = (u) => {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
};

export default {
  async handle(path, method, request, env, ctx) {
    // POST /auth/login
    if (method === 'POST' && path === '/login') {
      const body = await request.json();
      const { email, password } = body;

      const stmt = env.DB.prepare('SELECT * FROM profiles WHERE email = ?');
      const result = await stmt.bind(email).first();

      if (!result) return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      if (!result.password_hash) return new Response(JSON.stringify({ error: 'Account requires password reset' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

      // Transparent upgrade: accounts created before hashing verify against
      // the stored plaintext once, then get a real hash. Unknown format fails closed.
      let authed = false;
      if (String(result.password_hash).startsWith('pbkdf2$')) {
        authed = (await verifyPassword(password, result.password_hash)).ok;
      } else if (password === result.password_hash) {
        authed = true;
        const upgraded = await hashPassword(password);
        await env.DB.prepare('UPDATE profiles SET password_hash = ? WHERE id = ?').bind(upgraded, result.id).run();
      }
      if (!authed) return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const tokens = generateJWT(result.id, env);
      return new Response(JSON.stringify({ user: safeUser(result), ...tokens }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /auth/register
    if (method === 'POST' && path === '/register') {
      const body = await request.json();
      const { email, password, fullName } = body;
      if (!email || !password) return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      await env.DB.prepare('INSERT INTO profiles (id, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?)')
        .bind(id, email, fullName, 'employee', await hashPassword(password))
        .run();
      const tokens = generateJWT(id, env);
      return new Response(JSON.stringify({ user: { id, email, full_name: fullName, role: 'employee' }, ...tokens }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    // GET /auth/profile
    if (method === 'GET' && path === '/profile') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token, env);
      if (!payload) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const stmt = env.DB.prepare('SELECT * FROM profiles WHERE id = ?');
      const user = await stmt.bind(payload.userId).first();
      return new Response(JSON.stringify({ user: safeUser(user) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /auth/refresh
    if (method === 'POST' && path === '/refresh') {
      const body = await request.json();
      const { refreshToken } = body;
      if (!refreshToken) return new Response(JSON.stringify({ error: 'Refresh token required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const payload = verifyJWT(refreshToken, env);
      if (!payload) return new Response(JSON.stringify({ error: 'Invalid refresh token' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      const tokens = generateJWT(payload.userId, env);
      return new Response(JSON.stringify(tokens), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Auth route not found', path, method }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
};
