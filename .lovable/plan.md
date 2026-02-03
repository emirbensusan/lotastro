

# Session 2.4: UI Policy Function — Implementation Plan (Verified + Aligned)

## Status: READY FOR IMPLEMENTATION
## Batch: 2 (Multi-Org Identity)
## Prerequisites: Session 2.1 ✅ Session 2.2 ✅ (Remediated) Session 2.3 ✅

---

## Pre-Implementation Verification ✅

| Risk | Finding | Resolution |
|------|---------|------------|
| **Risk A: has_role() signature** | Signature is `has_role(user_id uuid, required_role user_role)` - takes **enum** | ✅ Enum cast `'warehouse_staff'::public.user_role` is **CORRECT** |
| **Risk B: is_active column** | Column exists as `is_active BOOLEAN NOT NULL DEFAULT true` | ✅ Default true means test inserts work |
| **Warehouse roles** | Only `warehouse_staff` exists in `user_role` enum currently | ✅ Plan is correct, added extensibility note |

---

## Alignment Corrections Applied

| Issue | Previous State | Corrected State |
|-------|----------------|-----------------|
| **show_org_labels expression** | Simplified to `v_can_toggle_all_orgs` | ✅ Restored to `v_can_toggle_all_orgs AND NOT v_is_warehouse_role` per locked plan |
| **Role Taxonomy wording** | "profiles.role (via has_role())" | ✅ Changed to "stored separately (e.g., public.user_roles); has_role() is accessor" |
| **Privilege hardening** | Extra anon revoke + service_role grant | ✅ Kept for defense-in-depth consistency with Sessions 2.2/2.3 |

---

## Session Objective

Create the `user_wms_ui_policy()` function that determines org-related UI visibility for the current user:
- Whether to show the "All Orgs" toggle
- Whether to show org labels/badges/columns in All Orgs scope
- Default scope (always 'active')

**Critical Rule:** UI gating is based on **role taxonomy**, not org grant count.

---

## Role Taxonomy

| Source | Storage | Roles | Purpose |
|--------|---------|-------|---------|
| **CRM roles** | `user_org_grants_mirror.role_in_org` | `sales_owner`, `sales_manager`, `pricing`, `accounting`, `admin` | Toggle eligibility |
| **WMS operational roles** | Stored separately (e.g., `public.user_roles`); `has_role()` is the accessor | `warehouse_staff`, `accounting`, `admin`, `senior_manager` | UI minimization override |

---

## Function Implementation

```sql
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
  -- even if future logic changes toggle behavior
  RETURN jsonb_build_object(
    'show_org_toggle', v_can_toggle_all_orgs,
    'show_org_labels_in_all_scope', v_can_toggle_all_orgs AND NOT v_is_warehouse_role,
    'default_scope', 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.user_wms_ui_policy() IS 
  'Returns UI visibility policy for org-related elements. Caller-bound (uses auth.uid()). Based on role taxonomy, not org count.';
```

---

## Function Privilege Hardening

**Defense-in-depth pattern (consistent with Sessions 2.2 and 2.3):**

```sql
-- Revoke from PUBLIC and anon explicitly (belt and suspenders)
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM anon;

-- Grant only to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO service_role;
```

**Note:** This pattern (explicit anon revoke + service_role grant) is applied consistently across all caller-bound functions in Batch 2:
- Session 2.2: `get_active_org_id()`, `set_active_org_id(UUID)` ✅
- Session 2.3: `get_user_org_ids()`, `user_has_org_access(UUID)` ✅
- Session 2.4: `user_wms_ui_policy()` ✅

---

## Return Value Schema

```typescript
interface WmsUiPolicy {
  show_org_toggle: boolean;              // Show Active/All toggle in UI
  show_org_labels_in_all_scope: boolean; // Show org column/badge when All scope
  default_scope: 'active';               // Always 'active' (per contract)
  error?: 'unauthenticated';             // Only present if auth.uid() is NULL
}
```

---

## Policy Logic Truth Table

| WMS Role | CRM Role(s) | show_org_toggle | show_org_labels_in_all_scope |
|----------|-------------|-----------------|------------------------------|
| `warehouse_staff` | Any | `false` | `false` |
| (other) | `sales_owner` only | `false` | `false` |
| (other) | Has `sales_manager` | `true` | `true` |
| (other) | Has `accounting` | `true` | `true` |
| (other) | Has `pricing` | `true` | `true` |
| (other) | Has `admin` | `true` | `true` |
| (unauthenticated) | N/A | `false` | `false` (+ error) |

---

## Files Created/Modified

| File | Type | Description |
|------|------|-------------|
| `supabase/migrations/YYYYMMDD_session_2_4_ui_policy_function.sql` | CREATE | Migration file |
| `.lovable/plan.md` | UPDATE | Session 2.4 status |

---

## Complete Migration SQL

```sql
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
```

---

## Post-Implementation Verification

### Test 1: Function Exists with Correct Signature
```sql
SELECT proname, prorettype::regtype, prosecdef, provolatile
FROM pg_proc 
WHERE proname = 'user_wms_ui_policy'
  AND pronamespace = 'public'::regnamespace;
-- Expected: user_wms_ui_policy, jsonb, true, s
```

### Test 2: Function Privilege Verification (Critical)
```sql
SELECT 
  has_function_privilege('anon', 'public.user_wms_ui_policy()', 'EXECUTE') AS anon_can_exec,
  has_function_privilege('authenticated', 'public.user_wms_ui_policy()', 'EXECUTE') AS auth_can_exec;
-- Expected: false, true
```

---

## Security Hardening Summary

| Layer | Implementation |
|-------|----------------|
| Function: PUBLIC | REVOKE ALL |
| Function: anon | REVOKE ALL (explicit, consistent with 2.2/2.3) |
| Function: authenticated | GRANT EXECUTE |
| Function: service_role | GRANT EXECUTE (consistent with 2.2/2.3) |
| Caller-bound | Uses `auth.uid()` internally — no user_id parameter |
| Schema-qualified | Uses `public.has_role()` and `public.user_role` |
| Defensive return | Unauthenticated → error JSON with all toggles false |

---

## Future Extensibility Note

If additional warehouse-type roles are added to the `user_role` enum (e.g., `warehouse_picker`, `warehouse_packer`), update the warehouse check:

```sql
v_is_warehouse_role := public.has_role(v_user_id, 'warehouse_staff'::public.user_role)
  OR public.has_role(v_user_id, 'warehouse_picker'::public.user_role)
  OR public.has_role(v_user_id, 'warehouse_packer'::public.user_role);
```

Or create a helper function `public.is_warehouse_user(user_id)` for cleaner code.

---

## Estimated Duration

**Implementation:** 10 minutes  
**Testing:** 10 minutes  
**Total:** ~20 minutes

