/**
 * Cloudflare Cron Triggers
 * Scheduled tasks: cleanup, reports, synchronization, maintenance.
 */

import { handleCleanup } from './tasks/cleanup.js';
import { handleScheduledReports } from './tasks/reports.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron, new Date().toISOString());

    // Daily cleanup at 2 AM
    if (event.cron.includes('0 2 * * *')) {
      await handleCleanup(env, ctx);
    }

    // Weekly reports on Monday at 3 AM
    if (event.cron.includes('0 3 * * 1')) {
      await handleScheduledReports(env, ctx);
    }

    return new Response(JSON.stringify({
      status: 'Cron executed',
      cron: event.cron,
      timestamp: new Date().toISOString()
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
