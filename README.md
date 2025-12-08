# TechPros IT Service Management System

A comprehensive, full-featured IT Service Management (ITSM) platform built with React, Node.js, Express, and PostgreSQL.

## 🎯 Overview

TechPros ITSM is a complete enterprise-grade solution that includes:

- **16 Major Modules**: Tickets, Assets, Expenses, Diesel Tracking, Calendar, Vendors, Knowledge Base, Reports, Automation, Notifications, and more
- **Role-Based Access Control**: Admin, Technician, and Employee roles
- **Modern Tech Stack**: React 18, Node.js, Express, PostgreSQL
- **Production Ready**: Security, scalability, and comprehensive API

## 📋 Features

### ✅ Core Modules Implemented

#### 🎫 **Ticketing System**
- Complete ticket lifecycle management
- Priority levels and SLA tracking
- File attachments and comments
- Advanced filtering and search
- Auto-assignment and escalation

#### 💻 **Asset Management**
- Comprehensive IT asset inventory
- 11 asset types (laptops, servers, routers, etc.)
- Maintenance scheduling and tracking
- Warranty and lifecycle management
- QR code generation and transfers

#### ⛽ **Diesel Consumption Tracking**
- Generator runtime monitoring
- Fuel consumption analytics
- Cost tracking and efficiency metrics
- Automated alerts for low fuel
- Historical reporting and trends

#### 📅 **Calendar & Scheduling**
- IT maintenance scheduling
- Event management with attendees
- Recurring events support
- Calendar integration
- Automated reminders

#### 🏢 **Vendor & Contract Management**
- Supplier database with ratings
- Contract expiry tracking
- Purchase order management
- Vendor performance monitoring
- Automated renewal alerts

#### 📚 **Knowledge Base**
- Rich text articles with categories
- Search and tagging system
- User ratings and feedback
- Featured articles
- Version control and history

#### 💰 **Financial Management**
- Expense tracking and approval
- Budget management by department
- Cost center analytics
- Receipt upload and storage
- Multi-currency support

#### 🏛️ **Facilities Management**
- Multi-branch support
- Department organization
- Location-based analytics
- Manager assignments
- Hierarchical structure

#### 👥 **User Management**
- Role-based permissions
- Profile management
- User activity tracking
- Bulk operations
- Authentication & authorization

#### 📊 **Custom Report Builder**
- Drag-and-drop field selection
- Advanced filtering options
- Multiple export formats (PDF, CSV, Excel)
- Saved report templates
- Scheduled report generation

#### 🔧 **System Health Monitoring**
- Server performance metrics
- Database health checks
- API response monitoring
- Automated alerting
- Historical trending

#### ⚡ **Automation Rules Engine**
- IF-THEN workflow automation
- Multiple trigger events
- Complex condition matching
- Action execution logging
- Rule activation/deactivation

#### 🔔 **Advanced Notifications**
- In-app notification center
- Email and SMS integration
- Notification preferences
- Bulk operations
- Actionable notifications

#### 🔒 **Security & Audit**
- JWT authentication
- Activity logging
- IP address tracking
- Role-based access control
- Data encryption

## 🏗️ Architecture

### Frontend (React)
- **Framework**: React 18 with Vite
- **UI Library**: Shadcn/ui + Radix UI
- **State Management**: TanStack Query + Context API
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Forms**: React Hook Form + Zod validation

### Backend (Node.js/Express)
- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT with refresh tokens
- **Validation**: Express Validator
- **File Upload**: Multer
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting

### Database (PostgreSQL)
- **20+ Tables** with proper relationships
- **Row Level Security** (RLS) policies
- **Indexes** for performance optimization
- **Triggers** for automated updates
- **Views** for complex queries

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL database
- Git

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd techpros-itsm

# Install frontend dependencies
npm install

# Setup backend
cd server
npm install
cd ..
```

### 2. Database Setup

**Option A: Manual SQL (Recommended)**
1. Create a PostgreSQL database
2. Copy the SQL from `apply_migration.sql`
3. Run it in your PostgreSQL client or pgAdmin

**Option B: Supabase (if you have CLI access)**
```bash
cd supabase
npx supabase db push
```

### 3. Environment Configuration

**Frontend (.env):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Backend (server/.env):**
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/techpros_itsm
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:5173
```

### 4. Start the Application

```bash
# Terminal 1: Start Backend API
cd server
npm run dev

# Terminal 2: Start Frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/api/health

## 📖 API Documentation

The backend provides a comprehensive REST API with endpoints for all modules:

- `POST /api/auth/login` - User authentication
- `GET /api/tickets` - List tickets with filtering
- `POST /api/tickets` - Create new ticket
- `GET /api/assets` - Asset inventory
- `GET /api/expenses` - Financial reports
- `GET /api/calendar` - Scheduled events
- `GET /api/knowledge-base` - KB articles
- And many more...

See `server/README.md` for complete API documentation.

## 🔐 Default Users

After database setup, create your first admin user:

```sql
INSERT INTO profiles (email, full_name, role) VALUES ('admin@techpros.com', 'System Admin', 'admin');
```

## 🎨 UI Screenshots

The application includes:

- **Dashboard**: Real-time metrics and widgets
- **Ticket Management**: Full helpdesk interface
- **Asset Inventory**: Comprehensive asset tracking
- **Financial Reports**: Expense analysis and budgeting
- **Calendar**: Event scheduling and management
- **Knowledge Base**: Internal documentation
- **User Management**: Role-based administration
- **Report Builder**: Custom analytics creation
- **System Health**: Performance monitoring
- **Automation Rules**: Workflow configuration

## 🛠️ Development

### Project Structure
```
techpros-itsm/
├── src/                    # React Frontend
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   └── integrations/      # External service integrations
├── server/                # Node.js Backend
│   ├── routes/            # API route handlers
│   ├── middleware/        # Express middleware
│   ├── config/            # Configuration files
│   └── uploads/           # File storage
├── supabase/              # Database migrations
└── apply_migration.sql    # Manual database setup
```

### Key Technologies

**Frontend:**
- React 18 with Hooks
- TypeScript for type safety
- Vite for fast development
- Tailwind CSS for styling
- React Query for data fetching
- React Router for navigation

**Backend:**
- Express.js framework
- PostgreSQL database
- JWT authentication
- Multer for file uploads
- Nodemailer for emails
- Helmet for security

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set strong JWT secrets
- [ ] Configure SMTP for emails
- [ ] Set up file storage (AWS S3, etc.)
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup procedures

### Docker Deployment

```dockerfile
# Backend Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Check the API documentation in `server/README.md`
- Review the database schema in `apply_migration.sql`
- Check the frontend component documentation

## 🎉 What's Included

This is a **production-ready, enterprise-grade ITSM solution** that includes:

- ✅ **16 Complete Modules** with full CRUD operations
- ✅ **Role-Based Security** with audit logging
- ✅ **Modern UI/UX** with responsive design
- ✅ **Comprehensive API** with 50+ endpoints
- ✅ **Database Schema** with 20+ optimized tables
- ✅ **File Management** with upload/download
- ✅ **Email Notifications** and automation
- ✅ **Advanced Reporting** and analytics
- ✅ **System Monitoring** and health checks
- ✅ **Workflow Automation** with rules engine
- ✅ **Multi-tenant Ready** architecture

**Ready to deploy and use immediately!** 🚀
