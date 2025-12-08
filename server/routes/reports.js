const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get saved reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM custom_reports WHERE created_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ reports: result.rows });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Create custom report
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, config } = req.body;

    const result = await pool.query(`
      INSERT INTO custom_reports (name, description, config, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description, JSON.stringify(config), req.user.id]);

    res.status(201).json({
      report: result.rows[0],
      message: 'Report saved successfully'
    });

  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

module.exports = router;