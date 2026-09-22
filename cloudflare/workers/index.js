/**
 * TechPros ITSM — Full Cloudflare Worker API
 * Migration from Express (server/routes/*.js) to Workers.
 * Uses D1 (database), R2 (uploads), KV (config/cache).
 */

import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import assetRoutes from './routes/assets.js';
import expenseRoutes from './routes/expenses.js';
import vendorRoutes from './routes/vendors.js';
import calendarRoutes from './routes/calendar.js';
import kbRoutes from './routes/knowledgeBase.js';
import reportRoutes from './routes/reports.js';
import automationRoutes from './routes/automation.js';
import notificationRoutes from './routes/notifications.js';
import systemRoutes from './routes/system.js';
import userRoutes from './routes/users.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    // Health check
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        architecture: 'Cloudflare Worker + D1 + R2 + KV',
        bindings: { db: !!env.DB, storage: !!env.STORAGE, config: !!env.CONFIG }
      }), {
        status: 200,
        headers: corsHeaders(env)
      });
    }

    // Route all /api/* requests through the migrated handlers
    try {
      const response = await routeRequest(path, method, request, env, ctx);
      return addCorsHeaders(response, env);
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: err.message || 'Unknown error',
        path,
        method
      }), {
        status: 500,
        headers: corsHeaders(env)
      });
    }
  }
};

function handleCORS(request, env) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function corsHeaders(env) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function addCorsHeaders(response, env) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.FRONTEND_URL || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Migrate all routes from server/routes/*.js
// Route handlers receive the path with their prefix stripped (auth.js expects '/login', not '/auth/login').
const ROUTES = [
  ['/auth', authRoutes],
  ['/tickets', ticketRoutes],
  ['/assets', assetRoutes],
  ['/expenses', expenseRoutes],
  ['/vendors', vendorRoutes],
  ['/calendar', calendarRoutes],
  ['/knowledge-base', kbRoutes],
  ['/reports', reportRoutes],
  ['/automation', automationRoutes],
  ['/notifications', notificationRoutes],
  ['/system', systemRoutes],
  ['/users', userRoutes],
];

async function routeRequest(path, method, request, env, ctx) {
  for (const [prefix, handler] of ROUTES) {
    if (path === prefix || path.startsWith(prefix + '/')) {
      const rest = path.slice(prefix.length); // '' or '/...' — strip the prefix
      return await handler.handle(rest, method, request, env, ctx);
    }
  }

  // 404 for unhandled routes
  return new Response(JSON.stringify({ error: 'Route not found', path, method }), {
    status: 404,
    headers: corsHeaders(env)
  });
}
