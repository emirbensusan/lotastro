-- Create webhook dead letters table for failed deliveries after max retries
CREATE TABLE public.webhook_dead_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.webhook_subscriptions(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_dead_letters ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage dead letters
CREATE POLICY "Admins can view dead letters"
  ON public.webhook_dead_letters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete dead letters"
  ON public.webhook_dead_letters
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Index for querying by event and subscription
CREATE INDEX idx_webhook_dead_letters_subscription ON public.webhook_dead_letters(subscription_id);
CREATE INDEX idx_webhook_dead_letters_event ON public.webhook_dead_letters(event);
CREATE INDEX idx_webhook_dead_letters_created_at ON public.webhook_dead_letters(created_at);

-- Add retry_count to webhook_deliveries if not exists
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS is_dead_lettered BOOLEAN DEFAULT false;