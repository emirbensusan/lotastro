
# Session 2.3: Org Access Helper Functions ✅ COMPLETE

## Status: COMPLETE
## Batch: 2 (Multi-Org Identity)

---

## Implementation Summary

- [x] Create `get_user_org_ids()` function (returns UUID[], caller-bound, LANGUAGE SQL)
- [x] Create `user_has_org_access(UUID)` function (returns BOOLEAN, caller-bound, LANGUAGE SQL)
- [x] Function privilege hardening (REVOKE FROM PUBLIC/anon, GRANT TO authenticated/service_role)
- [x] Defensive handling via SQL COALESCE for empty results

---

## Design Choices

| Choice | Rationale |
|--------|-----------|
| LANGUAGE SQL | Simpler, less surface area per v1.0.23 plan |
| COALESCE for empty array | Defensive return when no grants exist |
| EXISTS for boolean check | Efficient single-row check |
| ORDER BY synced_at ASC | Consistent ordering with Session 2.2 fallback |

---

## Verification Queries

```sql
-- Functions exist with correct signatures
SELECT proname, prolang::regprocedure, prorettype::regtype, prosecdef
FROM pg_proc 
WHERE proname IN ('get_user_org_ids', 'user_has_org_access')
  AND pronamespace = 'public'::regnamespace;

-- Critical: Anon cannot execute functions
SELECT 
  has_function_privilege('anon', 'public.get_user_org_ids()', 'EXECUTE') AS anon_get_ids,
  has_function_privilege('anon', 'public.user_has_org_access(UUID)', 'EXECUTE') AS anon_has_access;
-- Expected: false, false

-- Authenticated can execute both
SELECT 
  has_function_privilege('authenticated', 'public.get_user_org_ids()', 'EXECUTE') AS auth_get_ids,
  has_function_privilege('authenticated', 'public.user_has_org_access(UUID)', 'EXECUTE') AS auth_has_access;
-- Expected: true, true
```

---

## Note for Session 2.5

The `user_org_grants_mirror` table has `UNIQUE(user_id, crm_organization_id)`. If CRM payload ever sends duplicate orgs in the snapshot, the handler insert will fail. Session 2.5 snapshot replacement should deduplicate before insert.

---

## Next: Session 2.4 - user_wms_ui_policy Function
