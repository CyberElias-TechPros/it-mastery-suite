-- Add missing columns to kb_articles
ALTER TABLE public.kb_articles ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add missing columns to vendors  
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS rating numeric;

-- Create kb_comments table
CREATE TABLE IF NOT EXISTS public.kb_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.kb_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments" ON public.kb_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can add comments" ON public.kb_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create kb_ratings table
CREATE TABLE IF NOT EXISTS public.kb_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(article_id, user_id)
);

ALTER TABLE public.kb_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings" ON public.kb_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own ratings" ON public.kb_ratings
  FOR ALL USING (auth.uid() = user_id);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  vendor_id uuid REFERENCES public.vendors(id),
  status text DEFAULT 'draft',
  total_amount numeric DEFAULT 0,
  requested_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase orders" ON public.purchase_orders
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage purchase orders" ON public.purchase_orders
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can create purchase orders" ON public.purchase_orders
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- Create custom_reports table
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  config jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports" ON public.custom_reports
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own reports" ON public.custom_reports
  FOR ALL USING (auth.uid() = created_by);

-- Create increment_view_count function
CREATE OR REPLACE FUNCTION public.increment_view_count(article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE kb_articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = article_id;
END;
$$;

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_reports_updated_at ON public.custom_reports;
CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();