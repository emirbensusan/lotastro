-- PHASE 2: Simple Features Database Setup

-- 2.1 IP Whitelisting for Admins
CREATE TABLE public.admin_ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ip_address)
);

ALTER TABLE public.admin_ip_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage IP whitelist"
ON public.admin_ip_whitelist
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Function to check if IP is whitelisted (for edge functions)
CREATE OR REPLACE FUNCTION public.is_ip_whitelisted(check_ip text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_ip_whitelist
    WHERE ip_address = check_ip AND is_active = true
  ) OR NOT EXISTS (
    SELECT 1 FROM public.admin_ip_whitelist WHERE is_active = true
  );
$$;

-- 2.2 Order Sharing Feature
CREATE TABLE public.order_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(order_id, shared_with_user_id)
);

ALTER TABLE public.order_shares ENABLE ROW LEVEL SECURITY;

-- Users can see shares where they are the recipient or creator
CREATE POLICY "Users can view their shares"
ON public.order_shares
FOR SELECT
USING (
  shared_with_user_id = auth.uid() OR 
  shared_by_user_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::user_role)
);

-- Only accounting, senior_manager, admin can create shares
CREATE POLICY "Authorized roles can create shares"
ON public.order_shares
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role) OR 
  has_role(auth.uid(), 'senior_manager'::user_role) OR 
  has_role(auth.uid(), 'admin'::user_role)
);

-- Only share creator or admin can delete
CREATE POLICY "Share creator or admin can delete"
ON public.order_shares
FOR DELETE
USING (
  shared_by_user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::user_role)
);

-- Update orders SELECT policy to include shared access
DROP POLICY IF EXISTS "All authenticated users can view orders" ON public.orders;

CREATE POLICY "Users can view orders based on role or share"
ON public.orders
FOR SELECT
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR 
  has_role(auth.uid(), 'senior_manager'::user_role) OR 
  has_role(auth.uid(), 'admin'::user_role) OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.order_shares os
    WHERE os.order_id = orders.id 
    AND os.shared_with_user_id = auth.uid()
    AND (os.expires_at IS NULL OR os.expires_at > now())
  )
);

-- 2.3 Audit Log Retention - Add setting
INSERT INTO public.email_settings (setting_key, setting_value, description)
VALUES (
  'audit_log_retention_days',
  '365',
  'Number of days to retain audit logs before automatic cleanup'
)
ON CONFLICT (setting_key) DO NOTHING;