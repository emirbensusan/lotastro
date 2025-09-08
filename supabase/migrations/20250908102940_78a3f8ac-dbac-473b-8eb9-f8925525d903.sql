-- Phase 1 - Critical Fixes (Items 1 and 2)
-- 1) Restrict role_permissions SELECT to admins only
-- Drop overly permissive policy allowing all authenticated users to view role_permissions
DROP POLICY IF EXISTS "All authenticated users can view role_permissions" ON public.role_permissions;

-- Note: Admins already have full access via existing policy "Admins can manage role_permissions" (ALL)
-- If that policy is ever changed, consider adding an explicit SELECT policy for admins.

-- 2) Enforce profile update restrictions to prevent privilege escalation
-- Create a trigger that blocks non-admins from changing sensitive columns and role
CREATE OR REPLACE FUNCTION public.enforce_profile_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Admins can update freely
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- For non-admins (self-updates permitted by RLS), only allow changing full_name (and updated_at)
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not allowed to change email';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to change user_id';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to change id';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Not allowed to change created_at';
  END IF;

  -- Allow changes to full_name and updated_at only
  RETURN NEW;
END;
$function$;

-- Attach/refresh the trigger on profiles
DROP TRIGGER IF EXISTS enforce_profile_update_rules_tg ON public.profiles;
CREATE TRIGGER enforce_profile_update_rules_tg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_update_rules();