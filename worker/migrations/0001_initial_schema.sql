-- TechPros ITSM — Cloudflare D1 initial schema
-- SQLite dialect. All ids are UUID v4 strings, all timestamps are ISO-8601 UTC strings.
-- Enum-like columns are enforced with CHECK constraints (SQLite has no native enums).

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------
CREATE TABLE branches (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT UNIQUE,
  address    TEXT,
  city       TEXT,
  country    TEXT,
  phone      TEXT,
  budget     REAL NOT NULL DEFAULT 0,
  manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_branches_deleted ON branches(deleted_at);

CREATE TABLE departments (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT,
  branch_id  TEXT REFERENCES branches(id) ON DELETE SET NULL,
  manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  budget     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_departments_branch ON departments(branch_id);
CREATE INDEX idx_departments_deleted ON departments(deleted_at);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  email_lower   TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','technician','employee')),
  phone         TEXT,
  department    TEXT,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  branch_id     TEXT REFERENCES branches(id) ON DELETE SET NULL,
  avatar_url    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at    TEXT
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_active ON users(is_active, deleted_at);

-- Refresh-token sessions. Only a SHA-256 hash of the token is persisted.
CREATE TABLE sessions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent         TEXT,
  ip_address         TEXT,
  expires_at         TEXT NOT NULL,
  revoked_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Service desk
-- ---------------------------------------------------------------------------
CREATE TABLE tickets (
  id            TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'it_support' CHECK (category IN ('it_support','software','hardware','network','other')),
  priority      TEXT NOT NULL DEFAULT 'medium'     CHECK (priority IN ('low','medium','high','critical')),
  status        TEXT NOT NULL DEFAULT 'open'       CHECK (status IN ('open','in_progress','resolved','closed')),
  created_by    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to   TEXT REFERENCES users(id) ON DELETE SET NULL,
  branch_id     TEXT REFERENCES branches(id) ON DELETE SET NULL,
  asset_id      TEXT REFERENCES assets(id) ON DELETE SET NULL,
  resolution    TEXT,
  resolved_at   TEXT,
  closed_at     TEXT,
  sla_due_date  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_sla ON tickets(sla_due_date, status);

-- Monotonic counter used to generate human readable ticket numbers.
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO counters (name, value) VALUES ('ticket', 0), ('purchase_order', 0);

CREATE TABLE ticket_comments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment     TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------
CREATE TABLE assets (
  id              TEXT PRIMARY KEY,
  asset_tag       TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  model           TEXT,
  serial_number   TEXT,
  purchase_date   TEXT,
  purchase_cost   REAL,
  warranty_expiry TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance','retired')),
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  department_id   TEXT REFERENCES departments(id) ON DELETE SET NULL,
  branch_id       TEXT REFERENCES branches(id) ON DELETE SET NULL,
  location        TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_assigned ON assets(assigned_to);
CREATE INDEX idx_assets_warranty ON assets(warranty_expiry);
CREATE INDEX idx_assets_deleted ON assets(deleted_at);

-- ---------------------------------------------------------------------------
-- Facilities / diesel
-- ---------------------------------------------------------------------------
CREATE TABLE diesel_logs (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  branch_id      TEXT REFERENCES branches(id) ON DELETE SET NULL,
  generator_id   TEXT,
  opening_stock  REAL NOT NULL,
  received_stock REAL NOT NULL DEFAULT 0,
  consumed_stock REAL NOT NULL,
  closing_stock  REAL NOT NULL,
  running_hours  REAL,
  cost_per_liter REAL,
  total_cost     REAL,
  notes          TEXT,
  recorded_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_diesel_date ON diesel_logs(date DESC);
CREATE INDEX idx_diesel_branch ON diesel_logs(branch_id);

-- ---------------------------------------------------------------------------
-- Procurement
-- ---------------------------------------------------------------------------
CREATE TABLE vendors (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  contact_person      TEXT,
  email               TEXT,
  phone               TEXT,
  address             TEXT,
  website             TEXT,
  service_type        TEXT,
  category            TEXT,
  rating              REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  contract_start_date TEXT,
  contract_end_date   TEXT,
  contract_value      REAL,
  payment_terms       TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at          TEXT
);
CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_vendors_contract_end ON vendors(contract_end_date);
CREATE INDEX idx_vendors_deleted ON vendors(deleted_at);

CREATE TABLE purchase_orders (
  id           TEXT PRIMARY KEY,
  po_number    TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT,
  vendor_id    TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','ordered','received','cancelled')),
  total_amount REAL NOT NULL DEFAULT 0,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at  TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_created ON purchase_orders(created_at DESC);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
CREATE TABLE expenses (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  amount        REAL NOT NULL CHECK (amount >= 0),
  expense_date  TEXT NOT NULL,
  category      TEXT,
  vendor_id     TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  branch_id     TEXT REFERENCES branches(id) ON DELETE SET NULL,
  submitted_by  TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at   TEXT,
  rejected_reason TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  receipt_key   TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX idx_expenses_branch ON expenses(branch_id);
CREATE INDEX idx_expenses_department ON expenses(department_id);

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------
CREATE TABLE kb_articles (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  category     TEXT,
  tags         TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_featured  INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0,1)),
  view_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at   TEXT
);
CREATE INDEX idx_kb_published ON kb_articles(is_published, created_at DESC);
CREATE INDEX idx_kb_category ON kb_articles(category);
CREATE INDEX idx_kb_deleted ON kb_articles(deleted_at);

CREATE TABLE kb_comments (
  id         TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_kb_comments_article ON kb_comments(article_id, created_at);

CREATE TABLE kb_ratings (
  id         TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (article_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Calendar & notifications
-- ---------------------------------------------------------------------------
CREATE TABLE calendar_events (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT,
  start_date        TEXT NOT NULL,
  end_date          TEXT NOT NULL,
  event_type        TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN ('maintenance','meeting','deadline','other')),
  all_day           INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
  location          TEXT,
  attendees         TEXT NOT NULL DEFAULT '[]', -- JSON array of user ids
  created_by        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  related_ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  reminder_minutes  INTEGER NOT NULL DEFAULT 15,
  reminder_sent_at  TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_events_start ON calendar_events(start_date);
CREATE INDEX idx_events_created_by ON calendar_events(created_by);

CREATE TABLE notifications (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('ticket_assigned','ticket_updated','ticket_resolved','system','mention')),
  is_read           INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  related_ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  action_url        TEXT,
  dedupe_key        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX idx_notifications_dedupe ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Automation, reporting, files, audit, health
-- ---------------------------------------------------------------------------
CREATE TABLE automation_rules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_event TEXT NOT NULL,
  conditions    TEXT NOT NULL DEFAULT '[]',
  actions       TEXT NOT NULL DEFAULT '[]',
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_rules_event ON automation_rules(trigger_event, is_active);

CREATE TABLE automation_executions (
  id            TEXT PRIMARY KEY,
  rule_id       TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  trigger_data  TEXT,
  result        TEXT,
  status        TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  error_message TEXT,
  executed_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_executions_rule ON automation_executions(rule_id, executed_at DESC);

CREATE TABLE custom_reports (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  config      TEXT NOT NULL DEFAULT '{}',
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_run_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_reports_creator ON custom_reports(created_by, created_at DESC);

CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  file_name     TEXT NOT NULL,
  object_key    TEXT NOT NULL UNIQUE,
  file_size     INTEGER,
  mime_type     TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('ticket','asset','expense','kb_article','user','purchase_order')),
  resource_id   TEXT NOT NULL,
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at    TEXT
);
CREATE INDEX idx_attachments_resource ON attachments(resource_type, resource_id);

CREATE TABLE activity_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  details       TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  request_id    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_resource ON activity_logs(resource_type, resource_id);

CREATE TABLE system_metrics (
  id           TEXT PRIMARY KEY,
  metric_name  TEXT NOT NULL,
  metric_value TEXT,
  status       TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','warning','critical')),
  recorded_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_metrics_recorded ON system_metrics(metric_name, recorded_at DESC);
