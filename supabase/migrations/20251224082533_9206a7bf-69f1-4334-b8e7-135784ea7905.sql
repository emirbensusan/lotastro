-- Phase 9: Schema refinements for the Report Builder

-- Add sorting column to store sort configurations
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS sorting jsonb DEFAULT '[]'::jsonb;

-- Add schedule_config column to store inline schedule settings
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS schedule_config jsonb DEFAULT NULL;

-- Add schedule_id to link to email_schedules if using separate scheduling
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.email_schedules(id) ON DELETE SET NULL;

-- Add description column for better documentation
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS description text;

-- Create index for faster lookups by data_source
CREATE INDEX IF NOT EXISTS idx_email_report_configs_data_source 
ON public.email_report_configs(data_source);

-- Create index for schedule lookups
CREATE INDEX IF NOT EXISTS idx_email_report_configs_schedule_id 
ON public.email_report_configs(schedule_id);

-- Add report_config_id to email_schedules for bidirectional linking
ALTER TABLE public.email_schedules
ADD COLUMN IF NOT EXISTS report_config_id uuid REFERENCES public.email_report_configs(id) ON DELETE SET NULL;

-- Create index for report config lookups on schedules
CREATE INDEX IF NOT EXISTS idx_email_schedules_report_config_id 
ON public.email_schedules(report_config_id);

-- Add last_generated_at to track when report was last generated
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS last_generated_at timestamp with time zone;

-- Add generation_count for analytics
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS generation_count integer DEFAULT 0;

-- Update comment on table
COMMENT ON TABLE public.email_report_configs IS 'Dynamic report configurations created via the Report Builder';