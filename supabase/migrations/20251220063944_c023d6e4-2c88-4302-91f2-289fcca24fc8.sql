-- Add missing columns to existing tables
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id);

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);

-- Create automation_rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  trigger_event text NOT NULL,
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation rules" ON public.automation_rules
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view active rules" ON public.automation_rules
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::user_role));

-- Create automation_executions table
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  trigger_data jsonb,
  result jsonb,
  status text DEFAULT 'pending',
  error_message text,
  executed_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage executions" ON public.automation_executions
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view executions" ON public.automation_executions
  FOR SELECT USING (true);

-- Create attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments" ON public.attachments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload attachments" ON public.attachments
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own attachments" ON public.attachments
  FOR DELETE USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::user_role));

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();