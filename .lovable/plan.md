

# Session 2.2 Remediation Plan: Function Privilege Hardening

## Issue Summary

| # | Issue | Severity | Current State | Required State |
|---|-------|----------|---------------|----------------|
| 1 | anon can EXECUTE both functions | 🚨 **CRITICAL** | `has_function_privilege('anon', ...) = true` | `false` |
| 2 | Trigger function may not be schema-qualified | ⚠️ Alignment | Possibly `update_updated_at_column()` | `public.update_updated_at_column()` |
| 3 | Admin policy may use unqualified references | ⚠️ Alignment | Possibly `has_role(..., 'admin'::user_role)` | `public.has_role(..., 'admin'::public.user_role)` |

---

## Root Cause Analysis

The migration file shows correct REVOKE/GRANT statements (lines 126-128 and 184-186), but the `anon` role still has EXECUTE privileges. This can happen because:

1. **PostgreSQL default behavior**: When a function is created, by default `PUBLIC` (which includes `anon`) gets EXECUTE privilege
2. **Race condition**: If another migration or Supabase's internal processes re-granted privileges
3. **REVOKE FROM PUBLIC timing**: The REVOKE may not have fully propagated before the explicit GRANTs

**Solution**: Create a remediation migration that:
- Drops and recreates the functions with explicit `REVOKE ALL` as the first privilege statement
- Uses explicit `REVOKE ALL FROM anon` in addition to `REVOKE ALL FROM PUBLIC`
- Re-applies trigger and policy with fully schema-qualified references

---

## Remediation Migration

### 1. Fix Function Privileges (CRITICAL)

```sql
-- =============================================================================
-- CRITICAL FIX: Revoke EXECUTE from anon on both functions
-- =============================================================================

-- First, explicitly revoke from anon (belt and suspenders with PUBLIC)
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO service_role;

REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO service_role;
```

### 2. Fix Trigger (Alignment)

```sql
-- =============================================================================
-- ALIGNMENT FIX: Ensure trigger uses schema-qualified function
-- =============================================================================
DROP TRIGGER IF EXISTS update_user_active_org_preferences_updated_at
  ON public.user_active_org_preferences;

CREATE TRIGGER update_user_active_org_preferences_updated_at
  BEFORE UPDATE ON public.user_active_org_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### 3. Fix Admin Policy (Alignment)

```sql
-- =============================================================================
-- ALIGNMENT FIX: Ensure policy uses fully schema-qualified references
-- =============================================================================
DROP POLICY IF EXISTS admins_view_all_active_org_prefs
  ON public.user_active_org_preferences;

CREATE POLICY "admins_view_all_active_org_prefs"
  ON public.user_active_org_preferences
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.user_role));
```

---

## Complete Remediation Migration

```sql
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
```

---

## Verification Queries (Post-Remediation)

### Critical: Anon Cannot Execute Functions
```sql
SELECT 
  has_function_privilege('anon', 'public.get_active_org_id()', 'EXECUTE') AS anon_get,
  has_function_privilege('anon', 'public.set_active_org_id(UUID)', 'EXECUTE') AS anon_set;
-- Expected: false, false
```

### Authenticated Can Execute Functions
```sql
SELECT 
  has_function_privilege('authenticated', 'public.get_active_org_id()', 'EXECUTE') AS auth_get,
  has_function_privilege('authenticated', 'public.set_active_org_id(UUID)', 'EXECUTE') AS auth_set;
-- Expected: true, true
```

### Trigger Exists with Correct Function
```sql
SELECT 
  tgname,
  pg_get_triggerdef(oid) AS trigger_def
FROM pg_trigger
WHERE tgname = 'update_user_active_org_preferences_updated_at';
-- Expected: EXECUTE FUNCTION public.update_updated_at_column()
```

### Policy Uses Qualified References
```sql
SELECT 
  polname,
  pg_get_expr(polqual, polrelid) AS policy_qual
FROM pg_policy
WHERE polname = 'admins_view_all_active_org_prefs';
-- Expected: Contains public.has_role and public.user_role
```

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/YYYYMMDD_session_2_2_remediation.sql` | CREATE | Remediation migration |
| `.lovable/plan.md` | UPDATE | Note remediation applied |

---

## Plan Update

After remediation, `.lovable/plan.md` Session 2.2 entry should note:
```
### Session 2.2: Active Org Preferences ✅ COMPLETE (Remediated)
- [x] Create `user_active_org_preferences` table
- [x] Create `get_active_org_id()` function with fallback logic
- [x] Create `set_active_org_id(UUID)` function with access validation
- [x] Function privilege hardening (REMEDIATED: explicit anon revoke)
- [x] Schema-qualified references (REMEDIATED: trigger + policy)
```

---

## Estimated Duration

**Implementation:** 5 minutes  
**Verification:** 5 minutes  
**Total:** ~10 minutes

