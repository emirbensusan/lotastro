-- =====================================================
-- STOCK TAKE MODULE - PHASE 1: DATABASE FOUNDATION
-- =====================================================

-- 1. Create storage bucket for stock take photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stock-take-photos',
  'stock-take-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for stock-take-photos bucket
CREATE POLICY "Authenticated users can upload stock take photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stock-take-photos');

CREATE POLICY "Authenticated users can view stock take photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'stock-take-photos');

CREATE POLICY "Only admins can delete stock take photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stock-take-photos' 
  AND (has_role(auth.uid(), 'admin'::user_role))
);

-- 2. Create enums for stock take
CREATE TYPE stock_take_session_status AS ENUM (
  'draft',
  'active',
  'counting_complete',
  'reviewing',
  'reconciled',
  'closed',
  'cancelled'
);

CREATE TYPE stock_take_roll_status AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'recount_requested',
  'void_pending_admin'
);

CREATE TYPE stock_take_confidence_level AS ENUM (
  'high',      -- >= 85%
  'medium',    -- 60-84%
  'low'        -- < 60%
);

CREATE TYPE stock_take_edit_reason AS ENUM (
  'ocr_unreadable',
  'handwritten_label',
  'label_damaged',
  'wrong_extraction',
  'other'
);

-- 3. Create count_sessions table
CREATE TABLE public.count_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number TEXT NOT NULL UNIQUE,
  status stock_take_session_status NOT NULL DEFAULT 'draft',
  
  -- Counter info
  started_by UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Session timing
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Review tracking
  reviewed_by UUID REFERENCES auth.users(id),
  
  -- Statistics (denormalized for performance)
  total_rolls_counted INTEGER NOT NULL DEFAULT 0,
  rolls_approved INTEGER NOT NULL DEFAULT 0,
  rolls_rejected INTEGER NOT NULL DEFAULT 0,
  rolls_pending_review INTEGER NOT NULL DEFAULT 0,
  rolls_recount_requested INTEGER NOT NULL DEFAULT 0,
  
  -- OCR stats
  ocr_high_confidence_count INTEGER NOT NULL DEFAULT 0,
  ocr_medium_confidence_count INTEGER NOT NULL DEFAULT 0,
  ocr_low_confidence_count INTEGER NOT NULL DEFAULT 0,
  manual_entry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Notes
  notes TEXT,
  cancellation_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create count_rolls table
CREATE TABLE public.count_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.count_sessions(id) ON DELETE CASCADE,
  capture_sequence INTEGER NOT NULL,
  
  -- Photo information
  photo_path TEXT NOT NULL,
  photo_hash_sha256 TEXT NOT NULL,
  photo_hash_perceptual TEXT,
  
  -- OCR extracted values
  ocr_quality TEXT,
  ocr_color TEXT,
  ocr_lot_number TEXT,
  ocr_meters NUMERIC,
  ocr_confidence_score NUMERIC,
  ocr_confidence_level stock_take_confidence_level,
  ocr_raw_text TEXT,
  ocr_processed_at TIMESTAMPTZ,
  
  -- Counter confirmed values (after manual review/edit)
  counter_quality TEXT NOT NULL,
  counter_color TEXT NOT NULL,
  counter_lot_number TEXT NOT NULL,
  counter_meters NUMERIC NOT NULL CHECK (counter_meters > 0 AND counter_meters <= 300),
  counter_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Manual entry tracking
  is_manual_entry BOOLEAN NOT NULL DEFAULT false,
  manual_edit_reason stock_take_edit_reason,
  manual_edit_reason_other TEXT,
  fields_manually_edited TEXT[], -- ['quality', 'color', 'lot_number', 'meters']
  
  -- Admin review
  status stock_take_roll_status NOT NULL DEFAULT 'pending_review',
  admin_quality TEXT,
  admin_color TEXT,
  admin_lot_number TEXT,
  admin_meters NUMERIC,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- Recount tracking
  recount_version INTEGER NOT NULL DEFAULT 1,
  original_roll_id UUID REFERENCES public.count_rolls(id),
  recount_reason TEXT,
  
  -- Duplicate detection
  is_possible_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of_roll_id UUID REFERENCES public.count_rolls(id),
  
  -- Flags
  is_not_label_warning BOOLEAN NOT NULL DEFAULT false,
  
  -- Counter info
  captured_by UUID NOT NULL REFERENCES auth.users(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE (session_id, capture_sequence)
);

-- 5. Create indexes for performance
CREATE INDEX idx_count_sessions_status ON public.count_sessions(status);
CREATE INDEX idx_count_sessions_started_by ON public.count_sessions(started_by);
CREATE INDEX idx_count_sessions_last_activity ON public.count_sessions(last_activity_at);

CREATE INDEX idx_count_rolls_session ON public.count_rolls(session_id);
CREATE INDEX idx_count_rolls_status ON public.count_rolls(status);
CREATE INDEX idx_count_rolls_captured_by ON public.count_rolls(captured_by);
CREATE INDEX idx_count_rolls_lot_number ON public.count_rolls(counter_lot_number);
CREATE INDEX idx_count_rolls_photo_hash ON public.count_rolls(photo_hash_sha256);
CREATE INDEX idx_count_rolls_perceptual_hash ON public.count_rolls(photo_hash_perceptual);

-- 6. Enable RLS
ALTER TABLE public.count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_rolls ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for count_sessions

-- Warehouse staff can view their own sessions
CREATE POLICY "Users can view their own counting sessions"
ON public.count_sessions FOR SELECT
USING (started_by = auth.uid());

-- Admins and senior managers can view all sessions
CREATE POLICY "Admins and senior managers can view all counting sessions"
ON public.count_sessions FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) 
  OR has_role(auth.uid(), 'senior_manager'::user_role)
);

-- Users with permission can create sessions
CREATE POLICY "Authorized users can create counting sessions"
ON public.count_sessions FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'warehouse_staff'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- Users can update their own active sessions
CREATE POLICY "Users can update their own active sessions"
ON public.count_sessions FOR UPDATE
USING (
  started_by = auth.uid() 
  AND status IN ('draft', 'active')
);

-- Admins can update any session (for review/reconciliation)
CREATE POLICY "Admins can update any counting session"
ON public.count_sessions FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
);

-- Only admins can delete sessions
CREATE POLICY "Only admins can delete counting sessions"
ON public.count_sessions FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- 8. RLS Policies for count_rolls

-- Users can view rolls from their own sessions
CREATE POLICY "Users can view rolls from their own sessions"
ON public.count_rolls FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.count_sessions cs
    WHERE cs.id = count_rolls.session_id
    AND cs.started_by = auth.uid()
  )
);

-- Admins and senior managers can view all rolls
CREATE POLICY "Admins and senior managers can view all rolls"
ON public.count_rolls FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
);

-- Users can insert rolls into their own active sessions
CREATE POLICY "Users can insert rolls into their own active sessions"
ON public.count_rolls FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.count_sessions cs
    WHERE cs.id = count_rolls.session_id
    AND cs.started_by = auth.uid()
    AND cs.status IN ('draft', 'active')
  )
);

-- Users can update their own rolls before admin review
CREATE POLICY "Users can update their own pending rolls"
ON public.count_rolls FOR UPDATE
USING (
  captured_by = auth.uid()
  AND status = 'pending_review'
);

-- Admins can update any roll (for review)
CREATE POLICY "Admins can update any roll for review"
ON public.count_rolls FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
);

-- Only admins can delete rolls
CREATE POLICY "Only admins can delete rolls"
ON public.count_rolls FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- 9. Create function to generate session number
CREATE OR REPLACE FUNCTION public.generate_count_session_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_num TEXT;
  counter INTEGER := 1;
  base_num TEXT;
BEGIN
  base_num := 'CNT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  LOOP
    session_num := base_num || LPAD(counter::TEXT, 3, '0');
    
    IF NOT EXISTS (SELECT 1 FROM public.count_sessions WHERE session_number = session_num) THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
  END LOOP;
  
  RETURN session_num;
END;
$$;

-- 10. Create function to update session statistics
CREATE OR REPLACE FUNCTION public.update_count_session_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.count_sessions
  SET
    total_rolls_counted = (
      SELECT COUNT(*) FROM public.count_rolls WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
    ),
    rolls_approved = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND status = 'approved'
    ),
    rolls_rejected = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND status = 'rejected'
    ),
    rolls_pending_review = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND status = 'pending_review'
    ),
    rolls_recount_requested = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND status = 'recount_requested'
    ),
    ocr_high_confidence_count = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND ocr_confidence_level = 'high'
    ),
    ocr_medium_confidence_count = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND ocr_confidence_level = 'medium'
    ),
    ocr_low_confidence_count = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND ocr_confidence_level = 'low'
    ),
    manual_entry_count = (
      SELECT COUNT(*) FROM public.count_rolls 
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND is_manual_entry = true
    ),
    last_activity_at = now(),
    updated_at = now()
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 11. Create trigger to update session stats on roll changes
CREATE TRIGGER update_session_stats_on_roll_change
AFTER INSERT OR UPDATE OR DELETE ON public.count_rolls
FOR EACH ROW
EXECUTE FUNCTION public.update_count_session_stats();

-- 12. Create trigger to update updated_at
CREATE TRIGGER update_count_sessions_updated_at
BEFORE UPDATE ON public.count_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_count_rolls_updated_at
BEFORE UPDATE ON public.count_rolls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Add stocktake permissions to role_permissions
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed)
VALUES
  -- warehouse_staff permissions
  ('warehouse_staff', 'stocktake', 'start_session', true),
  ('warehouse_staff', 'stocktake', 'capture_rolls', true),
  ('warehouse_staff', 'stocktake', 'view_own_sessions', true),
  ('warehouse_staff', 'stocktake', 'review_rolls', false),
  ('warehouse_staff', 'stocktake', 'approve_rolls', false),
  ('warehouse_staff', 'stocktake', 'delete_sessions', false),
  
  -- accounting permissions (no access)
  ('accounting', 'stocktake', 'start_session', false),
  ('accounting', 'stocktake', 'capture_rolls', false),
  ('accounting', 'stocktake', 'view_own_sessions', false),
  ('accounting', 'stocktake', 'review_rolls', false),
  ('accounting', 'stocktake', 'approve_rolls', false),
  ('accounting', 'stocktake', 'delete_sessions', false),
  
  -- senior_manager permissions
  ('senior_manager', 'stocktake', 'start_session', true),
  ('senior_manager', 'stocktake', 'capture_rolls', true),
  ('senior_manager', 'stocktake', 'view_own_sessions', true),
  ('senior_manager', 'stocktake', 'review_rolls', true),
  ('senior_manager', 'stocktake', 'approve_rolls', true),
  ('senior_manager', 'stocktake', 'delete_sessions', false),
  
  -- admin permissions
  ('admin', 'stocktake', 'start_session', true),
  ('admin', 'stocktake', 'capture_rolls', true),
  ('admin', 'stocktake', 'view_own_sessions', true),
  ('admin', 'stocktake', 'review_rolls', true),
  ('admin', 'stocktake', 'approve_rolls', true),
  ('admin', 'stocktake', 'delete_sessions', true)
ON CONFLICT (role, permission_category, permission_action) DO UPDATE
SET is_allowed = EXCLUDED.is_allowed;