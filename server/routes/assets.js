const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireAdminOrTech, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all assets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status, type, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT
        a.*,
        p.full_name as assigned_to_name,
        b.name as branch_name,
        d.name as department_name
      FROM assets a
      LEFT JOIN profiles p ON a.assigned_to = p.id
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN departments d ON a.department_id = d.id
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`(
        a.name ILIKE $${paramCount} OR
        a.asset_tag ILIKE $${paramCount} OR
        a.serial_number ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (status && status !== 'all') {
      conditions.push(`a.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (type && type !== 'all') {
      conditions.push(`a.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY a.created_at DESC`;

    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM assets a`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      assets: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Create new asset
router.post('/', authenticateToken, requireAdminOrTech, [
  body('assetTag').trim().isLength({ min: 1 }),
  body('name').trim().isLength({ min: 2 }),
  body('type').isIn(['laptop', 'desktop', 'server', 'router', 'switch', 'printer', 'ups', 'inverter', 'mobile_device', 'software_license', 'other'])
], logActivity('asset_created', 'asset'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      assetTag, name, type, model, serialNumber,
      purchaseDate, purchasePrice, warrantyExpiry,
      assignedTo, departmentId, branchId, location, notes
    } = req.body;

    const result = await pool.query(`
      INSERT INTO assets (
        asset_tag, name, type, model, serial_number,
        purchase_date, purchase_price, warranty_expiry,
        assigned_to, department_id, branch_id, location, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      assetTag, name, type, model, serialNumber,
      purchaseDate, purchasePrice, warrantyExpiry,
      assignedTo, departmentId, branchId, location, notes
    ]);

    res.status(201).json({
      asset: result.rows[0],
      message: 'Asset created successfully'
    });

  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// Update asset
router.put('/:id', authenticateToken, requireAdminOrTech, logActivity('asset_updated', 'asset'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== 'id') {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE assets SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({
      asset: result.rows[0],
      message: 'Asset updated successfully'
    });

  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Get asset statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_assets,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_assets,
        COUNT(CASE WHEN status = 'in_maintenance' THEN 1 END) as maintenance_assets,
        COUNT(CASE WHEN status = 'retired' THEN 1 END) as retired_assets,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed_assets,
        SUM(purchase_price) as total_value
      FROM assets
    `);

    res.json({ stats: result.rows[0] });

  } catch (error) {
    console.error('Get asset stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;