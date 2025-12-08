const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get automation rules
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM automation_rules ORDER BY created_at DESC');
    res.json({ rules: result.rows });
  } catch (error) {
    console.error('Get automation rules error:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// Create automation rule
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, triggerEvent, conditions, actions } = req.body;

    const result = await pool.query(`
      INSERT INTO automation_rules (name, description, trigger_event, conditions, actions, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, triggerEvent, JSON.stringify(conditions), JSON.stringify(actions), req.user.id]);

    res.status(201).json({
      rule: result.rows[0],
      message: 'Automation rule created successfully'
    });

  } catch (error) {
    console.error('Create automation rule error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

module.exports = router;