const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Get user from database
    const result = await pool.query(
      'SELECT id, email, full_name, role, branch_id, department_id FROM profiles WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole('admin');

// Middleware to check if user is admin or technician
const requireAdminOrTech = requireRole('admin', 'technician');

// Middleware to check if user owns the resource or is admin/tech
const requireOwnershipOrAdmin = (resourceUserIdField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins and technicians can access everything
    if (['admin', 'technician'].includes(req.user.role)) {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.body[resourceUserIdField] || req.params[resourceUserIdField];
    if (req.user.id === resourceUserId) {
      return next();
    }

    return res.status(403).json({ error: 'Access denied' });
  };
};

// Middleware to log user activity
const logActivity = (action, resourceType, resourceId = null) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;

    res.send = function(data) {
      // Log activity after successful response
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        pool.query(
          `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user.id,
            action,
            resourceType,
            resourceId,
            req.ip,
            req.get('User-Agent')
          ]
        ).catch(err => console.error('Activity logging error:', err));
      }

      // Call original send method
      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireAdminOrTech,
  requireOwnershipOrAdmin,
  logActivity
};