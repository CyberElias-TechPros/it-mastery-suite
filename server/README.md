# TechPros ITSM API Server

A comprehensive Node.js Express API server for the TechPros IT Service Management system.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **RESTful API**: Complete CRUD operations for all ITSM modules
- **Security**: Rate limiting, input validation, CORS, helmet security headers
- **File Upload**: Multer-based file handling with type validation
- **Email Notifications**: Nodemailer integration for automated alerts
- **Database**: PostgreSQL with connection pooling
- **Logging**: Morgan request logging with activity tracking
- **Compression**: Response compression for better performance

## 📋 Prerequisites

- Node.js 16+
- PostgreSQL database
- SMTP server for email notifications (optional)

## 🛠️ Installation

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/techpros_itsm

   # JWT
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=24h
   JWT_REFRESH_EXPIRE=7d

   # Email (optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password

   # File Upload
   MAX_FILE_SIZE=5242880
   ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf
   ```

4. **Database Setup:**
   - Apply the migration from `../apply_migration.sql` to your PostgreSQL database
   - Or use the Supabase web interface to create tables manually

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured PORT).

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}
```

#### POST `/api/auth/login`
Authenticate user and get tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### GET `/api/auth/profile`
Get current user profile (requires authentication).

#### PUT `/api/auth/profile`
Update user profile (requires authentication).

### Tickets API

#### GET `/api/tickets`
Get all tickets with filtering and pagination.

**Query Parameters:**
- `status`: Filter by status (open, in_progress, resolved, closed)
- `priority`: Filter by priority (low, medium, high, critical)
- `category`: Filter by category
- `search`: Search in title, description, ticket number
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

#### POST `/api/tickets`
Create a new ticket (requires authentication).

#### GET `/api/tickets/:id`
Get detailed ticket information.

#### PUT `/api/tickets/:id`
Update ticket (admin/technician only).

#### POST `/api/tickets/:id/comments`
Add comment to ticket.

#### POST `/api/tickets/:id/attachments`
Upload file attachment to ticket.

### Assets API

#### GET `/api/assets`
Get all assets with filtering.

#### POST `/api/assets`
Create new asset (admin/technician only).

#### PUT `/api/assets/:id`
Update asset (admin/technician only).

### Expenses API

#### GET `/api/expenses`
Get all expenses with filtering.

#### POST `/api/expenses`
Record new expense (requires authentication).

### Users API (Admin Only)

#### GET `/api/users`
Get all users (admin only).

#### PUT `/api/users/:id`
Update user (admin only).

### Other APIs

- **Diesel Logs**: `/api/diesel`
- **Vendors**: `/api/vendors`
- **Calendar Events**: `/api/calendar`
- **Knowledge Base**: `/api/knowledge-base`
- **Reports**: `/api/reports`
- **Automation Rules**: `/api/automation` (admin only)
- **Notifications**: `/api/notifications`
- **System Health**: `/api/system` (admin only)

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### User Roles

- **admin**: Full system access
- **technician**: IT support and asset management
- **employee**: Basic ticket creation and viewing

## 📁 File Upload

Files are uploaded to the `uploads/` directory. Supported formats:
- Images: JPEG, PNG, GIF
- Documents: PDF

Maximum file size: 5MB (configurable)

## 📧 Email Notifications

Configure SMTP settings in `.env` for automated email notifications:
- Ticket assignments
- SLA breaches
- System alerts
- Password resets

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: All inputs validated with express-validator
- **CORS**: Configured for frontend origin
- **Helmet**: Security headers
- **Password Hashing**: bcrypt with 12 rounds
- **SQL Injection Protection**: Parameterized queries

## 📊 Database Schema

The system uses 20+ PostgreSQL tables including:

- `profiles` - User accounts and roles
- `tickets` - IT support tickets
- `assets` - IT asset inventory
- `expenses` - Financial expense tracking
- `diesel_logs` - Generator fuel consumption
- `vendors` - Supplier management
- `calendar_events` - Scheduled maintenance
- `kb_articles` - Knowledge base
- `automation_rules` - Workflow automation
- `notifications` - User notifications
- `activity_logs` - Audit trail

## 🔧 Development

### Project Structure
```
server/
├── config/
│   └── database.js          # Database connection
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── ...                 # Other middleware
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── tickets.js          # Ticket management
│   ├── assets.js           # Asset management
│   ├── expenses.js         # Expense tracking
│   └── ...                 # Other route files
├── uploads/                # File uploads directory
├── .env.example           # Environment template
├── package.json           # Dependencies
├── server.js              # Main application
└── README.md              # This file
```

### Adding New Routes

1. Create route file in `routes/` directory
2. Import and use in `server.js`
3. Add authentication middleware as needed
4. Include input validation

### Testing

```bash
npm test
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your_production_secret
FRONTEND_URL=https://yourdomain.com
```

### PM2 Process Manager

```bash
npm install -g pm2
pm2 start server.js --name "techpros-api"
pm2 startup
pm2 save
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📞 Support

For issues or questions:
1. Check the logs in the console
2. Verify database connection
3. Ensure environment variables are set correctly
4. Check network connectivity for SMTP

## 📄 License

MIT License - see LICENSE file for details.

---

**TechPros ITSM API Server** — Complete IT service management backend.  
**Status:** Production Candidate (auth secured, validation added, deployment configs ready). See `AUDIT.md` for full assessment.