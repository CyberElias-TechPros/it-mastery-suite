import { Hono } from 'hono';
import { requestId } from './middleware/request-id';
import { cors, securityHeaders } from './middleware/cors';
import { notFound, onError } from './middleware/error';
import { rateLimit } from './middleware/rate-limit';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { ticketRoutes } from './routes/tickets';
import { assetRoutes } from './routes/assets';
import { branchRoutes, departmentRoutes } from './routes/org';
import { dieselRoutes } from './routes/diesel';
import { purchaseOrderRoutes, vendorRoutes } from './routes/procurement';
import { budgetRoutes, expenseRoutes } from './routes/finance';
import { kbRoutes } from './routes/kb';
import { calendarRoutes } from './routes/calendar';
import { notificationRoutes } from './routes/notifications';
import { reportRoutes } from './routes/reports';
import { automationRoutes } from './routes/automation';
import { systemRoutes } from './routes/system';
import { uploadRoutes } from './routes/uploads';
import { dashboardRoutes } from './routes/dashboard';
import { handleScheduled } from './cron';
import { ApiError } from './lib/errors';
import type { AppEnv, Env } from './types';

const app = new Hono<AppEnv>();

app.use('*', requestId());
app.use('*', securityHeaders());
app.use('*', cors());

// Fail fast (and loudly, in the logs) if the deployment is missing its secret.
app.use('*', async (c, next) => {
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'The API is not configured correctly. Contact an administrator.');
  }
  await next();
});

// Baseline abuse protection for everything that is not covered by a stricter
// per-route limiter.
app.use('/api/*', rateLimit({ name: 'global', limit: 600, windowSeconds: 60 }));

app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/tickets', ticketRoutes);
app.route('/api/assets', assetRoutes);
app.route('/api/branches', branchRoutes);
app.route('/api/departments', departmentRoutes);
app.route('/api/diesel', dieselRoutes);
app.route('/api/vendors', vendorRoutes);
app.route('/api/purchase-orders', purchaseOrderRoutes);
app.route('/api/expenses', expenseRoutes);
app.route('/api/budgets', budgetRoutes);
app.route('/api/knowledge-base', kbRoutes);
app.route('/api/calendar', calendarRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/automation', automationRoutes);
app.route('/api/system', systemRoutes);
app.route('/api/attachments', uploadRoutes);
app.route('/api/dashboard', dashboardRoutes);

app.get('/', (c) =>
  c.json({
    data: {
      name: 'TechPros ITSM API',
      environment: c.env.ENVIRONMENT,
      documentation: 'https://github.com/CyberElias-TechPros/it-mastery-suite/blob/main/docs/API.md',
    },
  }),
);

app.notFound(notFound);
app.onError(onError);

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(event, env));
  },
} satisfies ExportedHandler<Env>;

export { app };
