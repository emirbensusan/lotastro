-- Create po_drafts table
CREATE TABLE IF NOT EXISTS public.po_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('paste', 'pdf', 'image')),
  source_object_path TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create po_draft_lines table
CREATE TABLE IF NOT EXISTS public.po_draft_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.po_drafts(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  quality TEXT,
  color TEXT,
  meters NUMERIC(12,2),
  source_row TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'ok' CHECK (extraction_status IN ('ok', 'needs_review', 'missing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_usage table for tracking
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id BIGSERIAL PRIMARY KEY,
  draft_id UUID REFERENCES public.po_drafts(id) ON DELETE CASCADE,
  tokens_in INTEGER,
  tokens_out INTEGER,
  used_vision BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create storage bucket for AI order uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai_order_uploads', 'ai_order_uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE public.po_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_draft_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for po_drafts
CREATE POLICY "Accounting, senior managers and admins can view po_drafts"
ON public.po_drafts FOR SELECT
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Accounting, senior managers and admins can create po_drafts"
ON public.po_drafts FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Accounting, senior managers and admins can update po_drafts"
ON public.po_drafts FOR UPDATE
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Admins can delete po_drafts"
ON public.po_drafts FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for po_draft_lines
CREATE POLICY "Accounting, senior managers and admins can view po_draft_lines"
ON public.po_draft_lines FOR SELECT
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Accounting, senior managers and admins can create po_draft_lines"
ON public.po_draft_lines FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Accounting, senior managers and admins can update po_draft_lines"
ON public.po_draft_lines FOR UPDATE
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Admins can delete po_draft_lines"
ON public.po_draft_lines FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for ai_usage (view-only for authorized roles)
CREATE POLICY "Admins and senior managers can view ai_usage"
ON public.ai_usage FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role)
);

-- Storage policies for ai_order_uploads bucket
CREATE POLICY "Authorized roles can upload to ai_order_uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ai_order_uploads' AND
  (
    has_role(auth.uid(), 'accounting'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'admin'::user_role)
  )
);

CREATE POLICY "Authorized roles can view ai_order_uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ai_order_uploads' AND
  (
    has_role(auth.uid(), 'accounting'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'admin'::user_role)
  )
);

CREATE POLICY "Authorized roles can update ai_order_uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ai_order_uploads' AND
  (
    has_role(auth.uid(), 'accounting'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'admin'::user_role)
  )
);

CREATE POLICY "Admins can delete from ai_order_uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ai_order_uploads' AND
  has_role(auth.uid(), 'admin'::user_role)
);

-- Add updated_at triggers
CREATE TRIGGER update_po_drafts_updated_at
  BEFORE UPDATE ON public.po_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_draft_lines_updated_at
  BEFORE UPDATE ON public.po_draft_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_po_drafts_created_by ON public.po_drafts(created_by);
CREATE INDEX idx_po_drafts_status ON public.po_drafts(status);
CREATE INDEX idx_po_drafts_created_at ON public.po_drafts(created_at DESC);

CREATE INDEX idx_po_draft_lines_draft_id ON public.po_draft_lines(draft_id);
CREATE INDEX idx_po_draft_lines_extraction_status ON public.po_draft_lines(extraction_status);

CREATE INDEX idx_ai_usage_draft_id ON public.ai_usage(draft_id);
CREATE INDEX idx_ai_usage_created_at ON public.ai_usage(created_at DESC);