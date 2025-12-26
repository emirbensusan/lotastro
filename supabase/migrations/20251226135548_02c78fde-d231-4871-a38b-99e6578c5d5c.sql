-- Create system_settings table for app-wide configuration
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view system settings
CREATE POLICY "Admins can view system_settings"
  ON public.system_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Only admins can manage system settings
CREATE POLICY "Admins can manage system_settings"
  ON public.system_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('session_config', '{"timeout_minutes": 30, "warning_minutes": 5, "strict_timeout": false, "require_mfa_for_admin": true}'::jsonb, 'Session timeout and MFA settings'),
  ('password_policy', '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_number": true, "require_special": true, "password_expiry_days": null, "prevent_reuse_count": 0}'::jsonb, 'Password policy requirements');

-- Add index for fast lookup by key
CREATE INDEX idx_system_settings_key ON public.system_settings(setting_key);