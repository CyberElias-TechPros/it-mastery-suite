const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireAdminOrTech } = require('../middleware/auth');

const router = express.Router();

// Get KB articles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, category } = req.query;

    let query = 'SELECT * FROM kb_articles WHERE is_published = true';
    const values = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    if (category) {
      query += ` AND category = $${paramCount}`;
      values.push(category);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    res.json({ articles: result.rows });

  } catch (error) {
    console.error('Get KB articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Create KB article
router.post('/', authenticateToken, requireAdminOrTech, async (req, res) => {
  try {
    const { title, content, category, tags } = req.body;

    const result = await pool.query(`
      INSERT INTO kb_articles (title, content, category, tags, author_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [title, content, category, tags, req.user.id]);

    res.status(201).json({
      article: result.rows[0],
      message: 'Article created successfully'
    });

  } catch (error) {
    console.error('Create KB article error:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

module.exports = router;