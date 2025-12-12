-- Phase 1: Email System Database Schema Foundation

-- ============================================
-- 1. Add alerts_enabled to qualities table
-- ============================================
ALTER TABLE public.qualities ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT false;

-- ============================================
-- 2. Create email_digest_configs table
-- ============================================
CREATE TABLE public.email_digest_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_type TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  schedule_type TEXT DEFAULT 'daily',
  schedule_config JSONB DEFAULT '{"hour": 9, "minute": 0, "timezone": "Europe/Istanbul", "days": [1,2,3,4,5]}',
  recipients JSONB DEFAULT '[]',
  last_sent_at TIMESTAMPTZ,
  cooldown_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for email_digest_configs
ALTER TABLE public.email_digest_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email_digest_configs"
ON public.email_digest_configs FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update email_digest_configs"
ON public.email_digest_configs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert email_digest_configs"
ON public.email_digest_configs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Insert default digest configurations
INSERT INTO public.email_digest_configs (digest_type, is_enabled, schedule_type, recipients) VALUES
  ('stock_alerts', true, 'daily', '["role:admin", "role:senior_manager"]'),
  ('reservations_expiring', true, 'daily', '["role:admin", "role:senior_manager"]'),
  ('overdue_digest', true, 'daily', '["role:admin", "role:senior_manager"]'),
  ('pending_approvals', true, 'daily', '["role:admin", "role:senior_manager"]'),
  ('forecast_weekly', true, 'weekly', '["role:admin", "role:senior_manager"]');

-- ============================================
-- 3. Create email_schedules table
-- ============================================
CREATE TABLE public.email_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_config JSONB NOT NULL DEFAULT '{"hour": 9, "minute": 0, "timezone": "Europe/Istanbul"}',
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for email_schedules
ALTER TABLE public.email_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_schedules"
ON public.email_schedules FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can view email_schedules"
ON public.email_schedules FOR SELECT
USING (has_role(auth.uid(), 'senior_manager'::user_role));

-- ============================================
-- 4. Create email_recipients table
-- ============================================
CREATE TABLE public.email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.email_schedules(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL,
  recipient_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_recipient_type CHECK (recipient_type IN ('email', 'role', 'dynamic'))
);

-- RLS for email_recipients
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_recipients"
ON public.email_recipients FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can view email_recipients"
ON public.email_recipients FOR SELECT
USING (has_role(auth.uid(), 'senior_manager'::user_role));

-- ============================================
-- 5. Create email_recipient_preferences table
-- ============================================
CREATE TABLE public.email_recipient_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  template_category TEXT,
  frequency TEXT DEFAULT 'immediate',
  is_subscribed BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  consent_given_at TIMESTAMPTZ DEFAULT now(),
  consent_source TEXT DEFAULT 'registration',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_frequency CHECK (frequency IN ('immediate', 'daily_digest', 'weekly_digest')),
  CONSTRAINT valid_consent_source CHECK (consent_source IN ('registration', 'admin_added', 'self_service'))
);

-- RLS for email_recipient_preferences
ALTER TABLE public.email_recipient_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON public.email_recipient_preferences FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
ON public.email_recipient_preferences FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all preferences"
ON public.email_recipient_preferences FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- ============================================
-- 6. Create email_report_configs table
-- ============================================
CREATE TABLE public.email_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  grouping JSONB DEFAULT '{}',
  comparison_period TEXT,
  include_charts BOOLEAN DEFAULT false,
  output_formats TEXT[] DEFAULT ARRAY['html'],
  created_by UUID REFERENCES public.profiles(user_id),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_report_type CHECK (report_type IN ('inventory_stock', 'inventory_position', 'inventory_aging', 'incoming_orders', 'orders_pipeline', 'production_digest', 'custom'))
);

-- RLS for email_report_configs
ALTER TABLE public.email_report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage report configs"
ON public.email_report_configs FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can view and create report configs"
ON public.email_report_configs FOR SELECT
USING (has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Senior managers can insert report configs"
ON public.email_report_configs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'senior_manager'::user_role));

-- Insert default report configurations
INSERT INTO public.email_report_configs (name, report_type, columns, is_system) VALUES
  ('Default Stock Report', 'inventory_stock', '[{"key": "quality", "label_en": "Quality", "label_tr": "Kalite", "visible": true, "order": 1}, {"key": "color", "label_en": "Color", "label_tr": "Renk", "visible": true, "order": 2}, {"key": "total_meters", "label_en": "Total Meters", "label_tr": "Toplam Metre", "visible": true, "order": 3}]', true),
  ('Default Position Report', 'inventory_position', '[{"key": "quality", "label_en": "Quality", "label_tr": "Kalite", "visible": true, "order": 1}, {"key": "color", "label_en": "Color", "label_tr": "Renk", "visible": true, "order": 2}, {"key": "available", "label_en": "Available", "label_tr": "Mevcut", "visible": true, "order": 3}, {"key": "reserved", "label_en": "Reserved", "label_tr": "Rezerve", "visible": true, "order": 4}, {"key": "incoming", "label_en": "Incoming", "label_tr": "Gelen", "visible": true, "order": 5}, {"key": "in_production", "label_en": "In Production", "label_tr": "Üretimde", "visible": true, "order": 6}]', true),
  ('Default Aging Report', 'inventory_aging', '[{"key": "quality", "label_en": "Quality", "label_tr": "Kalite", "visible": true, "order": 1}, {"key": "color", "label_en": "Color", "label_tr": "Renk", "visible": true, "order": 2}, {"key": "days_since_movement", "label_en": "Days Since Movement", "label_tr": "Hareketsiz Gün", "visible": true, "order": 3}, {"key": "last_movement_date", "label_en": "Last Movement", "label_tr": "Son Hareket", "visible": true, "order": 4}]', true);

-- ============================================
-- 7. Create email_alert_acknowledgments table
-- ============================================
CREATE TABLE public.email_alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id UUID REFERENCES public.email_log(id) ON DELETE CASCADE,
  acknowledged_by UUID REFERENCES public.profiles(user_id),
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- RLS for email_alert_acknowledgments
ALTER TABLE public.email_alert_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and senior managers can view acknowledgments"
ON public.email_alert_acknowledgments FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Admins and senior managers can insert acknowledgments"
ON public.email_alert_acknowledgments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

-- ============================================
-- 8. Extend email_log table
-- ============================================
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS attachments JSONB;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN DEFAULT false;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.email_schedules(id);
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS digest_type TEXT;

-- ============================================
-- 9. Extend email_templates table
-- ============================================
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS send_count INTEGER DEFAULT 0;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_seconds": [60, 300, 900]}';
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS is_digest BOOLEAN DEFAULT false;

-- ============================================
-- 10. Add email system settings
-- ============================================
INSERT INTO public.email_settings (setting_key, setting_value, description) VALUES
  ('alert_cooldown_hours', '{"stock_alerts": 24, "reservations_expiring": 24, "overdue_digest": 24, "pending_approvals": 24}', 'Cooldown hours per digest type before resending'),
  ('attachment_size_limit_mb', '10', 'Maximum attachment size in MB before using download link'),
  ('attachment_compression_enabled', 'true', 'Enable automatic compression for attachments'),
  ('retry_config_default', '{"max_retries": 3, "backoff_seconds": [60, 300, 900]}', 'Default retry configuration for failed emails'),
  ('digest_summary_link_enabled', 'true', 'Include "View Full Report" link in digests for large reports')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- 11. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_log_digest_type ON public.email_log(digest_type);
CREATE INDEX IF NOT EXISTS idx_email_log_next_retry ON public.email_log(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_log_requires_ack ON public.email_log(requires_acknowledgment) WHERE requires_acknowledgment = true;
CREATE INDEX IF NOT EXISTS idx_email_schedules_next_run ON public.email_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_digest_configs_type ON public.email_digest_configs(digest_type);
CREATE INDEX IF NOT EXISTS idx_qualities_alerts_enabled ON public.qualities(alerts_enabled) WHERE alerts_enabled = true;

-- ============================================
-- 12. Create updated_at trigger for new tables
-- ============================================
CREATE TRIGGER update_email_digest_configs_updated_at
  BEFORE UPDATE ON public.email_digest_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_schedules_updated_at
  BEFORE UPDATE ON public.email_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_recipient_preferences_updated_at
  BEFORE UPDATE ON public.email_recipient_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_report_configs_updated_at
  BEFORE UPDATE ON public.email_report_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();