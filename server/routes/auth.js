const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Email transporter
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });

  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });

  return { accessToken, refreshToken };
};

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM profiles WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user with hashed password
    const result = await pool.query(
      `INSERT INTO profiles (email, full_name, role, password_hash)
       VALUES ($1, $2, 'employee', $3)
       RETURNING id, email, full_name, role`,
      [email, fullName, hashedPassword]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'user_registered', 'user', user.id]
    );

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      `SELECT id, email, full_name, role, branch_id, department_id, password_hash
       FROM profiles WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password using bcrypt
    // Note: For users migrated from Supabase without a password_hash,
    // we require them to reset their password via /auth/forgot-password
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'Account requires password reset',
        message: 'Please use the forgot-password feature to set a new password.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, 'user_login', 'user', user.id, req.ip, req.get('User-Agent')]
    );

    res.json({
      user,
      accessToken,
      refreshToken,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const { accessToken, newRefreshToken } = generateTokens(decoded.userId);

    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, b.name as branch_name, d.name as department_name
       FROM profiles p
       LEFT JOIN branches b ON p.branch_id = b.id
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('fullName').optional().trim().isLength({ min: 2 }),
  body('phone').optional().isMobilePhone(),
  body('department').optional().isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, phone, department } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(fullName);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    if (department !== undefined) {
      updates.push(`department_id = $${paramCount++}`);
      values.push(department);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const result = await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'profile_updated', 'user', req.user.id]
    );

    res.json({
      user: result.rows[0],
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const result = await pool.query(
      'SELECT id FROM profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store reset token (you'd typically store this in a separate table)
    // For now, we'll just send a success response

    // Send email
    if (process.env.SMTP_HOST) {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your TechPros ITSM account.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      });
    }

    res.json({ message: 'If the email exists, a reset link has been sent' });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Logout (client-side token removal, but we can log the activity)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'user_logout', 'user', req.user.id, req.ip, req.get('User-Agent')]
    );

    res.json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;