-- Session 2.2 Final Patch: Schema-qualify admin policy
DROP POLICY IF EXISTS admins_view_all_active_org_prefs
  ON public.user_active_org_preferences;

CREATE POLICY admins_view_all_active_org_prefs
  ON public.user_active_org_preferences
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.user_role));