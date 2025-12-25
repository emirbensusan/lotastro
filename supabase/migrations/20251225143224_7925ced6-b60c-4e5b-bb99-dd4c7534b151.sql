-- API Request Logs for Rate Limiting
CREATE TABLE public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  request_body_size INTEGER,
  response_body_size INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast rate limiting queries (key + time window)
CREATE INDEX idx_api_request_logs_rate_limit 
  ON public.api_request_logs(api_key_id, created_at DESC);

-- Index for endpoint analytics
CREATE INDEX idx_api_request_logs_endpoint 
  ON public.api_request_logs(endpoint, created_at DESC);

-- Enable RLS
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can view all API request logs"
  ON public.api_request_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert API request logs"
  ON public.api_request_logs
  FOR INSERT
  WITH CHECK (true);

-- Function to clean up old logs (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_api_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.api_request_logs
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_api_key_id UUID,
  p_limit_per_minute INTEGER
)
RETURNS TABLE(
  is_limited BOOLEAN,
  current_count BIGINT,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count BIGINT;
BEGIN
  v_window_start := now() - INTERVAL '1 minute';
  
  SELECT COUNT(*) INTO v_count
  FROM public.api_request_logs
  WHERE api_key_id = p_api_key_id
    AND created_at >= v_window_start;
  
  RETURN QUERY SELECT 
    v_count >= p_limit_per_minute,
    v_count,
    v_window_start + INTERVAL '1 minute';
END;
$$;