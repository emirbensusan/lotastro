-- Batch M: Advanced Forecasting - Add seasonal adjustments, trend detection, and accuracy tracking

-- 1. Add seasonal indices and trend detection to global settings
ALTER TABLE public.forecast_settings_global 
ADD COLUMN IF NOT EXISTS seasonal_indices JSONB DEFAULT '{
  "1": 1.0, "2": 1.0, "3": 1.0, "4": 1.0, "5": 1.0, "6": 1.0,
  "7": 1.0, "8": 1.0, "9": 1.0, "10": 1.0, "11": 1.0, "12": 1.0
}'::jsonb,
ADD COLUMN IF NOT EXISTS seasonal_adjustment_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trend_detection_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trend_smoothing_periods INTEGER DEFAULT 3;

-- 2. Create forecast accuracy tracking table
CREATE TABLE IF NOT EXISTS public.forecast_accuracy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  forecasted_amount NUMERIC NOT NULL,
  actual_amount NUMERIC NOT NULL,
  absolute_error NUMERIC GENERATED ALWAYS AS (ABS(forecasted_amount - actual_amount)) STORED,
  percentage_error NUMERIC GENERATED ALWAYS AS (
    CASE WHEN actual_amount > 0 
      THEN ABS(forecasted_amount - actual_amount) / actual_amount * 100 
      ELSE 0 
    END
  ) STORED,
  forecast_run_id UUID REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(quality_code, color_code, period_start, period_end, forecast_run_id)
);

-- 3. Create aggregate accuracy metrics table
CREATE TABLE IF NOT EXISTS public.forecast_accuracy_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_date DATE NOT NULL,
  quality_code TEXT,  -- NULL means global metrics
  color_code TEXT,    -- NULL means quality-level metrics
  period_type TEXT NOT NULL DEFAULT 'monthly',  -- weekly, monthly, quarterly
  total_items INTEGER NOT NULL DEFAULT 0,
  mape NUMERIC,  -- Mean Absolute Percentage Error
  mae NUMERIC,   -- Mean Absolute Error
  rmse NUMERIC,  -- Root Mean Square Error
  bias NUMERIC,  -- Average forecast bias (positive = over-forecast)
  hit_rate NUMERIC,  -- Percentage of forecasts within acceptable range
  forecast_run_id UUID REFERENCES public.forecast_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(calculation_date, quality_code, color_code, period_type)
);

-- 4. Add trend_factor to forecast_results for trend analysis
ALTER TABLE public.forecast_results
ADD COLUMN IF NOT EXISTS seasonal_factor NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS trend_direction TEXT DEFAULT 'stable';  -- 'rising', 'falling', 'stable'

-- 5. Enable RLS on new tables
ALTER TABLE public.forecast_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_accuracy_metrics ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for forecast_accuracy
CREATE POLICY "Users can view forecast accuracy"
ON public.forecast_accuracy FOR SELECT
USING (true);

CREATE POLICY "Service role can manage forecast accuracy"
ON public.forecast_accuracy FOR ALL
USING (auth.role() = 'service_role');

-- 7. Create RLS policies for forecast_accuracy_metrics
CREATE POLICY "Users can view forecast accuracy metrics"
ON public.forecast_accuracy_metrics FOR SELECT
USING (true);

CREATE POLICY "Service role can manage forecast accuracy metrics"
ON public.forecast_accuracy_metrics FOR ALL
USING (auth.role() = 'service_role');

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_quality_color 
ON public.forecast_accuracy(quality_code, color_code);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_period 
ON public.forecast_accuracy(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_metrics_date 
ON public.forecast_accuracy_metrics(calculation_date DESC);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_metrics_quality 
ON public.forecast_accuracy_metrics(quality_code, color_code);