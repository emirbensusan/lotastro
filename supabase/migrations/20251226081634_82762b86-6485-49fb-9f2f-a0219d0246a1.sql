-- Create table to track login attempts for rate limiting
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Create index for efficient queries
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts (ip_address, attempted_at DESC);

-- Enable Row Level Security
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access policies - only accessible via security definer functions
-- This prevents attackers from querying or manipulating the table

-- Function to record a login attempt (callable from client)
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, success)
  VALUES (LOWER(TRIM(p_email)), p_ip_address, p_success);
  
  -- Clean up old attempts (older than 24 hours) to prevent table bloat
  DELETE FROM public.login_attempts
  WHERE attempted_at < now() - INTERVAL '24 hours';
END;
$$;

-- Function to check if login is allowed (rate limit check)
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_email TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_lockout_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
  is_locked BOOLEAN,
  failed_attempts INTEGER,
  lockout_until TIMESTAMP WITH TIME ZONE,
  seconds_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count INTEGER;
  v_last_attempt TIMESTAMP WITH TIME ZONE;
  v_lockout_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count failed attempts in the lockout window
  SELECT 
    COUNT(*),
    MAX(attempted_at)
  INTO v_failed_count, v_last_attempt
  FROM public.login_attempts
  WHERE email = LOWER(TRIM(p_email))
    AND success = false
    AND attempted_at > now() - (p_lockout_minutes || ' minutes')::INTERVAL;
  
  -- Reset count if there was a successful login after the failures
  IF EXISTS (
    SELECT 1 FROM public.login_attempts
    WHERE email = LOWER(TRIM(p_email))
      AND success = true
      AND attempted_at > COALESCE(v_last_attempt, now() - INTERVAL '1 day')
  ) THEN
    v_failed_count := 0;
  END IF;
  
  -- Calculate lockout end time
  v_lockout_end := v_last_attempt + (p_lockout_minutes || ' minutes')::INTERVAL;
  
  RETURN QUERY SELECT
    v_failed_count >= p_max_attempts AS is_locked,
    v_failed_count AS failed_attempts,
    CASE WHEN v_failed_count >= p_max_attempts THEN v_lockout_end ELSE NULL END AS lockout_until,
    CASE WHEN v_failed_count >= p_max_attempts 
      THEN GREATEST(0, EXTRACT(EPOCH FROM (v_lockout_end - now()))::INTEGER)
      ELSE 0 
    END AS seconds_remaining;
END;
$$;

-- Grant execute permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.record_login_attempt TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit TO anon, authenticated;