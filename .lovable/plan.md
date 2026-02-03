
# Session 2.2: Active Org Preferences ✅ COMPLETE (Remediated)

## Status: COMPLETE
## Batch: 2 (Multi-Org Identity)

---

## Implementation Summary

- [x] Create `user_active_org_preferences` table (5 columns, PK on user_id)
- [x] Create `get_active_org_id()` function with fallback logic (synced_at ASC)
- [x] Create `set_active_org_id(UUID)` function with access validation
- [x] RLS policies: users manage own row, admins view all
- [x] **Function privilege hardening** ✅ REMEDIATED
  - Explicit `REVOKE ALL FROM PUBLIC` and `REVOKE ALL FROM anon`
  - `GRANT EXECUTE` only to `authenticated` and `service_role`
- [x] **Schema-qualified references** ✅ REMEDIATED
  - Trigger: `EXECUTE FUNCTION public.update_updated_at_column()`
  - Admin policy: `public.has_role(auth.uid(), 'admin'::public.user_role)`

---

## Verification Queries

Run these to confirm remediation:

```sql
-- Critical: Anon cannot execute functions
SELECT 
  has_function_privilege('anon', 'public.get_active_org_id()', 'EXECUTE') AS anon_get,
  has_function_privilege('anon', 'public.set_active_org_id(UUID)', 'EXECUTE') AS anon_set;
-- Expected: false, false

-- Authenticated can execute functions
SELECT 
  has_function_privilege('authenticated', 'public.get_active_org_id()', 'EXECUTE') AS auth_get,
  has_function_privilege('authenticated', 'public.set_active_org_id(UUID)', 'EXECUTE') AS auth_set;
-- Expected: true, true
```

---

## Next: Session 2.3 - get_user_org_ids Function

