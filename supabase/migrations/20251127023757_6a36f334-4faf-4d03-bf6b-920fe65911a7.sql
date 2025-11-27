-- Create enums for various status and type fields
CREATE TYPE public.asset_status AS ENUM ('active', 'inactive', 'maintenance', 'retired');
CREATE TYPE public.notification_type AS ENUM ('ticket_assigned', 'ticket_updated', 'ticket_resolved', 'system', 'mention');
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.event_type AS ENUM ('maintenance', 'meeting', 'deadline', 'other');

-- Branches table
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  country text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all branches"
ON public.branches FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage branches"
ON public.branches FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Departments table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all departments"
ON public.departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage departments"
ON public.departments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Assets table
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(10,2),
  warranty_expiry date,
  status asset_status DEFAULT 'active',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all assets"
ON public.assets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and technicians can manage assets"
ON public.assets FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'technician')
);

-- Vendors table
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  website text,
  contract_start_date date,
  contract_end_date date,
  contract_value numeric(10,2),
  service_type text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all vendors"
ON public.vendors FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage vendors"
ON public.vendors FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL,
  expense_date date NOT NULL,
  category text,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  status expense_status DEFAULT 'pending',
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
ON public.expenses FOR SELECT
TO authenticated
USING (
  auth.uid() = submitted_by OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can create own expenses"
ON public.expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Admins can manage all expenses"
ON public.expenses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Diesel logs table
CREATE TABLE public.diesel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  opening_stock numeric(10,2) NOT NULL,
  received_stock numeric(10,2) DEFAULT 0,
  consumed_stock numeric(10,2) NOT NULL,
  closing_stock numeric(10,2) NOT NULL,
  running_hours numeric(10,2),
  cost_per_liter numeric(10,2),
  total_cost numeric(10,2),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.diesel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all diesel logs"
ON public.diesel_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and technicians can manage diesel logs"
ON public.diesel_logs FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'technician')
);

-- Calendar events table
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  event_type event_type DEFAULT 'other',
  all_day boolean DEFAULT false,
  location text,
  attendees uuid[] DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  related_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all events"
ON public.calendar_events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create events"
ON public.calendar_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own events"
ON public.calendar_events FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all events"
ON public.calendar_events FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Knowledge base articles table
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text,
  tags text[] DEFAULT '{}',
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  view_count integer DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view published articles"
ON public.kb_articles FOR SELECT
TO authenticated
USING (is_published = true OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create articles"
ON public.kb_articles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own articles"
ON public.kb_articles FOR UPDATE
TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete articles"
ON public.kb_articles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type DEFAULT 'system',
  related_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update triggers for updated_at columns
CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_assets_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_diesel_logs_updated_at
BEFORE UPDATE ON public.diesel_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_kb_articles_updated_at
BEFORE UPDATE ON public.kb_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();