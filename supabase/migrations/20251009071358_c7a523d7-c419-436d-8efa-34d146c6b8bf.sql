-- 1) Add unique constraint to prevent duplicate permissions per role/category/action
DO $$ BEGIN
  ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_unique UNIQUE (role, permission_category, permission_action);
EXCEPTION WHEN duplicate_table THEN
  -- Constraint already exists
  NULL;
END $$;

-- 2) Add SELECT policy so users can read permissions for their own role (admins can read all)
DROP POLICY IF EXISTS "Users can view their role permissions" ON public.role_permissions;
CREATE POLICY "Users can view their role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  role = public.get_user_role(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::user_role)
);

-- 3) Seed/Upsert essential senior_manager permissions used by the UI
-- Note: relies on the unique constraint above for safe upsert
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed)
VALUES
  ('senior_manager', 'reports', 'accessdashboard', true),
  ('senior_manager', 'inventory', 'createlotentries', true),
  ('senior_manager', 'inventory', 'viewinventory', true),
  ('senior_manager', 'orders', 'vieworders', true),
  ('senior_manager', 'orders', 'createorders', true),
  ('senior_manager', 'qrdocuments', 'scanqrcodes', true),
  ('senior_manager', 'reports', 'viewreports', true),
  ('senior_manager', 'approvals', 'viewapprovals', true),
  ('senior_manager', 'suppliers', 'viewsuppliers', true)
ON CONFLICT (role, permission_category, permission_action)
DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();
