const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, role, branch, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT
        p.*,
        b.name as branch_name,
        d.name as department_name,
        COUNT(t.id) as ticket_count
      FROM profiles p
      LEFT JOIN branches b ON p.branch_id = b.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN tickets t ON (t.created_by = p.id OR t.assigned_to = p.id)
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`(p.full_name ILIKE $${paramCount} OR p.email ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (role && role !== 'all') {
      conditions.push(`p.role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (branch && branch !== 'all') {
      if (branch === 'unassigned') {
        conditions.push(`p.branch_id IS NULL`);
      } else {
        conditions.push(`p.branch_id = $${paramCount}`);
        values.push(branch);
        paramCount++;
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY p.id, b.name, d.name ORDER BY p.full_name`;

    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM profiles p`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'technician' THEN 1 END) as technicians,
        COUNT(CASE WHEN role = 'employee' THEN 1 END) as employees,
        COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as assigned_users
      FROM profiles
    `);

    res.json({ stats: result.rows[0] });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('fullName').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['admin', 'technician', 'employee']),
  body('branchId').optional().isUUID(),
  body('departmentId').optional().isUUID()
], logActivity('user_updated', 'user'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { fullName, email, role, branchId, departmentId } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(fullName);
    }

    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (branchId !== undefined) {
      updates.push(`branch_id = $${paramCount++}`);
      values.push(branchId);
    }

    if (departmentId !== undefined) {
      updates.push(`department_id = $${paramCount++}`);
      values.push(departmentId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: result.rows[0],
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;