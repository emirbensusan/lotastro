-- 1) Restrict public access to user_invitations
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.user_invitations;

CREATE POLICY "Users can view own invitation or admins can view all"
ON public.user_invitations FOR SELECT
USING (
  (auth.jwt()->>'email') = email OR public.has_role(auth.uid(), 'admin')
);

-- 2) Create user_roles table (using existing user_role enum)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NULL REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- 3) Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, p.role
FROM public.profiles p
WHERE p.role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Update has_role() to use user_roles WITHOUT changing signature
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, required_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = has_role.user_id
      AND ur.role = has_role.required_role
  );
$$;

-- 5) Harden handle_new_user(): derive role server-side (from invitation or default)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role := 'warehouse_staff';
BEGIN
  -- If an admin-created invitation exists and is still valid, use that role
  SELECT ui.role INTO v_role
  FROM public.user_invitations ui
  WHERE ui.email = NEW.email
    AND ui.status = 'pending'
    AND ui.expires_at > now()
  ORDER BY ui.invited_at DESC
  LIMIT 1;

  -- Create profile (keep role column in sync for UI compatibility)
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role
  );

  -- Ensure user_roles has a record
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invitation accepted if any
  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE email = NEW.email
    AND status = 'pending';

  RETURN NEW;
END;
$$;

-- 6) Harden enforce_profile_update_rules(): check admin via user_roles
CREATE OR REPLACE FUNCTION public.enforce_profile_update_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can update freely
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- For non-admins, prevent changing sensitive fields
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

  RETURN NEW;
END;
$$;