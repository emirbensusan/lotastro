-- Session 2.2 Remediation: Function Privilege Hardening
-- Fixes critical issue: anon could execute SECURITY DEFINER functions
-- Fixes alignment: schema-qualifies trigger function and admin policy

-- =============================================================================
-- 1. CRITICAL FIX: Revoke EXECUTE from anon on both functions
-- =============================================================================

-- get_active_org_id(): Revoke from PUBLIC and anon explicitly
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO service_role;

-- set_active_org_id(UUID): Revoke from PUBLIC and anon explicitly
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO service_role;

-- =============================================================================
-- 2. ALIGNMENT FIX: Trigger with schema-qualified function
-- =============================================================================
DROP TRIGGER IF EXISTS update_user_active_org_preferences_updated_at
  ON public.user_active_org_preferences;

CREATE TRIGGER update_user_active_org_preferences_updated_at
  BEFORE UPDATE ON public.user_active_org_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 3. ALIGNMENT FIX: Admin policy with fully schema-qualified references
-- =============================================================================
DROP POLICY IF EXISTS admins_view_all_active_org_prefs
  ON public.user_active_org_preferences;

CREATE POLICY "admins_view_all_active_org_prefs"
  ON public.user_active_org_preferences
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.user_role));