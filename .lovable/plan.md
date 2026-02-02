

# Plan: Security Fixes, Naming Alignment & Hardening for WMS Implementation Plan v1.0.23

## Overview

This plan applies all required security and naming fixes to `docs/WMS_IMPLEMENTATION_PLAN_v1_0_23.md`, plus hygiene improvements for production robustness, including explicit REVOKE from PUBLIC for defense-in-depth.

---

## Part 1: Security & Alignment Fixes (BLOCKERS)

### 1.1 BLOCKER: Remove `p_user_id` from SECURITY DEFINER Functions

All SECURITY DEFINER functions must use `auth.uid()` internally instead of accepting user ID parameters.

**Functions to update:**
- `user_wms_ui_policy()` — remove parameter, use `auth.uid()` 
- `user_has_org_access(p_org_id)` — keep org param only, use `auth.uid()` for user
- `get_user_org_ids()` — remove parameter, use `auth.uid()`
- `get_active_org_id()` — no parameter, use `auth.uid()`
- `set_active_org_id(p_org_id)` — keep org param only, use `auth.uid()` for user

### 1.2 BLOCKER: Add Active Org Persistence

Add to Batch 2:
- Table: `user_active_org_preferences`
- Function: `get_active_org_id()` (caller-bound)
- Function: `set_active_org_id(p_org_id)` (caller-bound)

### 1.3 Naming Alignment (Option B)

Add DR-6 terminology section clarifying:
- CRM source: `user_org_roles`
- WMS mirror: `user_org_grants_mirror`
- WMS code never references CRM table name

---

## Part 2: Hygiene Improvements (Non-blocking, Production Safety)

### 2.1 Handle Unauthenticated Callers Consistently

**Issue:** `get_active_org_id()` returns NULL for unauthenticated users. UI must not interpret `activeOrgId = null` as "show all orgs" when in Active scope.

**Fix:** Update UI snippet to handle null activeOrgId defensively — block queries until org is resolved.

### 2.2 Handle `set_active_org_id()` Failure in UI

**Issue:** Current snippet doesn't check the boolean return value.

**Fix:** Add error handling with toast feedback.

### 2.3 Explicit REVOKE FROM PUBLIC + GRANT TO authenticated (Defense-in-Depth)

**Issue:** In Postgres, PUBLIC may retain execute privileges depending on defaults. Even though we grant to authenticated, anonymous callers might still be able to execute functions if PUBLIC isn't explicitly revoked.

**Fix:** For all security-sensitive functions, apply:
```sql
REVOKE ALL ON FUNCTION <function> FROM PUBLIC;
GRANT EXECUTE ON FUNCTION <function> TO authenticated;
```

This ensures anonymous callers cannot execute the functions under any configuration.

### 2.4 Consistent Unauthenticated Test Expectations

**Issue:** SEC-01 tests that `user_wms_ui_policy()` returns error JSON for unauthenticated callers. But if REVOKE works correctly, anonymous callers get "permission denied" instead of the JSON response.

**Fix:** Clarify test expectation to handle both scenarios:
- **Expected:** Anonymous cannot execute (permission denied) OR function returns `error: 'unauthenticated'` if exec is somehow allowed
- **Pass criteria:** Either outcome is acceptable — the goal is no data leakage

---

## Part 3: Files to Modify

| File | Changes |
|------|---------|
| `docs/WMS_IMPLEMENTATION_PLAN_v1_0_23.md` | All patches below |

---

## Part 4: Exact Patches

### Patch 1: Add DR-6 Terminology Section

**Location:** After line 56 (after "Any deviation from contract schemas is a blocking defect.")

**Insert:**
```markdown

### DR-6: Table Naming Authority

**WMS canonical table name**: `user_org_grants_mirror`

This table mirrors CRM's `user_org_roles` table via the `org_access.updated` event. Throughout all WMS implementation artifacts (code, snippets, tests, QA steps), use **only** `user_org_grants_mirror`. The CRM table name exists only as documentation context and must not appear in WMS execution code.
```

---

### Patch 2: Replace Implementation Rule (lines 84-92)

**Replace with:**
```markdown
### Implementation Rule (use policy + persisted Active Org, caller-bound functions)
```typescript
// Complete pattern for org-scoped list pages
// All RPC calls are caller-bound (use auth.uid() internally) — NO p_user_id parameter

// 1. Get UI policy (caller-bound, uses auth.uid() internally)
const { data: uiPolicy } = await supabase.rpc('user_wms_ui_policy');

// 2. Get user's persisted Active Org preference (caller-bound)
const { data: activeOrgId } = await supabase.rpc('get_active_org_id');

// 3. Manage org scope state
const [orgScope, setOrgScope] = useState<'active' | 'all'>('active');

// 4. Determine visibility based on policy (NOT grant count)
const showOrgToggle = Boolean(uiPolicy?.show_org_toggle);
const showOrgColumn = Boolean(uiPolicy?.show_org_labels_in_all_scope) && orgScope === 'all';
const showOrgBadge = Boolean(uiPolicy?.show_org_labels_in_all_scope) && orgScope === 'all';

// 5. Compute org filter based on scope
// IMPORTANT: null activeOrgId in Active scope = block queries, not show everything
if (orgScope === 'active' && !activeOrgId) {
  // Force org selection before showing data
  return <OrgSelectionRequired onSelect={handleActiveOrgChange} />;
}
const orgFilter = orgScope === 'all' 
  ? undefined  // No filter = all accessible orgs (RLS enforces)
  : activeOrgId;  // Filter to persisted Active Org

// 6. Handle Active Org selection with error feedback
const handleActiveOrgChange = async (newOrgId: string) => {
  const { data: success, error } = await supabase.rpc('set_active_org_id', { p_org_id: newOrgId });
  
  if (error || success === false) {
    toast.error('Unable to switch organization. You may not have access.');
    return;  // Revert UI selection if needed
  }
  
  // Refetch activeOrgId after successful update
  refetchActiveOrg();
  toast.success('Organization switched');
};
```
```

---

### Patch 3: Replace `user_wms_ui_policy` Function (lines 863-898)

**Replace with:**
```sql
-- UI policy function: CALLER-BOUND (no p_user_id parameter)
-- Uses auth.uid() internally to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.user_wms_ui_policy()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_warehouse_role BOOLEAN;
  v_can_toggle_all_orgs BOOLEAN;
BEGIN
  -- Caller-bound: use authenticated user, not parameter
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'show_org_toggle', false,
      'show_org_labels_in_all_scope', false,
      'default_scope', 'active',
      'error', 'unauthenticated'
    );
  END IF;
  
  -- WMS operational role override: warehouse users do NOT get org toggle/labels
  v_is_warehouse_role := public.has_role(v_user_id, 'warehouse_staff'::user_role);

  IF v_is_warehouse_role THEN
    v_can_toggle_all_orgs := false;
  ELSE
    -- Contract-defined CRM taxonomy gating (NOT org-count):
    -- Allowed: sales_manager, accounting, pricing, admin
    -- Disallowed: sales_owner
    v_can_toggle_all_orgs := EXISTS (
      SELECT 1
      FROM public.user_org_grants_mirror g
      WHERE g.user_id = v_user_id
        AND g.is_active = true
        AND g.role_in_org IN ('sales_manager', 'accounting', 'pricing', 'admin')
    );
  END IF;

  RETURN jsonb_build_object(
    'show_org_toggle', v_can_toggle_all_orgs,
    'show_org_labels_in_all_scope', v_can_toggle_all_orgs AND NOT v_is_warehouse_role,
    'default_scope', 'active'
  );
END;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO authenticated;
```

---

### Patch 4: Replace Helper Functions (lines 827-858)

**Replace with:**
```sql
-- Check if CURRENT USER has access to specific org (caller-bound)
CREATE OR REPLACE FUNCTION user_has_org_access(p_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = auth.uid() 
      AND crm_organization_id = p_org_id 
      AND is_active = true
  );
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION user_has_org_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_has_org_access(UUID) TO authenticated;

-- Get all org IDs CURRENT USER has access to (caller-bound)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT COALESCE(
    array_agg(crm_organization_id),
    ARRAY[]::UUID[]
  )
  FROM user_org_grants_mirror
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION get_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_org_ids() TO authenticated;
```

---

### Patch 5: Add `user_active_org_preferences` Table and Functions

**Insert after line 822** (after `CREATE INDEX idx_org_grants_seq...`):

```markdown

#### New Table: `user_active_org_preferences`

```sql
-- Active Org Preference (per Checklist: "Store an Active Org per user")
CREATE TABLE user_active_org_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_org_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_active_org ON user_active_org_preferences(active_org_id);

-- RLS: User can only see/update their own preference
ALTER TABLE user_active_org_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_org_preference"
  ON user_active_org_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

#### New Functions: Active Org Helpers (CALLER-BOUND)

```sql
-- Get active org for CURRENT USER with fallback to first available grant
-- Returns NULL for unauthenticated users (UI must handle this defensively)
CREATE OR REPLACE FUNCTION get_active_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_active_org UUID;
  v_first_grant UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;  -- UI must handle: don't treat NULL as "show all"
  END IF;
  
  -- Get stored preference
  SELECT active_org_id INTO v_active_org
  FROM user_active_org_preferences
  WHERE user_id = v_user_id;
  
  -- If no preference or stored org is no longer accessible, use first available grant
  IF v_active_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = v_active_org
      AND is_active = true
  ) THEN
    SELECT crm_organization_id INTO v_first_grant
    FROM user_org_grants_mirror
    WHERE user_id = v_user_id AND is_active = true
    ORDER BY synced_at ASC
    LIMIT 1;
    
    v_active_org := v_first_grant;
  END IF;
  
  RETURN v_active_org;
END;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION get_active_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_org_id() TO authenticated;

-- Set active org for CURRENT USER with validation
-- Returns false if user doesn't have access (UI should show toast/revert)
CREATE OR REPLACE FUNCTION set_active_org_id(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Validate CURRENT USER has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = p_org_id
      AND is_active = true
  ) THEN
    RETURN false;  -- UI should show error toast
  END IF;
  
  -- Upsert preference
  INSERT INTO user_active_org_preferences (user_id, active_org_id, updated_at)
  VALUES (v_user_id, p_org_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET active_org_id = p_org_id, updated_at = now();
  
  RETURN true;
END;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION set_active_org_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_active_org_id(UUID) TO authenticated;
```
```

---

### Patch 6: Add QA Test Cases

**Insert in Batch 2 QA section:**

```markdown
**Security & Preference Tests:**
- SEC-01: Anonymous caller cannot execute `user_wms_ui_policy()` (permission denied) OR function returns `error: 'unauthenticated'` if exec is allowed — either outcome is acceptable, goal is no data leakage
- SEC-02: `set_active_org_id(p_org_id)` cannot affect another user's preference (caller-bound via `auth.uid()`)
- SEC-03: All SECURITY DEFINER functions use `auth.uid()` internally, not parameters
- SEC-04: All security functions have `REVOKE ALL FROM PUBLIC` applied — verify with `SELECT has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')` returns false
- PREF-01: Active Org preference persists across sessions
- PREF-02: `get_active_org_id()` falls back to first grant if stored org is inaccessible
- PREF-03: `set_active_org_id(p_org_id)` returns false for orgs user doesn't have access to
- PREF-04: UI blocks data display when `activeOrgId = null` in Active scope (no data leakage)
- UX-01: UI shows toast when `set_active_org_id()` returns false
```

---

### Patch 7: Update QA Traceability Matrix

**Update line 147:**
```markdown
| 2 | #1, #2 | `org_access.updated` | RLS-01, RLS-02, RLS-03, F-01, D-01, PREF-01, PREF-02, PREF-03, PREF-04, SEC-01, SEC-02, SEC-03, SEC-04, UX-01 |
```

---

### Patch 8: Update Done Proof Table (Batch 2)

**Insert after line 978:**
```markdown
| Active Org table exists | `SELECT * FROM user_active_org_preferences LIMIT 1` succeeds |
| get_active_org_id() works | `SELECT get_active_org_id()` returns valid org UUID or NULL |
| set_active_org_id() works | `SELECT set_active_org_id('valid-org-uuid')` returns true |
| Invalid org rejected | `SELECT set_active_org_id('no-access-org-uuid')` returns false |
| Anon blocked from policy fn | `SELECT has_function_privilege('anon', 'user_wms_ui_policy()', 'EXECUTE')` returns false |
| Anon blocked from org fn | `SELECT has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')` returns false |
| EXECUTE grants applied | `SELECT has_function_privilege('authenticated', 'get_active_org_id()', 'EXECUTE')` returns true |
```

---

### Patch 9: Add Permission Grant Summary Block

**Insert after the function definitions in Batch 2 DB section:**

```markdown
#### Permission Grant Summary (Defense-in-Depth)

All security-sensitive functions follow the REVOKE-then-GRANT pattern to ensure anonymous callers cannot execute them under any Postgres configuration:

```sql
-- Applied to all caller-bound functions
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_org_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
```

**Verification query:**
```sql
-- Should return false for all functions
SELECT 
  'user_wms_ui_policy' as fn, 
  has_function_privilege('anon', 'user_wms_ui_policy()', 'EXECUTE') as anon_can_exec
UNION ALL
SELECT 'get_active_org_id', has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')
UNION ALL
SELECT 'set_active_org_id', has_function_privilege('anon', 'set_active_org_id(uuid)', 'EXECUTE')
UNION ALL
SELECT 'user_has_org_access', has_function_privilege('anon', 'user_has_org_access(uuid)', 'EXECUTE')
UNION ALL
SELECT 'get_user_org_ids', has_function_privilege('anon', 'get_user_org_ids()', 'EXECUTE');
```
```

---

## Part 5: Execution Readiness

### Decision: **GO** (after applying all 9 patches)

| Check | Status |
|-------|--------|
| SECURITY DEFINER with p_user_id | Fixed — all functions caller-bound |
| Active Org persistence | Fixed — table + functions added |
| Naming alignment (Option B) | Fixed — DR-6 added |
| Multi-org UI gating | Confirmed role-based |
| Null activeOrgId handling | Fixed — UI blocks queries |
| set_active_org_id error handling | Fixed — toast on failure |
| REVOKE FROM PUBLIC | Fixed — all functions revoked from PUBLIC |
| Explicit EXECUTE grants | Fixed — all functions granted to authenticated |
| Test expectation consistency | Fixed — SEC-01 handles both permission denied and error JSON |

### First 3 Batches

| Batch | Name | Acceptance Gates |
|-------|------|------------------|
| **0** | Contract Alignment & Guards | `integration_contract_violations` table exists; UOM/idempotency validation works |
| **1** | Integration Inbox | Webhook receiver logs events; duplicate detection returns 200; retry increments attempt_count |
| **2** | Multi-Org Identity | All tables exist; functions work without parameters; SEC/PREF tests pass; `has_function_privilege('anon', ...)` returns false for all security functions |

---

## Technical Notes

### Why REVOKE FROM PUBLIC Matters

```sql
-- Default Postgres behavior can surprise you:
-- Even if you only GRANT to authenticated, PUBLIC might still have execute

-- VULNERABLE (depending on database defaults):
CREATE FUNCTION my_func() ...;
GRANT EXECUTE ON FUNCTION my_func() TO authenticated;
-- PUBLIC might still be able to execute!

-- SECURE (explicit revoke-then-grant):
CREATE FUNCTION my_func() ...;
REVOKE ALL ON FUNCTION my_func() FROM PUBLIC;  -- Remove any inherited permissions
GRANT EXECUTE ON FUNCTION my_func() TO authenticated;
-- Now only authenticated can execute, guaranteed
```

### SEC-01 Test Clarification

The test for unauthenticated access should pass under either scenario:

1. **Permission denied** (expected if REVOKE works): Anonymous caller cannot execute the function at all
2. **Error JSON returned** (fallback if somehow executable): Function returns `{"error": "unauthenticated"}`

Both outcomes achieve the security goal: no data is leaked to unauthenticated callers.

