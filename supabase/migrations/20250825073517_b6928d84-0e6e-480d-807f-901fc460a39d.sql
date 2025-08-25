-- Fix security issues by setting search_path for functions

-- Update has_role function with proper search_path
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = has_role.user_id
    AND profiles.role = required_role
  )
$$;

-- Update get_user_role function with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE profiles.user_id = get_user_role.user_id
$$;

-- Update update_updated_at_column function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;