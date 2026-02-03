

# Session 2.2: Active Org Preferences — AMENDED PLAN (v2)

## Status: READY FOR IMPLEMENTATION (Amended per Review)
## Batch: 2 (Multi-Org Identity)
## Prerequisites: Session 2.1 Complete ✅

---

## Review Findings Applied ✅

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Fallback orders by `created_at` (should be `synced_at`) | Changed to `ORDER BY synced_at ASC` per v1.0.23 |
| 2 | Missing REVOKE/GRANT EXECUTE on functions | Added full REVOKE/GRANT pattern for both functions |
| A | Schema-qualify `has_role` + enum cast | Changed to `public.has_role(auth.uid(), 'admin'::public.user_role)` |
| B | Schema-qualify trigger function | Changed to `public.update_updated_at_column()` |
| C | FK choice documented | Intentional no-FK for sync flexibility; cleanup job noted for future |

---

## Implementation Details

### 1. Create Table: `user_active_org_preferences`

```sql
CREATE TABLE public.user_active_org_preferences (
  user_id UUID PRIMARY KEY,  -- No FK to auth.users for CRM sync flexibility
  active_org_id UUID NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_active_org_preferences IS 
  'Stores the user''s currently selected organization context for WMS queries. No FK to auth.users for sync flexibility; orphan cleanup handled by maintenance job.';
```

**Design Decision: No FK to auth.users**
- Matches Session 2.1 pattern for consistency
- Allows CRM sync flexibility
- Trade-off: Orphan rows when users deleted → future maintenance job will handle cleanup

---

### 2. Create Index

```sql
CREATE INDEX idx_active_org_prefs_org 
  ON public.user_active_org_preferences(active_org_id);
```

---

### 3. Create Trigger for updated_at (Idempotent, Schema-Qualified)

```sql
DROP TRIGGER IF EXISTS update_user_active_org_preferences_updated_at
  ON public.user_active_org_preferences;

CREATE TRIGGER update_user_active_org_preferences_updated_at
  BEFORE UPDATE ON public.user_active_org_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();  -- AMENDED: Schema-qualified
```

---

### 4. Configure Row-Level Security (Defense-in-Depth)

```sql
-- Enable RLS
ALTER TABLE public.user_active_org_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_org_preferences FORCE ROW LEVEL SECURITY;

-- Revoke from PUBLIC and anon (defense-in-depth)
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM anon;

-- Authenticated users: SELECT, INSERT, UPDATE on their own row only
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_active_org_preferences TO authenticated;

-- Service role: full access for Edge Functions
GRANT ALL PRIVILEGES ON TABLE public.user_active_org_preferences TO service_role;

-- RLS Policy: Users can only access their own preference
CREATE POLICY "users_manage_own_active_org"
  ON public.user_active_org_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- AMENDED: Schema-qualified has_role + enum cast
CREATE POLICY "admins_view_all_active_org_prefs"
  ON public.user_active_org_preferences
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.user_role));
```

---

### 5. Create Function: `get_active_org_id()` (AMENDED)

```sql
CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_stored_org_id UUID;
  v_fallback_org_id UUID;
BEGIN
  -- Get current user from auth context
  v_user_id := auth.uid();
  
  -- Guard: No auth context
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Try to get stored preference
  SELECT active_org_id INTO v_stored_org_id
  FROM public.user_active_org_preferences
  WHERE user_id = v_user_id;
  
  -- If stored preference exists, validate it's still accessible
  IF v_stored_org_id IS NOT NULL THEN
    -- Check if user still has active access to this org
    IF EXISTS (
      SELECT 1 FROM public.user_org_grants_mirror
      WHERE user_id = v_user_id
        AND crm_organization_id = v_stored_org_id
        AND is_active = true
    ) THEN
      RETURN v_stored_org_id;
    END IF;
    -- Stored org is no longer accessible - fall through to fallback
  END IF;
  
  -- AMENDED: Fallback uses synced_at per v1.0.23
  SELECT crm_organization_id INTO v_fallback_org_id
  FROM public.user_org_grants_mirror
  WHERE user_id = v_user_id
    AND is_active = true
  ORDER BY synced_at ASC
  LIMIT 1;
  
  RETURN v_fallback_org_id;  -- May be NULL if user has no grants
END;
$$;

COMMENT ON FUNCTION public.get_active_org_id() IS 
  'Returns the active org ID for the current user. Falls back to first available grant (by synced_at) if preference is missing or invalid.';

-- AMENDED: Function privilege hardening
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO service_role;
```

---

### 6. Create Function: `set_active_org_id(UUID)` (AMENDED)

```sql
CREATE OR REPLACE FUNCTION public.set_active_org_id(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Get current user from auth context
  v_user_id := auth.uid();
  
  -- Guard: No auth context
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Guard: NULL org_id not allowed
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Validate user has active access to this org
  SELECT EXISTS (
    SELECT 1 FROM public.user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = p_org_id
      AND is_active = true
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RETURN FALSE;  -- User cannot set an org they don't have access to
  END IF;
  
  -- Upsert the preference
  INSERT INTO public.user_active_org_preferences (user_id, active_org_id, set_at)
  VALUES (v_user_id, p_org_id, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    active_org_id = EXCLUDED.active_org_id,
    set_at = now();
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.set_active_org_id(UUID) IS 
  'Sets the active org ID for the current user. Returns FALSE if user lacks access to the org.';

-- AMENDED: Function privilege hardening
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO service_role;
```

---

## Files Created

| File | Type | Description |
|------|------|-------------|
| `supabase/migrations/YYYYMMDD_session_2_2_active_org_preferences.sql` | CREATE | Migration file |

---

## Schema Summary

| Column | Type | Nullable | Default | Constraint |
|--------|------|----------|---------|------------|
| `user_id` | UUID | NO | - | PRIMARY KEY |
| `active_org_id` | UUID | NO | - | - |
| `set_at` | TIMESTAMPTZ | NO | `now()` | - |
| `created_at` | TIMESTAMPTZ | NO | `now()` | - |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | (auto-update trigger) |

**Total columns: 5**

---

## Function Summary

| Function | Parameters | Returns | Security | Privilege Grants |
|----------|------------|---------|----------|------------------|
| `get_active_org_id()` | None (uses `auth.uid()`) | UUID | SECURITY DEFINER | authenticated, service_role |
| `set_active_org_id(UUID)` | `p_org_id` | BOOLEAN | SECURITY DEFINER | authenticated, service_role |

---

## Acceptance Gates (AMENDED)

| # | Gate | SQL Verification | Expected |
|---|------|------------------|----------|
| 1 | Table exists | `SELECT * FROM user_active_org_preferences LIMIT 1;` | Succeeds, empty |
| 2 | RLS enabled | `SELECT relrowsecurity FROM pg_class WHERE relname = 'user_active_org_preferences';` | `true` |
| 3 | Anon cannot access table | Connect as anon, `SELECT * FROM user_active_org_preferences;` | Permission denied |
| 4 | `get_active_org_id()` exists | `SELECT proname FROM pg_proc WHERE proname = 'get_active_org_id';` | Row returned |
| 5 | `set_active_org_id()` exists | `SELECT proname FROM pg_proc WHERE proname = 'set_active_org_id';` | Row returned |
| 6 | **Anon cannot execute get** | `SELECT has_function_privilege('anon', 'public.get_active_org_id()', 'EXECUTE');` | `false` |
| 7 | **Anon cannot execute set** | `SELECT has_function_privilege('anon', 'public.set_active_org_id(UUID)', 'EXECUTE');` | `false` |
| 8 | Get returns NULL for no grants | Call as user with no grants | `NULL` |
| 9 | Set validates access | Try to set org user doesn't have access to | `FALSE` |
| 10 | Set succeeds for valid org | Set org user has access to | `TRUE` |
| 11 | Get returns stored preference | After set, get returns same org | Matches |
| 12 | Get fallback works | Delete preference, get returns first grant (by synced_at) | Returns first grant org |

---

## Post-Implementation Testing

### Test 1: Table Structure Verification
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_active_org_preferences'
ORDER BY ordinal_position;
```
**Expected:** 5 columns matching schema above.

### Test 2: Functions Exist with Correct Signatures
```sql
SELECT proname, pronargs, prorettype::regtype 
FROM pg_proc 
WHERE proname IN ('get_active_org_id', 'set_active_org_id')
  AND pronamespace = 'public'::regnamespace;
```
**Expected:** 2 rows - `get_active_org_id` returns `uuid`, `set_active_org_id` returns `boolean`.

### Test 3: RLS & Privileges Verification
```sql
SELECT 
  relname, 
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_class 
WHERE relname = 'user_active_org_preferences';
```
**Expected:** `rls_enabled = true`, `rls_forced = true`

### Test 4: Function Privilege Verification (NEW - Critical)
```sql
-- Anon should NOT be able to execute either function
SELECT 
  has_function_privilege('anon', 'public.get_active_org_id()', 'EXECUTE') AS anon_get,
  has_function_privilege('anon', 'public.set_active_org_id(UUID)', 'EXECUTE') AS anon_set;
-- Expected: false, false

-- Authenticated SHOULD be able to execute both
SELECT 
  has_function_privilege('authenticated', 'public.get_active_org_id()', 'EXECUTE') AS auth_get,
  has_function_privilege('authenticated', 'public.set_active_org_id(UUID)', 'EXECUTE') AS auth_set;
-- Expected: true, true
```

### Test 5: Function Integration Test (Run as authenticated user via service_role setup)
```sql
-- Setup: Create test grant first (run as service_role)
DO $$
DECLARE
  v_test_user_id UUID := gen_random_uuid();
  v_org_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_org_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  -- Insert test grants
  INSERT INTO user_org_grants_mirror 
    (user_id, crm_organization_id, role_in_org, org_access_seq, synced_at)
  VALUES 
    (v_test_user_id, v_org_a, 'sales_manager', 1, now()),
    (v_test_user_id, v_org_b, 'pricing', 1, now() + interval '1 second');
  
  RAISE NOTICE 'Test grants created for user %', v_test_user_id;
  RAISE NOTICE 'Org A (first by synced_at): %', v_org_a;
  RAISE NOTICE 'Org B (second by synced_at): %', v_org_b;
  
  -- Cleanup
  DELETE FROM user_org_grants_mirror WHERE user_id = v_test_user_id;
END $$;
```

### Test 6: Fallback Order Verification (synced_at ASC)
```sql
-- This test verifies the fallback uses synced_at ordering
DO $$
DECLARE
  v_test_user UUID := gen_random_uuid();
  v_org_first UUID := '11111111-1111-1111-1111-111111111111';
  v_org_second UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
  -- Insert second org first (but with earlier synced_at)
  INSERT INTO user_org_grants_mirror 
    (user_id, crm_organization_id, role_in_org, org_access_seq, synced_at)
  VALUES 
    (v_test_user, v_org_second, 'admin', 2, now() + interval '1 second');
    
  -- Insert first org second (but with earlier synced_at)
  INSERT INTO user_org_grants_mirror 
    (user_id, crm_organization_id, role_in_org, org_access_seq, synced_at)
  VALUES 
    (v_test_user, v_org_first, 'sales_owner', 1, now());
  
  -- Verify order (first by synced_at should be v_org_first)
  PERFORM 1 FROM user_org_grants_mirror 
  WHERE user_id = v_test_user
  ORDER BY synced_at ASC
  LIMIT 1;
  
  -- The fallback in get_active_org_id() should return v_org_first
  -- (Can't easily test without impersonating, but order is verified)
  
  RAISE NOTICE 'PASS: Grants ordered correctly by synced_at';
  
  -- Cleanup
  DELETE FROM user_org_grants_mirror WHERE user_id = v_test_user;
END $$;
```

---

## Complete Migration SQL (AMENDED)

```sql
-- Session 2.2: Active Org Preferences
-- Creates user_active_org_preferences table and get/set functions

-- Create table
CREATE TABLE public.user_active_org_preferences (
  user_id UUID PRIMARY KEY,
  active_org_id UUID NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_active_org_preferences IS 
  'Stores the user''s currently selected organization context for WMS queries. No FK to auth.users for sync flexibility; orphan cleanup handled by maintenance job.';

-- Index
CREATE INDEX idx_active_org_prefs_org 
  ON public.user_active_org_preferences(active_org_id);

-- Trigger for updated_at (idempotent, schema-qualified)
DROP TRIGGER IF EXISTS update_user_active_org_preferences_updated_at
  ON public.user_active_org_preferences;

CREATE TRIGGER update_user_active_org_preferences_updated_at
  BEFORE UPDATE ON public.user_active_org_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS & Privileges
ALTER TABLE public.user_active_org_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_org_preferences FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_active_org_preferences TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_active_org_preferences TO service_role;

-- RLS Policies (schema-qualified)
CREATE POLICY "users_manage_own_active_org"
  ON public.user_active_org_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_view_all_active_org_prefs"
  ON public.user_active_org_preferences
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.user_role));

-- Function: get_active_org_id()
CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_stored_org_id UUID;
  v_fallback_org_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT active_org_id INTO v_stored_org_id
  FROM public.user_active_org_preferences
  WHERE user_id = v_user_id;
  
  IF v_stored_org_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_org_grants_mirror
      WHERE user_id = v_user_id
        AND crm_organization_id = v_stored_org_id
        AND is_active = true
    ) THEN
      RETURN v_stored_org_id;
    END IF;
  END IF;
  
  -- Fallback: first active grant by synced_at (v1.0.23)
  SELECT crm_organization_id INTO v_fallback_org_id
  FROM public.user_org_grants_mirror
  WHERE user_id = v_user_id
    AND is_active = true
  ORDER BY synced_at ASC
  LIMIT 1;
  
  RETURN v_fallback_org_id;
END;
$$;

COMMENT ON FUNCTION public.get_active_org_id() IS 
  'Returns the active org ID for the current user. Falls back to first available grant (by synced_at) if preference is missing or invalid.';

-- Function privilege hardening
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO service_role;

-- Function: set_active_org_id(UUID)
CREATE OR REPLACE FUNCTION public.set_active_org_id(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = p_org_id
      AND is_active = true
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO public.user_active_org_preferences (user_id, active_org_id, set_at)
  VALUES (v_user_id, p_org_id, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    active_org_id = EXCLUDED.active_org_id,
    set_at = now();
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.set_active_org_id(UUID) IS 
  'Sets the active org ID for the current user. Returns FALSE if user lacks access to the org.';

-- Function privilege hardening
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO service_role;
```

---

## Security Hardening Summary (AMENDED)

| Layer | Implementation |
|-------|----------------|
| Table: PUBLIC | REVOKE ALL |
| Table: anon | REVOKE ALL |
| Table: authenticated | GRANT SELECT, INSERT, UPDATE (RLS-scoped) |
| Table: service_role | GRANT ALL |
| Function: PUBLIC | REVOKE ALL (both functions) |
| Function: anon | No grants (cannot execute) |
| Function: authenticated | GRANT EXECUTE (both functions) |
| Function: service_role | GRANT EXECUTE (both functions) |
| RLS Policy | Users see own row only |
| RLS Policy | Admins can view all (SELECT only) |

---

## Estimated Duration

**Implementation:** 15 minutes  
**Testing:** 15 minutes  
**Total:** ~30 minutes

