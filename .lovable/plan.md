# WMS v1.0.23 Implementation Plan

## Current Status: Session 2.2 COMPLETE ✅
## Next: Session 2.3 (get_user_org_ids function)

---

## Batch 2: Multi-Org Identity — Progress

### Session 2.1: Org Grants Mirror Table ✅ COMPLETE
- [x] Create `user_org_grants_mirror` table (9 columns)
- [x] Explicit constraint naming `user_org_grants_mirror_user_org_key`
- [x] Idempotent trigger for `updated_at`
- [x] Defense-in-depth RLS (REVOKE ALL from PUBLIC/anon)
- [x] Indexes: `idx_org_grants_user`, `idx_org_grants_org`, `idx_org_grants_active`

### Session 2.2: Active Org Preferences ✅ COMPLETE
- [x] Create `user_active_org_preferences` table (5 columns, PK on user_id)
- [x] Create `get_active_org_id()` function with fallback logic (synced_at ordering)
- [x] Create `set_active_org_id(UUID)` function with access validation
- [x] Function privilege hardening (REVOKE ALL FROM PUBLIC, GRANT TO authenticated/service_role)
- [x] Schema-qualified references (`public.has_role`, `public.user_role`, `public.update_updated_at_column`)
- [x] Defense-in-depth RLS (users_manage_own_active_org, admins_view_all_active_org_prefs)

### Session 2.3: get_user_org_ids Function ⏳ PENDING
- [ ] Create `get_user_org_ids()` function returning UUID[]
- [ ] Function privilege hardening
- [ ] Acceptance tests

### Session 2.4: user_wms_ui_policy Function ⏳ PENDING
- [ ] Create `user_wms_ui_policy()` function
- [ ] Returns JSONB with can_view_all_orgs, visible_org_ids, active_org_id
- [ ] Function privilege hardening

### Session 2.5: sync_user_org_grants Webhook ⏳ PENDING
- [ ] Create Edge Function for CRM sync
- [ ] Handle grant additions/removals
- [ ] Idempotency with org_access_seq

---

## Linter Notes

The 3 RLS linter warnings are **pre-existing** policies in other tables (not from Batch 2 sessions).
These will be addressed in a separate security hardening pass.

---

## Migration Files Created

| Session | Migration File | Status |
|---------|----------------|--------|
| 2.1 | `20260203102627_91b0ecc1-7c69-4a24-83c7-1d941bf5b23a.sql` | ✅ Applied |
| 2.2 | `20260203104159_*.sql` | ✅ Applied |

---

## Verification Queries (Session 2.2)

### Table Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_active_org_preferences';
-- Expected: 5 columns (user_id, active_org_id, set_at, created_at, updated_at)
```

### Functions Exist
```sql
SELECT proname, prorettype::regtype 
FROM pg_proc 
WHERE proname IN ('get_active_org_id', 'set_active_org_id')
  AND pronamespace = 'public'::regnamespace;
-- Expected: 2 rows
```

### Anon Cannot Execute Functions
```sql
SELECT 
  has_function_privilege('anon', 'public.get_active_org_id()', 'EXECUTE') AS anon_get,
  has_function_privilege('anon', 'public.set_active_org_id(UUID)', 'EXECUTE') AS anon_set;
-- Expected: false, false
```

### RLS Enabled & Forced
```sql
SELECT relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE relname = 'user_active_org_preferences';
-- Expected: true, true
```
