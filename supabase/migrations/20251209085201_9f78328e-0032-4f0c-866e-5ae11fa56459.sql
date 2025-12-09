-- =============================================
-- PHASE 1: FORECASTING MODULE - DATABASE FOUNDATION
-- =============================================

-- 1. UPDATE EXISTING TABLES
-- =============================================

-- 1.1 Add unit column to qualities table (M = meters, KG = kilograms)
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'M';
ALTER TABLE qualities ADD CONSTRAINT qualities_unit_check CHECK (unit IN ('M', 'KG'));

-- 1.2 Add default lead time to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS default_lead_time_days INTEGER DEFAULT 30;

-- 1.3 Rename ordered_meters to ordered_amount in manufacturing_orders
ALTER TABLE manufacturing_orders RENAME COLUMN ordered_meters TO ordered_amount;

-- =============================================
-- 2. CREATE FORECAST TABLES
-- =============================================

-- 2.1 Global forecast settings
CREATE TABLE IF NOT EXISTS forecast_settings_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Forecast parameters
  forecast_horizon_months INTEGER NOT NULL DEFAULT 3,
  time_bucket TEXT NOT NULL DEFAULT '2-week' CHECK (time_bucket IN ('weekly', '2-week', 'monthly', 'quarterly')),
  history_window_months INTEGER NOT NULL DEFAULT 12,
  
  -- Calculation methods
  normalization_type TEXT NOT NULL DEFAULT 'none' CHECK (normalization_type IN ('none', 'cap_outliers', 'moving_average')),
  outlier_percentile INTEGER NOT NULL DEFAULT 95,
  weighting_method TEXT NOT NULL DEFAULT 'fixed' CHECK (weighting_method IN ('fixed', 'linear_decay', 'exponential_decay')),
  
  -- Safety stock defaults
  default_safety_stock_weeks NUMERIC NOT NULL DEFAULT 2,
  default_safety_stock_mode TEXT NOT NULL DEFAULT 'weeks' CHECK (default_safety_stock_mode IN ('weeks', 'min_units', 'min_per_color')),
  min_order_zero_history NUMERIC NOT NULL DEFAULT 0,
  
  -- Demand sources (JSONB array of statuses to include)
  demand_statuses JSONB NOT NULL DEFAULT '["confirmed", "reserved"]'::jsonb,
  
  -- UI settings
  override_row_tint_color TEXT NOT NULL DEFAULT '#FEF3C7', -- Amber-100 tint
  
  -- Schedule settings
  weekly_schedule_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_schedule_day INTEGER NOT NULL DEFAULT 1 CHECK (weekly_schedule_day BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday
  weekly_schedule_hour INTEGER NOT NULL DEFAULT 6 CHECK (weekly_schedule_hour BETWEEN 0 AND 23),
  weekly_schedule_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  
  -- Alert thresholds
  stockout_alert_days INTEGER NOT NULL DEFAULT 14,
  overstock_alert_months INTEGER NOT NULL DEFAULT 6,
  
  -- Email digest settings
  email_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  email_digest_day INTEGER NOT NULL DEFAULT 1,
  email_digest_hour INTEGER NOT NULL DEFAULT 8,
  email_digest_recipients JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of user IDs or role names
  
  -- Scenario parameters (JSONB for flexibility)
  scenario_parameters JSONB NOT NULL DEFAULT '{
    "conservative": {"coverage_multiplier": 1.5, "safety_multiplier": 1.5, "history_weight": 1.2},
    "normal": {"coverage_multiplier": 1.0, "safety_multiplier": 1.0, "history_weight": 1.0},
    "aggressive": {"coverage_multiplier": 0.7, "safety_multiplier": 0.7, "history_weight": 0.8}
  }'::jsonb,
  
  -- Permissions (configurable roles for each action)
  permissions JSONB NOT NULL DEFAULT '{
    "view_forecasts": ["admin", "senior_manager"],
    "run_forecasts": ["admin", "senior_manager"],
    "modify_settings": ["admin"],
    "import_data": ["admin", "senior_manager"]
  }'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2.2 Per-quality forecast settings overrides
CREATE TABLE IF NOT EXISTS forecast_settings_per_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  
  -- Override values (NULL means use global default)
  lead_time_days INTEGER,
  safety_stock_weeks NUMERIC,
  safety_stock_mode TEXT CHECK (safety_stock_mode IS NULL OR safety_stock_mode IN ('weeks', 'min_units', 'min_per_color')),
  target_coverage_weeks NUMERIC,
  min_recommended_order NUMERIC,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  UNIQUE(quality_code, color_code)
);

-- 2.3 Historical demand data (imported from CSV)
CREATE TABLE IF NOT EXISTS demand_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  demand_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('M', 'KG')),
  document_status TEXT NOT NULL, -- confirmed, reserved, draft
  source TEXT NOT NULL DEFAULT 'csv_import', -- csv_import, system_sync
  
  -- Import tracking
  import_batch_id UUID, -- Links rows from same import
  import_row_number INTEGER, -- Original row number in CSV
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Prevent exact duplicates
  UNIQUE(quality_code, color_code, demand_date, document_status, amount)
);

-- 2.4 Forecast run log
CREATE TABLE IF NOT EXISTS forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('scheduled', 'manual', 'partial')),
  
  -- Timing
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  
  -- Stats
  total_combinations INTEGER DEFAULT 0,
  processed_combinations INTEGER DEFAULT 0,
  
  -- For partial runs, which qualities were recalculated
  affected_qualities JSONB, -- Array of {quality_code, color_code}
  
  -- User who triggered (NULL for scheduled runs)
  triggered_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Forecast results per period
CREATE TABLE IF NOT EXISTS forecast_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('M', 'KG')),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Forecast values
  forecast_amount NUMERIC NOT NULL,
  scenario TEXT NOT NULL CHECK (scenario IN ('base', 'conservative', 'normal', 'aggressive')),
  
  -- Supporting data (for transparency)
  historical_avg NUMERIC,
  weighted_avg NUMERIC,
  trend_factor NUMERIC,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 Purchase recommendations
CREATE TABLE IF NOT EXISTS purchase_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('M', 'KG')),
  
  -- Current stock position
  available_stock NUMERIC NOT NULL DEFAULT 0,
  incoming_stock NUMERIC NOT NULL DEFAULT 0,
  in_production_stock NUMERIC NOT NULL DEFAULT 0,
  total_stock_position NUMERIC NOT NULL DEFAULT 0,
  
  -- Demand metrics
  past_12m_demand NUMERIC NOT NULL DEFAULT 0,
  forecasted_lead_time_demand NUMERIC NOT NULL DEFAULT 0,
  
  -- Safety stock
  safety_stock_value NUMERIC NOT NULL DEFAULT 0,
  target_coverage_weeks NUMERIC NOT NULL DEFAULT 0,
  
  -- Recommendations
  conservative_recommendation NUMERIC NOT NULL DEFAULT 0,
  normal_recommendation NUMERIC NOT NULL DEFAULT 0,
  aggressive_recommendation NUMERIC NOT NULL DEFAULT 0,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'ignored', 'ordered')),
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- Lead time used
  lead_time_days INTEGER NOT NULL,
  
  -- Override indicator
  has_quality_override BOOLEAN NOT NULL DEFAULT false,
  
  -- Last order info
  last_order_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(run_id, quality_code, color_code)
);

-- 2.7 Forecast alerts
CREATE TABLE IF NOT EXISTS forecast_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('M', 'KG')),
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('stockout_risk', 'overstock_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Metrics
  projected_stockout_days INTEGER, -- Days until stockout (for stockout alerts)
  coverage_months NUMERIC, -- Months of stock on hand (for overstock alerts)
  current_stock NUMERIC NOT NULL,
  forecasted_demand NUMERIC NOT NULL,
  
  -- Resolution
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  
  -- Deduplication - prevent duplicate alerts for same issue
  previous_alert_id UUID REFERENCES forecast_alerts(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8 Forecast settings audit log
CREATE TABLE IF NOT EXISTS forecast_settings_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- What was changed
  scope TEXT NOT NULL CHECK (scope IN ('global', 'per_quality')),
  quality_code TEXT, -- Only for per_quality scope
  color_code TEXT, -- Only for per_quality scope
  
  parameter_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  
  -- Additional context
  change_reason TEXT
);

-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE forecast_settings_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_settings_per_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_settings_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS POLICIES
-- =============================================

-- 4.1 forecast_settings_global policies
CREATE POLICY "Admins and senior managers can view forecast_settings_global"
  ON forecast_settings_global FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Only admins can insert forecast_settings_global"
  ON forecast_settings_global FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can update forecast_settings_global"
  ON forecast_settings_global FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can delete forecast_settings_global"
  ON forecast_settings_global FOR DELETE
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 4.2 forecast_settings_per_quality policies
CREATE POLICY "Admins and senior managers can view forecast_settings_per_quality"
  ON forecast_settings_per_quality FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Only admins can manage forecast_settings_per_quality"
  ON forecast_settings_per_quality FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 4.3 demand_history policies
CREATE POLICY "Admins and senior managers can view demand_history"
  ON demand_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Admins and senior managers can insert demand_history"
  ON demand_history FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Only admins can update demand_history"
  ON demand_history FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can delete demand_history"
  ON demand_history FOR DELETE
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 4.4 forecast_runs policies
CREATE POLICY "Admins and senior managers can view forecast_runs"
  ON forecast_runs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Admins and senior managers can insert forecast_runs"
  ON forecast_runs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Admins and senior managers can update forecast_runs"
  ON forecast_runs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

-- 4.5 forecast_results policies
CREATE POLICY "Admins and senior managers can view forecast_results"
  ON forecast_results FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "System can insert forecast_results"
  ON forecast_results FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

-- 4.6 purchase_recommendations policies
CREATE POLICY "Admins and senior managers can view purchase_recommendations"
  ON purchase_recommendations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Admins and senior managers can manage purchase_recommendations"
  ON purchase_recommendations FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

-- 4.7 forecast_alerts policies
CREATE POLICY "Admins and senior managers can view forecast_alerts"
  ON forecast_alerts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "System can insert forecast_alerts"
  ON forecast_alerts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Admins and senior managers can update forecast_alerts"
  ON forecast_alerts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

-- 4.8 forecast_settings_audit_log policies
CREATE POLICY "Admins can view forecast_settings_audit_log"
  ON forecast_settings_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "System can insert forecast_settings_audit_log"
  ON forecast_settings_audit_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- =============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =============================================

-- demand_history indexes (critical for 7 years of data)
CREATE INDEX IF NOT EXISTS idx_demand_history_quality_color_date 
  ON demand_history(quality_code, color_code, demand_date DESC);
CREATE INDEX IF NOT EXISTS idx_demand_history_date 
  ON demand_history(demand_date DESC);
CREATE INDEX IF NOT EXISTS idx_demand_history_import_batch 
  ON demand_history(import_batch_id);

-- forecast_results indexes
CREATE INDEX IF NOT EXISTS idx_forecast_results_run_id 
  ON forecast_results(run_id);
CREATE INDEX IF NOT EXISTS idx_forecast_results_quality_color 
  ON forecast_results(quality_code, color_code);
CREATE INDEX IF NOT EXISTS idx_forecast_results_period 
  ON forecast_results(period_start, period_end);

-- purchase_recommendations indexes
CREATE INDEX IF NOT EXISTS idx_purchase_recommendations_run_id 
  ON purchase_recommendations(run_id);
CREATE INDEX IF NOT EXISTS idx_purchase_recommendations_normal_desc 
  ON purchase_recommendations(run_id, normal_recommendation DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_recommendations_status 
  ON purchase_recommendations(status);

-- forecast_alerts indexes
CREATE INDEX IF NOT EXISTS idx_forecast_alerts_run_id 
  ON forecast_alerts(run_id);
CREATE INDEX IF NOT EXISTS idx_forecast_alerts_unresolved 
  ON forecast_alerts(is_resolved, severity);
CREATE INDEX IF NOT EXISTS idx_forecast_alerts_quality_color 
  ON forecast_alerts(quality_code, color_code);

-- forecast_runs indexes
CREATE INDEX IF NOT EXISTS idx_forecast_runs_status 
  ON forecast_runs(status);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_completed 
  ON forecast_runs(completed_at DESC) WHERE status = 'completed';

-- forecast_settings_per_quality indexes
CREATE INDEX IF NOT EXISTS idx_forecast_settings_per_quality_lookup 
  ON forecast_settings_per_quality(quality_code, color_code);

-- =============================================
-- 6. TRIGGER FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_forecast_settings_global_updated_at
  BEFORE UPDATE ON forecast_settings_global
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forecast_settings_per_quality_updated_at
  BEFORE UPDATE ON forecast_settings_per_quality
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. INSERT DEFAULT GLOBAL SETTINGS
-- =============================================

INSERT INTO forecast_settings_global (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;