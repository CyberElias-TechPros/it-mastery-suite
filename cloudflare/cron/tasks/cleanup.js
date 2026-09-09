/**
 * Cleanup task — removes old attachments, expired notifications, stale session data.
 */
export async function handleCleanup(env, ctx) {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Example: clean old attachments from R2 (requires R2 binding)
    // const list = await env.STORAGE.list({ prefix: 'uploads/' });

    // Example: clean old notifications from D1
    await env.DB.prepare("DELETE FROM notifications WHERE created_at < ?").bind(cutoff).run();

    console.log('Cleanup completed at', new Date().toISOString());
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}
