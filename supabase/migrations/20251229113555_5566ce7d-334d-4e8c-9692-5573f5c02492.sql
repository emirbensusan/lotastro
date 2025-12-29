-- Create function to increment webhook failure count
CREATE OR REPLACE FUNCTION public.increment_webhook_failure(p_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.webhook_subscriptions
  SET 
    failure_count = COALESCE(failure_count, 0) + 1,
    updated_at = now()
  WHERE id = p_subscription_id;
END;
$$;