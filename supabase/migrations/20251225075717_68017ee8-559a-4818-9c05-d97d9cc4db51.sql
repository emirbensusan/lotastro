-- API Keys table for service-to-service authentication
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  key_hash TEXT NOT NULL, -- SHA256 hash of the full key
  service TEXT NOT NULL, -- 'crm', 'portal', 'ops_console', 'external'
  permissions JSONB DEFAULT '[]'::jsonb,
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "Admins can manage API keys"
ON public.api_keys
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Webhook subscriptions table
CREATE TABLE public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'order.created', 'inventory.low_stock', 'reservation.created', etc.
  endpoint_url TEXT NOT NULL,
  secret TEXT NOT NULL, -- For HMAC signing
  headers JSONB DEFAULT '{}'::jsonb, -- Custom headers to send
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- Enable RLS
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage webhooks
CREATE POLICY "Admins can manage webhook subscriptions"
ON public.webhook_subscriptions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Webhook delivery log
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook deliveries
CREATE POLICY "Admins can view webhook deliveries"
ON public.webhook_deliveries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create indexes for performance
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_service ON public.api_keys(service);
CREATE INDEX idx_webhook_subscriptions_event_type ON public.webhook_subscriptions(event_type);
CREATE INDEX idx_webhook_subscriptions_is_active ON public.webhook_subscriptions(is_active);
CREATE INDEX idx_webhook_deliveries_subscription_id ON public.webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_delivered_at ON public.webhook_deliveries(delivered_at);

-- Trigger to update updated_at on webhook_subscriptions
CREATE TRIGGER update_webhook_subscriptions_updated_at
BEFORE UPDATE ON public.webhook_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();