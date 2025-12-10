-- Create catalog_approval_settings table for storing approval workflow configuration
CREATE TABLE IF NOT EXISTS public.catalog_approval_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.catalog_approval_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage approval settings
CREATE POLICY "Admins can manage catalog_approval_settings"
  ON public.catalog_approval_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authorized users can view catalog_approval_settings"
  ON public.catalog_approval_settings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'senior_manager'::user_role) OR 
    has_role(auth.uid(), 'accounting'::user_role)
  );

-- Insert default trigger fields
INSERT INTO public.catalog_approval_settings (setting_key, setting_value)
VALUES (
  'trigger_fields',
  '{"fields": ["composition", "weight_g_m2", "eu_origin", "spec_sheet_file", "test_report_file"]}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;