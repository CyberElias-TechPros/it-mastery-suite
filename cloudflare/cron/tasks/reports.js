/**
 * Scheduled Reports — generates weekly summary reports.
 */
export async function handleScheduledReports(env, ctx) {
  try {
    const result = await env.DB.prepare('SELECT COUNT(*) as total FROM tickets').first();
    console.log('Weekly report: total tickets =', result?.total || 0);
  } catch (err) {
    console.error('Scheduled reports error:', err);
  }
}
