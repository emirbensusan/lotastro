-- ===========================================
-- PHASE C: Reports, Historical Snapshots & Database Export
-- ===========================================

-- 1. FIX REPORT SAVING RLS ISSUE
-- ===========================================

-- Drop existing broken policies on email_report_configs
DROP POLICY IF EXISTS "Admins can manage report configs" ON email_report_configs;
DROP POLICY IF EXISTS "Senior managers can insert report configs" ON email_report_configs;
DROP POLICY IF EXISTS "Senior managers can view and create report configs" ON email_report_configs;

-- Recreate admin policy with WITH CHECK clause
CREATE POLICY "Admins can manage report configs" 
  ON email_report_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Senior managers can view all and manage their own
CREATE POLICY "Senior managers can view report configs" 
  ON email_report_configs FOR SELECT
  USING (has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Senior managers can manage own reports" 
  ON email_report_configs FOR ALL
  USING (has_role(auth.uid(), 'senior_manager'::user_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'senior_manager'::user_role));

-- Accounting can view and manage their own
CREATE POLICY "Accounting can view report configs" 
  ON email_report_configs FOR SELECT
  USING (has_role(auth.uid(), 'accounting'::user_role));

CREATE POLICY "Accounting can manage own reports" 
  ON email_report_configs FOR ALL
  USING (has_role(auth.uid(), 'accounting'::user_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'accounting'::user_role));

-- 2. CREATE SNAPSHOT SETTINGS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.snapshot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  snapshot_time_utc time NOT NULL DEFAULT '21:00:00',
  retention_years integer NOT NULL DEFAULT 10,
  include_lot_details boolean NOT NULL DEFAULT true,
  include_quality_breakdown boolean NOT NULL DEFAULT true,
  include_color_breakdown boolean NOT NULL DEFAULT true,
  include_customer_breakdown boolean NOT NULL DEFAULT true,
  last_snapshot_at timestamptz,
  last_snapshot_status text,
  last_snapshot_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.snapshot_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage snapshot settings
CREATE POLICY "Admins can manage snapshot settings"
  ON snapshot_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Insert default settings
INSERT INTO public.snapshot_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- 3. CREATE INVENTORY SNAPSHOTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  
  -- Aggregate totals
  total_meters numeric NOT NULL DEFAULT 0,
  total_reserved_meters numeric NOT NULL DEFAULT 0,
  total_available_meters numeric NOT NULL DEFAULT 0,
  total_lots integer NOT NULL DEFAULT 0,
  total_rolls integer NOT NULL DEFAULT 0,
  
  -- Full breakdowns (JSONB for flexibility)
  by_quality jsonb DEFAULT '{}',
  by_color jsonb DEFAULT '{}',
  by_status jsonb DEFAULT '{}',
  by_quality_color jsonb DEFAULT '{}',
  lot_details jsonb DEFAULT '[]',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(snapshot_date)
);

-- Enable RLS
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- Admins and senior managers can view snapshots
CREATE POLICY "Admins can manage inventory snapshots"
  ON inventory_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can view inventory snapshots"
  ON inventory_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Accounting can view inventory snapshots"
  ON inventory_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'accounting'::user_role));

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date ON inventory_snapshots(snapshot_date DESC);

-- 4. CREATE ORDER SNAPSHOTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.order_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  
  -- Aggregate totals
  total_orders integer NOT NULL DEFAULT 0,
  pending_orders integer NOT NULL DEFAULT 0,
  fulfilled_orders integer NOT NULL DEFAULT 0,
  pending_meters numeric NOT NULL DEFAULT 0,
  fulfilled_meters numeric NOT NULL DEFAULT 0,
  
  -- Breakdowns
  by_status jsonb DEFAULT '{}',
  by_customer jsonb DEFAULT '{}',
  order_details jsonb DEFAULT '[]',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(snapshot_date)
);

-- Enable RLS
ALTER TABLE public.order_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order snapshots"
  ON order_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can view order snapshots"
  ON order_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Accounting can view order snapshots"
  ON order_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'accounting'::user_role));

CREATE INDEX IF NOT EXISTS idx_order_snapshots_date ON order_snapshots(snapshot_date DESC);

-- 5. CREATE RESERVATION SNAPSHOTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.reservation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  
  -- Aggregate totals
  active_count integer NOT NULL DEFAULT 0,
  total_reserved_meters numeric NOT NULL DEFAULT 0,
  expiring_7_days integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  canceled_count integer NOT NULL DEFAULT 0,
  
  -- Breakdowns
  by_status jsonb DEFAULT '{}',
  by_customer jsonb DEFAULT '{}',
  reservation_details jsonb DEFAULT '[]',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(snapshot_date)
);

-- Enable RLS
ALTER TABLE public.reservation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reservation snapshots"
  ON reservation_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can view reservation snapshots"
  ON reservation_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Accounting can view reservation snapshots"
  ON reservation_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'accounting'::user_role));

CREATE INDEX IF NOT EXISTS idx_reservation_snapshots_date ON reservation_snapshots(snapshot_date DESC);

-- 6. CREATE DATABASE EXPORT LOGS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.database_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL, -- 'excel', 'csv', 'json'
  tables_included text[] NOT NULL,
  file_size_bytes bigint,
  row_counts jsonb DEFAULT '{}',
  exported_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  error_message text
);

-- Enable RLS
ALTER TABLE public.database_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage export logs"
  ON database_export_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own export logs"
  ON database_export_logs FOR SELECT
  USING (exported_by = auth.uid());

-- 7. ADD TRIGGER FOR UPDATED_AT ON SNAPSHOT_SETTINGS
-- ===========================================

CREATE TRIGGER update_snapshot_settings_updated_at
  BEFORE UPDATE ON snapshot_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();