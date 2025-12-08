const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateToken, requireAdminOrTech, logActivity } = require('../middleware/auth');

const router = express.Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/tickets'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `ticket-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 }, // 5MB default
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Get all tickets with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      priority,
      category,
      assigned_to,
      search,
      page = 1,
      limit = 10
    } = req.query;

    let query = `
      SELECT
        t.*,
        p.full_name as created_by_name,
        a.full_name as assigned_to_name,
        COUNT(tc.id) as comment_count,
        COUNT(att.id) as attachment_count
      FROM tickets t
      LEFT JOIN profiles p ON t.created_by = p.id
      LEFT JOIN profiles a ON t.assigned_to = a.id
      LEFT JOIN ticket_comments tc ON t.id = tc.ticket_id
      LEFT JOIN attachments att ON t.id::text = att.resource_id AND att.resource_type = 'ticket'
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Apply role-based filtering
    if (!['admin', 'technician'].includes(req.user.role)) {
      conditions.push(`(t.created_by = $${paramCount} OR t.assigned_to = $${paramCount})`);
      values.push(req.user.id);
      paramCount++;
    }

    if (status && status !== 'all') {
      conditions.push(`t.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (priority && priority !== 'all') {
      conditions.push(`t.priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (category && category !== 'all') {
      conditions.push(`t.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (assigned_to) {
      conditions.push(`t.assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;
    }

    if (search) {
      conditions.push(`(
        t.title ILIKE $${paramCount} OR
        t.description ILIKE $${paramCount} OR
        t.ticket_number ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY t.id, p.full_name, a.full_name ORDER BY t.created_at DESC`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM tickets t`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countResult = await pool.query(countQuery, values.slice(0, -2)); // Remove limit and offset
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      tickets: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket with details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check permissions
    if (!['admin', 'technician'].includes(req.user.role)) {
      const permissionCheck = await pool.query(
        'SELECT id FROM tickets WHERE id = $1 AND (created_by = $2 OR assigned_to = $2)',
        [id, req.user.id]
      );
      if (permissionCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Get ticket details
    const ticketResult = await pool.query(`
      SELECT
        t.*,
        p.full_name as created_by_name,
        a.full_name as assigned_to_name
      FROM tickets t
      LEFT JOIN profiles p ON t.created_by = p.id
      LEFT JOIN profiles a ON t.assigned_to = a.id
      WHERE t.id = $1
    `, [id]);

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get comments
    const commentsResult = await pool.query(`
      SELECT
        tc.*,
        p.full_name as author_name
      FROM ticket_comments tc
      LEFT JOIN profiles p ON tc.user_id = p.id
      WHERE tc.ticket_id = $1
      ORDER BY tc.created_at ASC
    `, [id]);

    // Get attachments
    const attachmentsResult = await pool.query(
      'SELECT * FROM attachments WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC',
      ['ticket', id]
    );

    // Get related tickets (same category, similar keywords)
    const relatedResult = await pool.query(`
      SELECT id, ticket_number, title, status, priority
      FROM tickets
      WHERE category = $1 AND id != $2
      ORDER BY created_at DESC
      LIMIT 5
    `, [ticketResult.rows[0].category, id]);

    res.json({
      ticket: ticketResult.rows[0],
      comments: commentsResult.rows,
      attachments: attachmentsResult.rows,
      relatedTickets: relatedResult.rows
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create new ticket
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 3, max: 200 }),
  body('description').trim().isLength({ min: 10 }),
  body('category').isIn(['it_support', 'software', 'hardware', 'network', 'other']),
  body('priority').isIn(['low', 'medium', 'high', 'critical'])
], logActivity('ticket_created', 'ticket'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, category, priority } = req.body;

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

    // Calculate SLA due date based on priority
    const slaHours = { low: 168, medium: 72, high: 24, critical: 4 }[priority] || 72;
    const slaDueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const result = await pool.query(`
      INSERT INTO tickets (
        ticket_number, title, description, category, priority,
        status, created_by, sla_due_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      ticketNumber,
      title,
      description,
      category,
      priority,
      'open',
      req.user.id,
      slaDueDate
    ]);

    // Auto-assign logic (simple: assign to first available technician)
    const technicianResult = await pool.query(
      "SELECT id FROM profiles WHERE role = 'technician' ORDER BY id LIMIT 1"
    );

    if (technicianResult.rows.length > 0) {
      await pool.query(
        'UPDATE tickets SET assigned_to = $1 WHERE id = $2',
        [technicianResult.rows[0].id, result.rows[0].id]
      );
      result.rows[0].assigned_to = technicianResult.rows[0].id;
    }

    res.status(201).json({
      ticket: result.rows[0],
      message: 'Ticket created successfully'
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Update ticket
router.put('/:id', authenticateToken, requireAdminOrTech, [
  body('title').optional().trim().isLength({ min: 3, max: 200 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('assigned_to').optional().isUUID()
], logActivity('ticket_updated', 'ticket'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Build update query
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

    // Handle status changes
    if (updates.status === 'resolved') {
      updateFields.push(`resolved_at = $${paramCount}`);
      values.push(new Date());
      paramCount++;
    } else if (updates.status === 'closed') {
      updateFields.push(`closed_at = $${paramCount}`);
      values.push(new Date());
      paramCount++;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      ticket: result.rows[0],
      message: 'Ticket updated successfully'
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Add comment to ticket
router.post('/:id/comments', authenticateToken, [
  body('comment').trim().isLength({ min: 1, max: 1000 }),
  body('isInternal').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { comment, isInternal = false } = req.body;

    // Check permissions for internal comments
    if (isInternal && !['admin', 'technician'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cannot add internal comments' });
    }

    // Check if user can access this ticket
    if (!['admin', 'technician'].includes(req.user.role)) {
      const permissionCheck = await pool.query(
        'SELECT id FROM tickets WHERE id = $1 AND (created_by = $2 OR assigned_to = $2)',
        [id, req.user.id]
      );
      if (permissionCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(`
      INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal)
      VALUES ($1, $2, $3, $4)
      RETURNING *, (
        SELECT full_name FROM profiles WHERE id = $2
      ) as author_name
    `, [id, req.user.id, comment, isInternal]);

    res.status(201).json({
      comment: result.rows[0],
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Upload attachment to ticket
router.post('/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if user can access this ticket
    if (!['admin', 'technician'].includes(req.user.role)) {
      const permissionCheck = await pool.query(
        'SELECT id FROM tickets WHERE id = $1 AND (created_by = $2 OR assigned_to = $2)',
        [id, req.user.id]
      );
      if (permissionCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(`
      INSERT INTO attachments (
        file_name, file_path, file_size, mime_type,
        uploaded_by, resource_type, resource_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      req.user.id,
      'ticket',
      id
    ]);

    res.status(201).json({
      attachment: result.rows[0],
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get ticket statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    let whereClause = '';
    const values = [];

    if (!['admin', 'technician'].includes(req.user.role)) {
      whereClause = 'WHERE (created_by = $1 OR assigned_to = $1)';
      values.push(req.user.id);
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN priority IN ('high', 'critical') THEN 1 END) as high_priority,
        COUNT(CASE WHEN sla_due_date < NOW() AND status NOT IN ('resolved', 'closed') THEN 1 END) as overdue
      FROM tickets
      ${whereClause}
    `, values);

    res.json({ stats: result.rows[0] });

  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;