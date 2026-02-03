-- Session 2.3: Org Access Helper Functions
-- Creates get_user_org_ids() and user_has_org_access(UUID)
-- Both are caller-bound (use auth.uid()) with defense-in-depth privileges
-- Using LANGUAGE SQL for simplicity per v1.0.23 plan

-- =============================================================================
-- 1. Create Function: get_user_org_ids()
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    ARRAY_AGG(crm_organization_id ORDER BY synced_at ASC),
    ARRAY[]::UUID[]
  )
  FROM public.user_org_grants_mirror
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

COMMENT ON FUNCTION public.get_user_org_ids() IS 
  'Returns array of all active organization IDs for the current user. Caller-bound (uses auth.uid()).';

-- Function privilege hardening (defense-in-depth)
REVOKE ALL ON FUNCTION public.get_user_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO service_role;

-- =============================================================================
-- 2. Create Function: user_has_org_access(UUID)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_has_org_access(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_org_grants_mirror
    WHERE user_id = auth.uid()
      AND crm_organization_id = p_org_id
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.user_has_org_access(UUID) IS 
  'Returns TRUE if current user has active access to the specified organization. Caller-bound (uses auth.uid()).';

-- Function privilege hardening (defense-in-depth)
REVOKE ALL ON FUNCTION public.user_has_org_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_org_access(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_org_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_access(UUID) TO service_role;