const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all expenses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, category, branch, startDate, endDate, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT
        e.*,
        p.full_name as recorded_by_name,
        a.full_name as approved_by_name,
        b.name as branch_name,
        d.name as department_name,
        v.name as vendor_name
      FROM expenses e
      LEFT JOIN profiles p ON e.recorded_by = p.id
      LEFT JOIN profiles a ON e.approved_by = a.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN vendors v ON e.vendor_id = v.id
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`(e.title ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (category && category !== 'all') {
      conditions.push(`e.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (branch && branch !== 'all') {
      conditions.push(`e.branch_id = $${paramCount}`);
      values.push(branch);
      paramCount++;
    }

    if (startDate) {
      conditions.push(`e.expense_date >= $${paramCount}`);
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      conditions.push(`e.expense_date <= $${paramCount}`);
      values.push(endDate);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY e.expense_date DESC`;

    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM expenses e`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      expenses: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create expense
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 2 }),
  body('amount').isFloat({ min: 0 }),
  body('category').exists(),
  body('expenseDate').isISO8601()
], logActivity('expense_created', 'expense'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, amount, category, vendorId, branchId, departmentId, expenseDate } = req.body;

    const result = await pool.query(`
      INSERT INTO expenses (
        title, description, amount, category, vendor_id,
        branch_id, department_id, expense_date, recorded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [title, description, amount, category, vendorId, branchId, departmentId, expenseDate, req.user.id]);

    res.status(201).json({
      expense: result.rows[0],
      message: 'Expense recorded successfully'
    });

  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Get expense statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    // Current month expenses
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_expenses,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        SUM(CASE WHEN expense_date >= $1 THEN amount ELSE 0 END) as monthly_total,
        COUNT(CASE WHEN approved_at IS NOT NULL THEN 1 END) as approved_expenses,
        COUNT(CASE WHEN approved_at IS NULL THEN 1 END) as pending_approval
      FROM expenses
    `, [startOfMonth]);

    res.json({ stats: result.rows[0] });

  } catch (error) {
    console.error('Get expense stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;