-- Fix handle_new_user trigger to properly handle missing invitation
-- The issue: when inviteUserByEmail creates a user, the trigger fires BEFORE
-- the invitation record exists, causing v_role to be NULL

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_invitation_role user_role;
BEGIN
  -- Default role
  v_role := 'warehouse_staff'::user_role;
  
  -- Check for role in user metadata first (set by inviteUserByEmail)
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    BEGIN
      v_role := (NEW.raw_user_meta_data->>'role')::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'warehouse_staff'::user_role;
    END;
  END IF;
  
  -- Also check if an admin-created invitation exists and is still valid
  SELECT ui.role INTO v_invitation_role
  FROM public.user_invitations ui
  WHERE LOWER(ui.email) = LOWER(NEW.email)
    AND ui.status = 'pending'
    AND ui.expires_at > now()
  ORDER BY ui.invited_at DESC
  LIMIT 1;
  
  -- Prefer invitation role if found
  IF v_invitation_role IS NOT NULL THEN
    v_role := v_invitation_role;
  END IF;

  -- Create profile with the determined role
  INSERT INTO public.profiles (user_id, email, full_name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    true
  );

  -- Ensure user_roles has a record
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invitation accepted if any
  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE LOWER(email) = LOWER(NEW.email)
    AND status = 'pending';

  RETURN NEW;
END;
$$;