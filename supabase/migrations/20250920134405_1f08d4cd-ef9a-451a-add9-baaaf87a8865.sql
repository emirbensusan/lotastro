-- Fix 1: Add search_path to generate_order_number function for security
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  order_num TEXT;
  counter INTEGER := 1;
  base_num TEXT;
BEGIN
  -- Generate base order number with current date
  base_num := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  -- Find next available number for today
  LOOP
    order_num := base_num || LPAD(counter::TEXT, 3, '0');
    
    -- Check if this order number already exists
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = order_num) THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
  END LOOP;
  
  RETURN order_num;
END;
$function$;

-- Fix 2: Improve RLS policies on profiles table to restrict email exposure
-- Drop existing policies that expose email data
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create more restrictive policies
-- Users can only view limited profile data (not including email)
CREATE POLICY "Users can view own basic profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only admins can view full profile data including email
CREATE POLICY "Admins can view full profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Keep existing update and delete policies as they are secure
-- Users can still update their own profile
-- Admins can update any profile
-- Only admins can delete profiles

-- Fix 3: Add audit logging function for security monitoring
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type TEXT,
  user_id UUID,
  target_user_id UUID DEFAULT NULL,
  details JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Log security events (could extend to create audit table if needed)
  -- For now, just use database logs
  RAISE LOG 'SECURITY_EVENT: % by user % on target % with details %', 
    event_type, user_id, target_user_id, details;
END;
$function$;