-- Session 2.4: UI Policy Function
-- Creates user_wms_ui_policy() for org-related UI visibility
-- Caller-bound (uses auth.uid()), defense-in-depth privileges

-- =============================================================================
-- 1. Create Function: user_wms_ui_policy()
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_wms_ui_policy()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_is_warehouse_role BOOLEAN;
  v_can_toggle_all_orgs BOOLEAN;
BEGIN
  -- Caller-bound: use authenticated user, not parameter
  v_user_id := auth.uid();
  
  -- Guard: unauthenticated caller
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'show_org_toggle', false,
      'show_org_labels_in_all_scope', false,
      'default_scope', 'active',
      'error', 'unauthenticated'
    );
  END IF;
  
  -- WMS operational role override: warehouse users do NOT get org toggle/labels
  -- Uses enum cast since has_role() signature is (uuid, user_role)
  v_is_warehouse_role := public.has_role(v_user_id, 'warehouse_staff'::public.user_role);
  -- NOTE: If future warehouse roles are added (picker, packer, etc.), 
  -- extend with: OR public.has_role(v_user_id, 'warehouse_picker'::public.user_role)

  IF v_is_warehouse_role THEN
    -- Warehouse role: minimize UI regardless of CRM grants
    v_can_toggle_all_orgs := false;
  ELSE
    -- Contract-defined CRM taxonomy gating (NOT org-count):
    -- Allowed: sales_manager, accounting, pricing, admin
    -- Disallowed: sales_owner (even with multi-org grants)
    v_can_toggle_all_orgs := EXISTS (
      SELECT 1
      FROM public.user_org_grants_mirror g
      WHERE g.user_id = v_user_id
        AND g.is_active = true
        AND g.role_in_org IN ('sales_manager', 'accounting', 'pricing', 'admin')
    );
  END IF;

  -- LOCKED: Explicit AND NOT v_is_warehouse_role per WMS plan
  -- Ensures labels/badges/columns are hidden for warehouse roles
  RETURN jsonb_build_object(
    'show_org_toggle', v_can_toggle_all_orgs,
    'show_org_labels_in_all_scope', v_can_toggle_all_orgs AND NOT v_is_warehouse_role,
    'default_scope', 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.user_wms_ui_policy() IS 
  'Returns UI visibility policy for org-related elements. Caller-bound (uses auth.uid()). Based on role taxonomy, not org count.';

-- =============================================================================
-- 2. Function Privilege Hardening (Defense-in-Depth, consistent with 2.2/2.3)
-- =============================================================================
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO service_role;