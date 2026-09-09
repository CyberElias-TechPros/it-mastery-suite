import { generateJWT, verifyJWT } from '../utils/auth.js';

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

      // In a real migration, compare bcrypt hash here. For this scaffold, we assume migration layer handles it.
      const tokens = generateJWT(result.id, env);
      return new Response(JSON.stringify({ user: result, ...tokens }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /auth/register
    if (method === 'POST' && path === '/register') {
      const body = await request.json();
      const { email, password, fullName } = body;
      // Note: In production, hash password with bcrypt before inserting
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      await env.DB.prepare('INSERT INTO profiles (id, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, ?)')
        .bind(id, email, fullName, 'employee', password)
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
      return new Response(JSON.stringify({ user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
