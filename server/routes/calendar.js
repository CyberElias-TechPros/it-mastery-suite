const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get calendar events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;

    let query = 'SELECT * FROM calendar_events WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (start) {
      query += ` AND start_date >= $${paramCount}`;
      values.push(start);
      paramCount++;
    }

    if (end) {
      query += ` AND end_date <= $${paramCount}`;
      values.push(end);
      paramCount++;
    }

    query += ' ORDER BY start_date';

    const result = await pool.query(query, values);
    res.json({ events: result.rows });

  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, startDate, endDate, eventType, location } = req.body;

    const result = await pool.query(`
      INSERT INTO calendar_events (title, description, start_date, end_date, event_type, location, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [title, description, startDate, endDate, eventType, location, req.user.id]);

    res.status(201).json({
      event: result.rows[0],
      message: 'Event created successfully'
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

module.exports = router;