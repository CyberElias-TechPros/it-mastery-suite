-- Add CRM (Client Relationship Management) features database schema

-- Enums for CRM
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE public.contract_status AS ENUM ('draft', 'active', 'expired', 'terminated');
CREATE TYPE public.communication_type AS ENUM ('email', 'phone', 'meeting', 'note', 'other');
CREATE TYPE public.survey_type AS ENUM ('nps', 'satisfaction', 'feedback', 'custom');

-- Clients table (client profiles)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  industry TEXT,
  website TEXT,
  annual_revenue DECIMAL(15,2),
  employee_count INTEGER,
  lead_source TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client contacts (key decision-makers and relationship mapping)
CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  relationship_type TEXT, -- e.g., 'CEO', 'CTO', 'Decision Maker', 'Influencer'
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads table (lead tracking and conversion pipelines)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  lead_source TEXT,
  lead_score INTEGER DEFAULT 0,
  status public.lead_status DEFAULT 'new',
  pipeline_stage TEXT,
  estimated_value DECIMAL(15,2),
  assigned_to UUID REFERENCES public.profiles(id),
  converted_client_id UUID REFERENCES public.clients(id),
  converted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contracts table (contract history)
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  contract_value DECIMAL(15,2),
  start_date DATE,
  end_date DATE,
  status public.contract_status DEFAULT 'draft',
  renewal_date DATE,
  terms TEXT,
  signed_by UUID REFERENCES public.profiles(id),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Communications table (communication logs)
CREATE TABLE public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  type public.communication_type NOT NULL,
  subject TEXT,
  content TEXT,
  direction TEXT DEFAULT 'outbound', -- 'inbound' or 'outbound'
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Surveys table (client feedback and satisfaction surveys)
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  survey_type public.survey_type NOT NULL,
  title TEXT NOT NULL,
  responses JSONB,
  nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
  overall_satisfaction INTEGER CHECK (overall_satisfaction >= 1 AND overall_satisfaction <= 5),
  feedback_text TEXT,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client segments table (segmentation for targeted marketing)
CREATE TABLE public.client_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB, -- e.g., {"industry": "tech", "revenue": ">1000000"}
  client_ids UUID[] DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client portal users table (for client-facing portal)
CREATE TABLE public.client_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'client',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding workflows table
CREATE TABLE public.onboarding_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  steps JSONB, -- array of steps with status
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress',
  assigned_to UUID REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all CRM tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Clients
CREATE POLICY "Users can view clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Admins and sales can manage clients" ON public.clients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Client contacts
CREATE POLICY "Users can view client contacts" ON public.client_contacts FOR SELECT USING (true);
CREATE POLICY "Admins and sales can manage client contacts" ON public.client_contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Leads
CREATE POLICY "Users can view leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Admins and sales can manage leads" ON public.leads FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Contracts
CREATE POLICY "Users can view contracts" ON public.contracts FOR SELECT USING (true);
CREATE POLICY "Admins can manage contracts" ON public.contracts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Communications
CREATE POLICY "Users can view communications" ON public.communications FOR SELECT USING (true);
CREATE POLICY "Users can manage own communications" ON public.communications FOR ALL USING (auth.uid() = user_id);

-- Surveys
CREATE POLICY "Users can view surveys" ON public.surveys FOR SELECT USING (true);
CREATE POLICY "Admins can manage surveys" ON public.surveys FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Client segments
CREATE POLICY "Users can view client segments" ON public.client_segments FOR SELECT USING (true);
CREATE POLICY "Admins can manage client segments" ON public.client_segments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Client portal users
CREATE POLICY "Admins can manage client portal users" ON public.client_portal_users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Onboarding workflows
CREATE POLICY "Users can view onboarding workflows" ON public.onboarding_workflows FOR SELECT USING (true);
CREATE POLICY "Admins can manage onboarding workflows" ON public.onboarding_workflows FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Add triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_client_segments_updated_at BEFORE UPDATE ON public.client_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_client_portal_users_updated_at BEFORE UPDATE ON public.client_portal_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_onboarding_workflows_updated_at BEFORE UPDATE ON public.onboarding_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add indexes for performance
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_company_name ON public.clients(company_name);
CREATE INDEX idx_clients_assigned_to ON public.clients(assigned_to);
CREATE INDEX idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_communications_client_id ON public.communications(client_id);
CREATE INDEX idx_communications_lead_id ON public.communications(lead_id);
CREATE INDEX idx_communications_type ON public.communications(type);
CREATE INDEX idx_surveys_client_id ON public.surveys(client_id);
CREATE INDEX idx_surveys_type ON public.surveys(survey_type);
CREATE INDEX idx_client_portal_users_client_id ON public.client_portal_users(client_id);
CREATE INDEX idx_client_portal_users_email ON public.client_portal_users(email);
CREATE INDEX idx_onboarding_workflows_client_id ON public.onboarding_workflows(client_id);
CREATE INDEX idx_onboarding_workflows_status ON public.onboarding_workflows(status);