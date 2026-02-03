# WMS-CRM Integration Implementation Plan

## Session Status Summary

| Session | Status | Description |
|---------|--------|-------------|
| 0.1 | ✅ COMPLETE | Database foundations (tables, RLS policies) |
| 0.2 | ✅ COMPLETE | Contract schemas & validation utilities |
| 0.3 | ✅ COMPLETE | HMAC + Schema validation for Edge Functions |
| 1.1 | ✅ COMPLETE | Integration inbox table + security fix |
| 1.2 | ✅ COMPLETE | Webhook receiver core logic + canonical HMAC |
| 1.3 | ✅ COMPLETE | Webhook receiver integration + QA |
| 2.1 | ✅ COMPLETE | Org Grants Mirror Table |
| 2.2 | 🔲 PENDING | Active Org Preferences |
| 2.3 | 🔲 PENDING | Org Access Helper Functions |
| 2.4 | 🔲 PENDING | UI Policy Function |
| 2.5 | 🔲 PENDING | org_access.updated Event Handler |

---

## Batch 2: Multi-Org Identity

### Session 2.1: Org Grants Mirror Table ✅ COMPLETE

**Completed 2026-02-03**

#### Implementation Summary

Created `user_org_grants_mirror` table to store CRM organization grants for multi-org RLS enforcement.

#### Key Features

1. **Schema (9 columns)**
   - `id` (UUID PK)
   - `user_id`, `crm_organization_id` (UUID, composite unique)
   - `role_in_org` (TEXT, CHECK constraint: sales_owner, sales_manager, pricing, accounting, admin)
   - `is_active` (BOOLEAN, default true)
   - `org_access_seq` (INTEGER, CHECK >= 0)
   - `synced_at`, `created_at`, `updated_at` (TIMESTAMPTZ)

2. **Constraints**
   - Explicit naming: `user_org_grants_mirror_user_org_key`
   - Non-negative sequence: `CHECK (org_access_seq >= 0)`
   - Contract-locked roles: 5 allowed values only

3. **Indexes**
   - `idx_org_grants_user` (user_id)
   - `idx_org_grants_org` (crm_organization_id)
   - `idx_org_grants_active` (partial: WHERE is_active = true)

4. **Security (Defense-in-Depth)**
   - RLS enabled + forced
   - REVOKE ALL from PUBLIC, anon
   - GRANT SELECT to authenticated
   - GRANT ALL to service_role
   - Policy: users see own grants only
   - Policy: admins see all (via `has_role()`)

5. **Idempotent Trigger**
   - `DROP TRIGGER IF EXISTS` before CREATE
   - Uses existing `update_updated_at_column()` function

#### Verification Tests

Run in Supabase SQL Editor:

```sql
-- Test 1: Structure (expect 9 columns)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_org_grants_mirror'
ORDER BY ordinal_position;

-- Test 2: Valid role (expect success)
INSERT INTO user_org_grants_mirror 
  (user_id, crm_organization_id, role_in_org, org_access_seq)
VALUES (gen_random_uuid(), gen_random_uuid(), 'sales_owner', 1)
RETURNING id;

-- Test 3: Invalid role (expect CHECK violation)
INSERT INTO user_org_grants_mirror 
  (user_id, crm_organization_id, role_in_org, org_access_seq)
VALUES (gen_random_uuid(), gen_random_uuid(), 'warehouse_staff', 1);

-- Test 4: Negative sequence (expect CHECK violation)
INSERT INTO user_org_grants_mirror 
  (user_id, crm_organization_id, role_in_org, org_access_seq)
VALUES (gen_random_uuid(), gen_random_uuid(), 'admin', -1);

-- Test 5: Indexes (expect 3 custom + PK + unique = 5 total)
SELECT indexname FROM pg_indexes 
WHERE tablename = 'user_org_grants_mirror';

-- Test 6: RLS enabled
SELECT relrowsecurity, relforcerowsecurity 
FROM pg_class WHERE relname = 'user_org_grants_mirror';

-- Test 7: updated_at trigger
DO $$
DECLARE
  v_id UUID;
  v_created TIMESTAMPTZ;
  v_updated TIMESTAMPTZ;
BEGIN
  INSERT INTO user_org_grants_mirror 
    (user_id, crm_organization_id, role_in_org, org_access_seq)
  VALUES (gen_random_uuid(), gen_random_uuid(), 'pricing', 1)
  RETURNING id, created_at, updated_at INTO v_id, v_created, v_updated;
  
  PERFORM pg_sleep(0.1);
  
  UPDATE user_org_grants_mirror SET is_active = false WHERE id = v_id;
  
  SELECT updated_at INTO v_updated FROM user_org_grants_mirror WHERE id = v_id;
  
  IF v_updated > v_created THEN
    RAISE NOTICE 'PASS: updated_at auto-updated';
  ELSE
    RAISE EXCEPTION 'FAIL: updated_at not updated';
  END IF;
  
  DELETE FROM user_org_grants_mirror WHERE id = v_id;
END $$;

-- Cleanup test data
DELETE FROM user_org_grants_mirror 
WHERE created_at > now() - interval '5 minutes';
```

---

### Session 2.2: Active Org Preferences (NEXT)

#### Scope
- Create `user_active_org_preferences` table
- SQL functions: `get_active_org_id()`, `set_active_org_id()`
- Fallback logic when no preference set

#### Schema
```sql
CREATE TABLE public.user_active_org_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  active_org_id UUID NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Session 2.3: Org Access Helper Functions

#### Scope
- `user_has_org_access(user_id, org_id)` → boolean
- `get_user_org_ids(user_id)` → UUID[]

---

### Session 2.4: UI Policy Function

#### Scope
- `user_wms_ui_policy(user_id)` → JSON
- Returns role-based visibility flags for frontend

---

### Session 2.5: org_access.updated Event Handler

#### Scope
- Handler in wms-webhook-receiver for `org_access.updated`
- Snapshot replacement logic (DELETE + INSERT)
- Sequence guard for out-of-order events
- Write to `user_org_grants_mirror`

---

## Batch 1 Summary (COMPLETE)

### Session 1.3 ✅ COMPLETE

**Completed 2026-02-03**

Full webhook receiver integration with:
- Inbox-based event handling
- SHA-256 payload hash for drift detection
- Retry logic (failed → pending with attempt_count increment)
- 409 Conflict on payload drift

### Session 1.2 ✅ COMPLETE

Canonical HMAC: `${timestampHeader}.${rawBody}`

### Session 1.1 ✅ COMPLETE

Integration inbox table with defense-in-depth security.

---

## Architecture Notes

### Defense-in-Depth Pattern
```
Layer 1: REVOKE from PUBLIC, anon
Layer 2: GRANT SELECT to authenticated
Layer 3: RLS policies (user sees own, admin sees all)
Layer 4: service_role bypasses RLS for Edge Functions
```

### Snapshot Replacement Pattern (Session 2.5)
```sql
-- On org_access.updated event:
DELETE FROM user_org_grants_mirror WHERE user_id = $1;
INSERT INTO user_org_grants_mirror (...) VALUES ... -- all grants
```
