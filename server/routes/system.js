const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get system health metrics
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Mock system health data - in production, you'd collect real metrics
    const healthData = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      database: {
        status: 'healthy',
        connectionCount: 0,
        lastBackup: new Date().toISOString()
      },
      services: [
        { name: 'Web Server', status: 'running', uptime: '99.9%' },
        { name: 'Database', status: 'running', uptime: '99.8%' },
        { name: 'Email Service', status: 'running', uptime: '99.5%' }
      ]
    };

    res.json(healthData);

  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// Get system statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM profiles) as total_users,
        (SELECT COUNT(*) FROM tickets) as total_tickets,
        (SELECT COUNT(*) FROM assets) as total_assets,
        (SELECT COUNT(*) FROM expenses WHERE expense_date >= date_trunc('month', CURRENT_DATE)) as monthly_expenses,
        (SELECT COUNT(*) FROM notifications WHERE created_at >= CURRENT_DATE) as today_notifications
    `);

    res.json({ stats: stats.rows[0] });

  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

module.exports = router;