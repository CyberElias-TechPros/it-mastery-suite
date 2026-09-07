-- TechPros ITSM — D1-Compatible Database Schema
--
-- Migration from PostgreSQL (apply_migration.sql) to Cloudflare D1.
-- Key differences:
--   - gen_random_uuid() -> manual UUID (use CUID or generate in app layer)
--   - INET -> TEXT (store IP as string)
--   - JSONB -> TEXT (parse/stringify in application layer)
--   - RLS policies are not enforced by D1 automatically; enforce in Worker code

-- Profiles (users)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,  -- D1 uses TEXT for UUIDs (generate in app)
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  department TEXT,
  phone TEXT,
  password_hash TEXT,
  branch_id TEXT,
  department_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'it_support',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL REFERENCES profiles(id),
  assigned_to TEXT REFERENCES profiles(id),
  resolved_at DATETIME,
  closed_at DATETIME,
  sla_due_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);

-- Ticket comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  comment TEXT NOT NULL,
  is_internal INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  asset_tag TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price REAL,
  warranty_expiry DATE,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_to TEXT REFERENCES profiles(id),
  department_id TEXT,
  branch_id TEXT,
  location TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);

-- Asset maintenance
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  cost REAL,
  performed_by TEXT REFERENCES profiles(id),
  scheduled_date DATE,
  completed_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset_id ON asset_maintenance(asset_id);

-- Diesel logs
CREATE TABLE IF NOT EXISTS diesel_logs (
  id TEXT PRIMARY KEY,
  generator_id TEXT NOT NULL,
  date DATE NOT NULL,
  opening_stock REAL NOT NULL,
  closing_stock REAL NOT NULL,
  start_time TIME,
  stop_time TIME,
  running_hours REAL,
  consumed_stock REAL,
  cost_per_liter REAL,
  total_cost REAL,
  notes TEXT,
  recorded_by TEXT NOT NULL REFERENCES profiles(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diesel_logs_date ON diesel_logs(date);
CREATE INDEX IF NOT EXISTS idx_diesel_logs_generator_id ON diesel_logs(generator_id);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  category TEXT,
  rating REAL,
  contract_start_date DATE,
  contract_end_date DATE,
  payment_terms TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  vendor_id TEXT REFERENCES vendors(id),
  branch_id TEXT,
  department_id TEXT,
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  approved_by TEXT REFERENCES profiles(id),
  approved_at DATETIME,
  recorded_by TEXT NOT NULL REFERENCES profiles(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Knowledge Base articles
CREATE TABLE IF NOT EXISTS kb_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT,  -- D1: store as JSON string or comma-separated; parse in app
  author_id TEXT NOT NULL REFERENCES profiles(id),
  is_featured INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0,
  rating REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category);

-- KB ratings
CREATE TABLE IF NOT EXISTS kb_ratings (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(article_id, user_id)
);

-- KB comments
CREATE TABLE IF NOT EXISTS kb_comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  event_type TEXT NOT NULL,
  location TEXT,
  attendees TEXT DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES profiles(id),
  is_recurring INTEGER DEFAULT 0,
  recurrence_rule TEXT,
  reminder_minutes INTEGER DEFAULT 15,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_timestamp
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON calendar_events(end_date);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  action_url TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions TEXT DEFAULT '[]',
  actions TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Automation executions
CREATE TABLE IF NOT EXISTS automation_executions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES automation_rules(id),
  trigger_data TEXT,
  execution_result TEXT,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System health metrics
CREATE TABLE IF NOT EXISTS system_health (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value TEXT,
  status TEXT NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_health_recorded_at ON system_health(recorded_at);

-- Custom reports
CREATE TABLE IF NOT EXISTS custom_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES profiles(id),
  is_scheduled INTEGER DEFAULT 0,
  schedule_config TEXT,
  last_run_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File attachments
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT NOT NULL REFERENCES profiles(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_resource_type ON attachments(resource_type);
CREATE INDEX IF NOT EXISTS idx_attachments_resource_id ON attachments(resource_id);

-- Activity logs (audit)
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  manager_id TEXT REFERENCES profiles(id),
  budget REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  manager_id TEXT REFERENCES profiles(id),
  budget REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  title TEXT NOT NULL,
  description TEXT,
  total_amount REAL,
  status TEXT NOT NULL DEFAULT 'draft',
  requested_by TEXT NOT NULL REFERENCES profiles(id),
  approved_by TEXT REFERENCES profiles(id),
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note: D1 does not enforce foreign keys at database level automatically.
-- Enforce data integrity in Worker application code (before INSERT/UPDATE).
