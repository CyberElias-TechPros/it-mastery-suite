const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdminOrTech } = require('../middleware/auth');

const router = express.Router();

// Get diesel logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, p.full_name as recorded_by_name
      FROM diesel_logs d
      LEFT JOIN profiles p ON d.recorded_by = p.id
      ORDER BY d.date DESC, d.created_at DESC
    `);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get diesel logs error:', error);
    res.status(500).json({ error: 'Failed to fetch diesel logs' });
  }
});

// Create diesel log
router.post('/', authenticateToken, requireAdminOrTech, async (req, res) => {
  try {
    const { generatorId, date, openingStock, closingStock, startTime, stopTime, notes } = req.body;

    // Calculate consumed stock and running hours
    const consumedStock = openingStock - closingStock;
    let runningHours = null;

    if (startTime && stopTime) {
      const start = new Date(`1970-01-01T${startTime}`);
      const stop = new Date(`1970-01-01T${stopTime}`);
      runningHours = (stop - start) / (1000 * 60 * 60);
    }

    const result = await pool.query(`
      INSERT INTO diesel_logs (
        generator_id, date, opening_stock, closing_stock,
        start_time, stop_time, running_hours, consumed_stock, recorded_by, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [generatorId, date, openingStock, closingStock, startTime, stopTime, runningHours, consumedStock, req.user.id, notes]);

    res.status(201).json({
      log: result.rows[0],
      message: 'Diesel log recorded successfully'
    });

  } catch (error) {
    console.error('Create diesel log error:', error);
    res.status(500).json({ error: 'Failed to create diesel log' });
  }
});

module.exports = router;