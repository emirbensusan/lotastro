-- Phase 1: Inquiry Gating Foundation
-- Create enums for inquiry status and reason

CREATE TYPE public.inquiry_status AS ENUM (
  'draft',
  'active', 
  'converted',
  'expired',
  'cancelled'
);

CREATE TYPE public.inquiry_reason AS ENUM (
  'customer_quote',
  'stock_check',
  'management_review',
  'stock_take',
  'qa_investigation'
);

-- Create inquiries table
CREATE TABLE public.inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_number TEXT NOT NULL UNIQUE,
  reason public.inquiry_reason NOT NULL,
  customer_name TEXT,
  salesperson_id UUID REFERENCES auth.users(id),
  status public.inquiry_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  converted_to_order_id UUID,
  converted_at TIMESTAMP WITH TIME ZONE,
  converted_by UUID REFERENCES auth.users(id)
);

-- Create inquiry_lines table
CREATE TABLE public.inquiry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  requested_meters NUMERIC NOT NULL CHECK (requested_meters > 0),
  lot_id UUID REFERENCES public.lots(id),
  scope TEXT NOT NULL DEFAULT 'INVENTORY' CHECK (scope IN ('INVENTORY', 'INCOMING')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inquiry_view_logs table for audit trail
CREATE TABLE public.inquiry_view_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('view_stock', 'search', 'filter', 'export', 'detail_view', 'bypass_view')),
  filters_used JSONB,
  qualities_viewed TEXT[],
  colors_viewed TEXT[],
  meters_visible NUMERIC,
  is_bypass BOOLEAN NOT NULL DEFAULT false,
  bypass_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock_take_sessions table for time-bound bypass
CREATE TABLE public.stock_take_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  started_by UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  ended_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'ended')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Generate non-sequential inquiry number (INQ-YYYYMMDD-XXXX with random suffix)
CREATE OR REPLACE FUNCTION public.generate_inquiry_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inq_num TEXT;
  random_suffix TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INTEGER;
BEGIN
  LOOP
    -- Generate 4-character random suffix (non-sequential for privacy)
    random_suffix := '';
    FOR i IN 1..4 LOOP
      random_suffix := random_suffix || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    inq_num := 'INQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || random_suffix;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.inquiries WHERE inquiry_number = inq_num) THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN inq_num;
END;
$$;

-- Generate stock take session number
CREATE OR REPLACE FUNCTION public.generate_stock_take_session_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_num TEXT;
  counter INTEGER := 1;
  base_num TEXT;
BEGIN
  base_num := 'STS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  LOOP
    session_num := base_num || LPAD(counter::TEXT, 3, '0');
    
    IF NOT EXISTS (SELECT 1 FROM public.stock_take_sessions WHERE session_number = session_num) THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
  END LOOP;
  
  RETURN session_num;
END;
$$;

-- Auto-generate inquiry number on insert
CREATE OR REPLACE FUNCTION public.inquiries_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.inquiry_number IS NULL OR NEW.inquiry_number = '' THEN
    NEW.inquiry_number := public.generate_inquiry_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_inquiries_before_insert
  BEFORE INSERT ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.inquiries_before_insert();

-- Auto-generate stock take session number on insert
CREATE OR REPLACE FUNCTION public.stock_take_sessions_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.session_number IS NULL OR NEW.session_number = '' THEN
    NEW.session_number := public.generate_stock_take_session_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_stock_take_sessions_before_insert
  BEFORE INSERT ON public.stock_take_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.stock_take_sessions_before_insert();

-- Update timestamp trigger for inquiries
CREATE TRIGGER tr_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_inquiries_status ON public.inquiries(status);
CREATE INDEX idx_inquiries_created_by ON public.inquiries(created_by);
CREATE INDEX idx_inquiries_customer ON public.inquiries(customer_name) WHERE customer_name IS NOT NULL;
CREATE INDEX idx_inquiries_created_at ON public.inquiries(created_at DESC);
CREATE INDEX idx_inquiry_lines_inquiry_id ON public.inquiry_lines(inquiry_id);
CREATE INDEX idx_inquiry_lines_quality_color ON public.inquiry_lines(quality, color);
CREATE INDEX idx_inquiry_view_logs_user ON public.inquiry_view_logs(user_id, created_at DESC);
CREATE INDEX idx_inquiry_view_logs_inquiry ON public.inquiry_view_logs(inquiry_id) WHERE inquiry_id IS NOT NULL;
CREATE INDEX idx_stock_take_sessions_status ON public.stock_take_sessions(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_view_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inquiries
-- Users can view their own inquiries
CREATE POLICY "Users can view own inquiries"
  ON public.inquiries FOR SELECT
  USING (auth.uid() = created_by);

-- Managers and admins can view all inquiries
CREATE POLICY "Managers can view all inquiries"
  ON public.inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'senior_manager', 'accounting')
    )
  );

-- Users can create inquiries
CREATE POLICY "Users can create inquiries"
  ON public.inquiries FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own draft inquiries
CREATE POLICY "Users can update own draft inquiries"
  ON public.inquiries FOR UPDATE
  USING (auth.uid() = created_by AND status = 'draft')
  WITH CHECK (auth.uid() = created_by);

-- Ops/Accounting can convert inquiries to orders
CREATE POLICY "Ops can convert inquiries"
  ON public.inquiries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'accounting', 'senior_manager')
    )
  );

-- RLS Policies for inquiry_lines
CREATE POLICY "Users can view inquiry lines for accessible inquiries"
  ON public.inquiry_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = inquiry_id
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid()
          AND role IN ('admin', 'senior_manager', 'accounting')
        )
      )
    )
  );

CREATE POLICY "Users can insert lines for own inquiries"
  ON public.inquiry_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = inquiry_id
      AND created_by = auth.uid()
      AND status = 'draft'
    )
  );

CREATE POLICY "Users can update lines for own draft inquiries"
  ON public.inquiry_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = inquiry_id
      AND created_by = auth.uid()
      AND status = 'draft'
    )
  );

CREATE POLICY "Users can delete lines from own draft inquiries"
  ON public.inquiry_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = inquiry_id
      AND created_by = auth.uid()
      AND status = 'draft'
    )
  );

-- RLS Policies for inquiry_view_logs (audit - read by admins, insert by system)
CREATE POLICY "Admins can view all logs"
  ON public.inquiry_view_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'senior_manager')
    )
  );

CREATE POLICY "Users can view own logs"
  ON public.inquiry_view_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert logs"
  ON public.inquiry_view_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for stock_take_sessions
CREATE POLICY "Users can view active sessions they started"
  ON public.stock_take_sessions FOR SELECT
  USING (started_by = auth.uid());

CREATE POLICY "Managers can view all sessions"
  ON public.stock_take_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'senior_manager', 'accounting')
    )
  );

CREATE POLICY "Authorized users can create sessions"
  ON public.stock_take_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'senior_manager', 'accounting', 'warehouse_staff')
    )
  );

CREATE POLICY "Users can end own sessions"
  ON public.stock_take_sessions FOR UPDATE
  USING (started_by = auth.uid() AND status = 'active');

-- Helper function to check if user has active inquiry for stock view
CREATE OR REPLACE FUNCTION public.has_active_inquiry(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inquiries
    WHERE created_by = p_user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Helper function to check if user has active stock take session
CREATE OR REPLACE FUNCTION public.has_active_stock_take_session(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stock_take_sessions
    WHERE started_by = p_user_id
    AND status = 'active'
    AND expires_at > now()
  );
$$;

-- Helper function to check if user can bypass inquiry requirement
CREATE OR REPLACE FUNCTION public.can_bypass_inquiry(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
    AND role IN ('admin', 'senior_manager')
  );
$$;