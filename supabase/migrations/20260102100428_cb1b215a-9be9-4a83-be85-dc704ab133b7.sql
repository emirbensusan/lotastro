-- Add events array column to webhook_subscriptions for multi-event support
ALTER TABLE public.webhook_subscriptions 
ADD COLUMN IF NOT EXISTS events text[] DEFAULT ARRAY['order.created']::text[];

-- Migrate existing event_type values to events array
UPDATE public.webhook_subscriptions 
SET events = ARRAY[event_type] 
WHERE events IS NULL OR events = ARRAY['order.created']::text[];

-- Add index for efficient event lookup
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_events 
ON public.webhook_subscriptions USING GIN(events);

-- Add retry columns to webhook_deliveries if not exists
ALTER TABLE public.webhook_deliveries
ADD COLUMN IF NOT EXISTS success boolean DEFAULT false;

-- Add event column to webhook_deliveries if different from event_type
ALTER TABLE public.webhook_deliveries 
ADD COLUMN IF NOT EXISTS event text;

-- Migrate event_type to event column
UPDATE public.webhook_deliveries 
SET event = event_type 
WHERE event IS NULL;

-- Add status_code column if not exists (alias for response_status)
ALTER TABLE public.webhook_deliveries
ADD COLUMN IF NOT EXISTS status_code integer;

-- Migrate response_status to status_code
UPDATE public.webhook_deliveries 
SET status_code = response_status 
WHERE status_code IS NULL AND response_status IS NOT NULL;

-- Ensure next_retry_at has proper index for retry processor
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry 
ON public.webhook_deliveries(subscription_id, success, retry_count, next_retry_at) 
WHERE success = false;

-- Add max_retries default if not exists
ALTER TABLE public.webhook_subscriptions 
ALTER COLUMN max_retries SET DEFAULT 5;