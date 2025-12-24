-- Create report execution history table
CREATE TABLE public.report_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_config_id UUID REFERENCES public.email_report_configs(id) ON DELETE CASCADE,
  executed_by UUID NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  execution_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled', 'shared'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  error_message TEXT,
  row_count INTEGER,
  duration_ms INTEGER,
  output_format TEXT NOT NULL DEFAULT 'html',
  file_path TEXT, -- Storage path for generated files
  file_size_bytes INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create report shares table
CREATE TABLE public.report_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_config_id UUID NOT NULL REFERENCES public.email_report_configs(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  share_type TEXT NOT NULL DEFAULT 'link', -- 'link', 'email', 'role'
  shared_with TEXT, -- email address or role name
  permissions TEXT NOT NULL DEFAULT 'view', -- 'view', 'execute', 'edit'
  expires_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_report_executions_config ON public.report_executions(report_config_id);
CREATE INDEX idx_report_executions_executed_by ON public.report_executions(executed_by);
CREATE INDEX idx_report_executions_executed_at ON public.report_executions(executed_at DESC);
CREATE INDEX idx_report_shares_token ON public.report_shares(share_token);
CREATE INDEX idx_report_shares_config ON public.report_shares(report_config_id);

-- Enable RLS
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_executions
CREATE POLICY "Users can view their own executions"
ON public.report_executions
FOR SELECT
USING (executed_by = auth.uid());

CREATE POLICY "Admins and senior managers can view all executions"
ON public.report_executions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Users can insert their own executions"
ON public.report_executions
FOR INSERT
WITH CHECK (executed_by = auth.uid());

CREATE POLICY "Users can update their own executions"
ON public.report_executions
FOR UPDATE
USING (executed_by = auth.uid());

CREATE POLICY "Admins can delete executions"
ON public.report_executions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for report_shares
CREATE POLICY "Users can view shares they created"
ON public.report_shares
FOR SELECT
USING (shared_by = auth.uid());

CREATE POLICY "Admins can view all shares"
ON public.report_shares
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can create shares for their reports"
ON public.report_shares
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) 
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR EXISTS (
    SELECT 1 FROM public.email_report_configs 
    WHERE id = report_config_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can update their own shares"
ON public.report_shares
FOR UPDATE
USING (shared_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can delete their own shares"
ON public.report_shares
FOR DELETE
USING (shared_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));