-- Add new columns to email_templates
ALTER TABLE email_templates
ADD COLUMN IF NOT EXISTS category text DEFAULT 'system',
ADD COLUMN IF NOT EXISTS default_subject_en text,
ADD COLUMN IF NOT EXISTS default_subject_tr text,
ADD COLUMN IF NOT EXISTS default_body_en text,
ADD COLUMN IF NOT EXISTS default_body_tr text,
ADD COLUMN IF NOT EXISTS variables_meta jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Update existing templates to store their current content as defaults
UPDATE email_templates
SET 
  default_subject_en = subject_en,
  default_subject_tr = subject_tr,
  default_body_en = body_en,
  default_body_tr = body_tr,
  is_system = true
WHERE default_subject_en IS NULL;

-- Create email_template_versions table for version history
CREATE TABLE IF NOT EXISTS email_template_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  subject_en text NOT NULL,
  subject_tr text NOT NULL,
  body_en text NOT NULL,
  body_tr text NOT NULL,
  changed_by uuid NOT NULL,
  change_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create email_template_usage table for dependency tracking
CREATE TABLE IF NOT EXISTS email_template_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  usage_type text NOT NULL, -- 'cron', 'edge_function', 'manual'
  usage_name text NOT NULL, -- e.g., 'MO Daily Reminder', 'send-mo-reminders'
  schedule text, -- e.g., 'Every day at 08:00'
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(template_id, usage_type, usage_name)
);

-- Enable RLS on new tables
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_template_versions
CREATE POLICY "Admins can manage template versions"
ON email_template_versions
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view template versions"
ON email_template_versions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS policies for email_template_usage
CREATE POLICY "Admins can manage template usage"
ON email_template_usage
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view template usage"
ON email_template_usage
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Insert usage tracking for existing MO reminder templates
INSERT INTO email_template_usage (template_id, usage_type, usage_name, schedule, description)
SELECT 
  id,
  'cron',
  'MO Daily Reminder',
  'Configurable via settings',
  'Sends reminder emails for manufacturing orders approaching their expected completion date'
FROM email_templates 
WHERE template_key = 'mo_reminder'
ON CONFLICT DO NOTHING;

INSERT INTO email_template_usage (template_id, usage_type, usage_name, schedule, description)
SELECT 
  id,
  'cron',
  'MO Overdue Alert',
  'Daily',
  'Sends alert emails for manufacturing orders that have passed their expected completion date'
FROM email_templates 
WHERE template_key = 'mo_overdue'
ON CONFLICT DO NOTHING;

INSERT INTO email_template_usage (template_id, usage_type, usage_name, schedule, description)
SELECT 
  id,
  'cron',
  'Weekly Summary',
  'Weekly (configurable)',
  'Sends a weekly summary of all manufacturing orders'
FROM email_templates 
WHERE template_key = 'mo_weekly_summary'
ON CONFLICT DO NOTHING;

-- Add sample variables_meta for existing templates
UPDATE email_templates
SET variables_meta = '[
  {"name": "mo_number", "description": "Manufacturing order number", "example": "MO-20241208-001", "required": true},
  {"name": "quality", "description": "Fabric quality code", "example": "P200", "required": true},
  {"name": "color", "description": "Fabric color name", "example": "Navy Blue", "required": true},
  {"name": "ordered_meters", "description": "Number of meters ordered", "example": "5,000", "required": true},
  {"name": "supplier", "description": "Supplier name", "example": "Textile Corp", "required": true},
  {"name": "eta", "description": "Expected completion date", "example": "2024-12-15", "required": false},
  {"name": "status", "description": "Current order status", "example": "IN_PRODUCTION", "required": false},
  {"name": "customer", "description": "Customer name (if customer order)", "example": "Acme Inc", "required": false},
  {"name": "overdue_days", "description": "Number of days overdue", "example": "3", "required": false}
]'::jsonb
WHERE template_key LIKE 'mo_%' AND variables_meta = '[]'::jsonb;