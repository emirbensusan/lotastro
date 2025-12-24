-- Add new columns to email_report_configs for dynamic report configuration
ALTER TABLE public.email_report_configs 
ADD COLUMN IF NOT EXISTS data_source text,
ADD COLUMN IF NOT EXISTS selected_joins jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS columns_config jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS calculated_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS styling jsonb DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.email_report_configs.data_source IS 'The primary data source table for the report';
COMMENT ON COLUMN public.email_report_configs.selected_joins IS 'Array of related tables to join';
COMMENT ON COLUMN public.email_report_configs.columns_config IS 'Array of column configurations with display settings';
COMMENT ON COLUMN public.email_report_configs.calculated_fields IS 'Array of calculated/computed field definitions';
COMMENT ON COLUMN public.email_report_configs.styling IS 'Styling configuration for headers, colors, etc.';