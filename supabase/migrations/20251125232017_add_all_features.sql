-- Add all features database schema

-- Activity logging table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.profiles(id),
  budget DECIMAL(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  manager_id UUID REFERENCES public.profiles(id),
  budget DECIMAL(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update profiles to include department and branch
ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.profiles ADD COLUMN department_id UUID REFERENCES public.departments(id);

-- Asset types enum
CREATE TYPE public.asset_type AS ENUM ('laptop', 'desktop', 'server', 'router', 'switch', 'printer', 'ups', 'inverter', 'mobile_device', 'software_license', 'other');

-- Asset status enum
CREATE TYPE public.asset_status AS ENUM ('active', 'in_maintenance', 'retired', 'disposed');

-- Assets table
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type public.asset_type NOT NULL,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(15,2),
  warranty_expiry DATE,
  status public.asset_status NOT NULL DEFAULT 'active',
  assigned_to UUID REFERENCES public.profiles(id),
  department_id UUID REFERENCES public.departments(id),
  branch_id UUID REFERENCES public.branches(id),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset maintenance table
CREATE TABLE public.asset_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  cost DECIMAL(15,2),
  performed_by UUID REFERENCES public.profiles(id),
  scheduled_date DATE,
  completed_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset transfers table
CREATE TABLE public.asset_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  from_user UUID REFERENCES public.profiles(id),
  to_user UUID REFERENCES public.profiles(id),
  from_department UUID REFERENCES public.departments(id),
  to_department UUID REFERENCES public.departments(id),
  from_branch UUID REFERENCES public.branches(id),
  to_branch UUID REFERENCES public.branches(id),
  transfer_reason TEXT,
  transferred_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Diesel logs table
CREATE TABLE public.diesel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_id TEXT NOT NULL,
  date DATE NOT NULL,
  opening_stock DECIMAL(10,2) NOT NULL,
  closing_stock DECIMAL(10,2) NOT NULL,
  start_time TIME,
  stop_time TIME,
  running_hours DECIMAL(8,2),
  consumed_stock DECIMAL(10,2),
  cost_per_liter DECIMAL(8,2),
  total_cost DECIMAL(15,2),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  category TEXT,
  rating DECIMAL(3,2),
  contract_start_date DATE,
  contract_end_date DATE,
  payment_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  title TEXT NOT NULL,
  description TEXT,
  total_amount DECIMAL(15,2),
  status TEXT NOT NULL DEFAULT 'draft',
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  category TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  branch_id UUID REFERENCES public.branches(id),
  department_id UUID REFERENCES public.departments(id),
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge base articles table
CREATE TABLE public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KB article ratings table
CREATE TABLE public.kb_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, user_id)
);

-- KB article comments table
CREATE TABLE public.kb_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  location TEXT,
  attendees UUID[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  reminder_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation rules table
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation rule executions table
CREATE TABLE public.automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id),
  trigger_data JSONB,
  execution_result JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System health metrics table
CREATE TABLE public.system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value TEXT,
  status TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Custom reports table
CREATE TABLE public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_scheduled BOOLEAN DEFAULT false,
  schedule_config JSONB,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- File attachments table (for tickets, assets, etc.)
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies for all tables
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diesel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (admins can do everything, others have limited access)
-- Activity logs
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Branches
CREATE POLICY "Users can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Departments
CREATE POLICY "Users can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Assets
CREATE POLICY "Users can view assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Admins and technicians can manage assets" ON public.assets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Asset maintenance
CREATE POLICY "Users can view asset maintenance" ON public.asset_maintenance FOR SELECT USING (true);
CREATE POLICY "Admins and technicians can manage asset maintenance" ON public.asset_maintenance FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Asset transfers
CREATE POLICY "Users can view asset transfers" ON public.asset_transfers FOR SELECT USING (true);
CREATE POLICY "Admins and technicians can manage asset transfers" ON public.asset_transfers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Diesel logs
CREATE POLICY "Users can view diesel logs" ON public.diesel_logs FOR SELECT USING (true);
CREATE POLICY "Admins and technicians can manage diesel logs" ON public.diesel_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Vendors
CREATE POLICY "Users can view vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Admins can manage vendors" ON public.vendors FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Purchase orders
CREATE POLICY "Users can view purchase orders" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "Admins can manage purchase orders" ON public.purchase_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Expenses
CREATE POLICY "Users can view expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Admins can manage expenses" ON public.expenses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Knowledge base
CREATE POLICY "Users can view published KB articles" ON public.kb_articles FOR SELECT USING (is_published = true);
CREATE POLICY "Admins and technicians can manage KB articles" ON public.kb_articles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- KB ratings and comments
CREATE POLICY "Users can view KB ratings and comments" ON public.kb_ratings FOR SELECT USING (true);
CREATE POLICY "Users can manage own KB ratings" ON public.kb_ratings FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view KB comments" ON public.kb_comments FOR SELECT USING (true);
CREATE POLICY "Users can create KB comments" ON public.kb_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Calendar events
CREATE POLICY "Users can view calendar events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Users can manage own calendar events" ON public.calendar_events FOR ALL USING (auth.uid() = created_by);

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Automation rules
CREATE POLICY "Admins can manage automation rules" ON public.automation_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- System health
CREATE POLICY "Admins can view system health" ON public.system_health FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Custom reports
CREATE POLICY "Users can view own reports" ON public.custom_reports FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can manage own reports" ON public.custom_reports FOR ALL USING (auth.uid() = created_by);

-- Attachments
CREATE POLICY "Users can view attachments they have access to" ON public.attachments FOR SELECT USING (
  uploaded_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Users can upload attachments" ON public.attachments FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Add triggers for updated_at
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_kb_articles_updated_at BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_custom_reports_updated_at BEFORE UPDATE ON public.custom_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create function to increment article view count
CREATE OR REPLACE FUNCTION public.increment_view_count(article_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.kb_articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = article_id;
END;
$$;

-- Create function to calculate average rating for articles
CREATE OR REPLACE FUNCTION public.calculate_article_rating(article_id UUID)
RETURNS decimal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating decimal;
BEGIN
  SELECT AVG(rating) INTO avg_rating
  FROM public.kb_ratings
  WHERE article_id = article_id;

  RETURN COALESCE(avg_rating, 0);
END;
$$;

-- Create trigger to update article rating when ratings change
CREATE OR REPLACE FUNCTION public.update_article_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.kb_articles
  SET rating = calculate_article_rating(NEW.article_id)
  WHERE id = NEW.article_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_kb_article_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.kb_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_article_rating();

-- Add indexes for performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX idx_assets_assigned_to ON public.assets(assigned_to);
CREATE INDEX idx_assets_department_id ON public.assets(department_id);
CREATE INDEX idx_assets_branch_id ON public.assets(branch_id);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_asset_maintenance_asset_id ON public.asset_maintenance(asset_id);
CREATE INDEX idx_diesel_logs_date ON public.diesel_logs(date);
CREATE INDEX idx_diesel_logs_generator_id ON public.diesel_logs(generator_id);
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_category ON public.expenses(category);
CREATE INDEX idx_kb_articles_category ON public.kb_articles(category);
CREATE INDEX idx_kb_articles_tags ON public.kb_articles USING GIN(tags);
CREATE INDEX idx_kb_articles_is_featured ON public.kb_articles(is_featured);
CREATE INDEX idx_kb_articles_is_published ON public.kb_articles(is_published);
CREATE INDEX idx_kb_ratings_article_id ON public.kb_ratings(article_id);
CREATE INDEX idx_kb_comments_article_id ON public.kb_comments(article_id);
CREATE INDEX idx_calendar_events_start_date ON public.calendar_events(start_date);
CREATE INDEX idx_calendar_events_end_date ON public.calendar_events(end_date);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_attachments_resource_type ON public.attachments(resource_type);
CREATE INDEX idx_attachments_resource_id ON public.attachments(resource_id);