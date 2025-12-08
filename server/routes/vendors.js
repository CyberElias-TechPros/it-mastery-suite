const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all vendors
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors ORDER BY name');
    res.json({ vendors: result.rows });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// Create vendor
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address, category } = req.body;

    const result = await pool.query(`
      INSERT INTO vendors (name, contact_person, email, phone, address, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, contactPerson, email, phone, address, category]);

    res.status(201).json({
      vendor: result.rows[0],
      message: 'Vendor created successfully'
    });

  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

module.exports = router;