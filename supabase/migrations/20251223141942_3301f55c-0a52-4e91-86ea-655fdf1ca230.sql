-- Create scheduled_reports table for automated report sending
CREATE TABLE public.scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_type text NOT NULL,
  report_config_id uuid REFERENCES public.email_report_configs(id) ON DELETE SET NULL,
  output_format text NOT NULL DEFAULT 'excel',
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_config jsonb NOT NULL DEFAULT '{"hour": 9, "minute": 0, "timezone": "Europe/Istanbul"}',
  recipients jsonb NOT NULL DEFAULT '{"emails": [], "roles": []}',
  is_enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins and senior managers can manage scheduled reports
CREATE POLICY "Admins can manage scheduled_reports"
ON public.scheduled_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers can manage scheduled_reports"
ON public.scheduled_reports
FOR ALL
USING (has_role(auth.uid(), 'senior_manager'::user_role));

-- Create index for efficient cron queries
CREATE INDEX idx_scheduled_reports_next_run 
ON public.scheduled_reports(next_run_at) 
WHERE is_enabled = true;

-- Create index on report_config_id for joins
CREATE INDEX idx_scheduled_reports_config 
ON public.scheduled_reports(report_config_id);

-- Add trigger for updated_at
CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON public.scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add reports:managereports permission for admin and senior_manager
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed)
VALUES
  ('admin', 'reports', 'managereports', true),
  ('senior_manager', 'reports', 'managereports', true),
  ('accounting', 'reports', 'managereports', false),
  ('warehouse_staff', 'reports', 'managereports', false)
ON CONFLICT (role, permission_category, permission_action) DO NOTHING;