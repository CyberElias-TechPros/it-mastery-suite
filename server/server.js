const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const assetRoutes = require('./routes/assets');
const dieselRoutes = require('./routes/diesel');
const expenseRoutes = require('./routes/expenses');
const vendorRoutes = require('./routes/vendors');
const calendarRoutes = require('./routes/calendar');
const kbRoutes = require('./routes/knowledgeBase');
const reportRoutes = require('./routes/reports');
const automationRoutes = require('./routes/automation');
const notificationRoutes = require('./routes/notifications');
const systemRoutes = require('./routes/system');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/diesel', dieselRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/knowledge-base', kbRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection test
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to PostgreSQL database');
  release();
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TechPros ITSM API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  pool.end(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  pool.end(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

module.exports = app;