-- Add revision history for knowledge base articles
CREATE TABLE public.kb_article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  change_summary TEXT,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_kb_article_revisions_article_id ON public.kb_article_revisions(article_id);
CREATE INDEX idx_kb_article_revisions_created_at ON public.kb_article_revisions(created_at);

-- Enable RLS
ALTER TABLE public.kb_article_revisions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view revisions for accessible articles" ON public.kb_article_revisions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.kb_articles
    WHERE id = kb_article_revisions.article_id
    AND (is_published = true OR author_id = auth.uid())
  )
);

CREATE POLICY "Admins and technicians can manage revisions" ON public.kb_article_revisions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);

-- Function to create revision on article update
CREATE OR REPLACE FUNCTION public.create_article_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Get the next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.kb_article_revisions
  WHERE article_id = NEW.id;

  -- Insert revision record
  INSERT INTO public.kb_article_revisions (
    article_id,
    title,
    content,
    category,
    tags,
    author_id,
    change_summary,
    version_number
  ) VALUES (
    NEW.id,
    COALESCE(NEW.title, ''),
    COALESCE(NEW.content, ''),
    NEW.category,
    NEW.tags,
    NEW.author_id,
    'Article updated',
    next_version
  );

  RETURN NEW;
END;
$$;

-- Trigger to automatically create revisions
CREATE TRIGGER create_kb_article_revision
  AFTER UPDATE ON public.kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_article_revision();