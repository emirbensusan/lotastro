

## Session 1.1 Security Fix: Revoke Overly Permissive Table Privileges

### Summary
Your security audit identified a critical vulnerability where the `anon` role has full privileges (SELECT, INSERT, UPDATE, DELETE) on `public.integration_inbox`. This must be fixed before Session 1.1 can be accepted.

---

### Current State (Verified)
| Role | SELECT | INSERT | UPDATE | DELETE | Required |
|------|--------|--------|--------|--------|----------|
| `anon` | TRUE | TRUE | TRUE | TRUE | ALL FALSE |
| `authenticated` | TRUE | FALSE | FALSE | FALSE | SELECT only (RLS controls) |

---

### Implementation Plan

#### 1. Create Security Fix Migration
A new migration file that revokes all inappropriate privileges:

```sql
-- Session 1.1 Security Fix: Revoke overly permissive table privileges
-- Addresses: anon role has full access, which bypasses defense-in-depth

-- Revoke ALL privileges from anon (they should have zero access)
REVOKE ALL PRIVILEGES ON TABLE public.integration_inbox FROM anon;

-- Revoke write privileges from authenticated (keep SELECT for admin RLS policy)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER 
ON TABLE public.integration_inbox 
FROM authenticated;

-- Verify RLS remains enabled (defensive check)
ALTER TABLE public.integration_inbox ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.integration_inbox FORCE ROW LEVEL SECURITY;
```

#### 2. Update Plan Documentation
Mark Session 1.1 as requiring verification after security fix.

---

### Expected Results After Fix

**A) Privilege Check:**
```
anon_select    = FALSE
anon_insert    = FALSE
anon_update    = FALSE
anon_delete    = FALSE
auth_select    = TRUE  (RLS restricts to admin only)
auth_insert    = FALSE
auth_update    = FALSE
auth_delete    = FALSE
```

**B) Grant Listing:**
Only `authenticated` with `SELECT` privilege should appear.

**C) RLS Policy:**
- Policy `Admins can read integration_inbox` remains active
- `USING: has_role(auth.uid(), 'admin'::user_role)`

---

### Defense-in-Depth Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL LAYERS                        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Table Privileges (GRANT/REVOKE)                       │
│  ├─ anon: NO privileges                                         │
│  └─ authenticated: SELECT only                                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Row-Level Security (RLS)                              │
│  └─ SELECT: Only if has_role(uid, 'admin')                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Service Role Bypass                                   │
│  └─ Edge Functions use service_role key → bypasses RLS          │
│  └─ Only trusted Edge Functions can INSERT/UPDATE               │
└─────────────────────────────────────────────────────────────────┘
```

---

### Acceptance Criteria (Must Pass All)

After migration runs, I will execute and share results for:

1. **Privilege proof query** - All `anon_*` must be FALSE, `auth_insert/update/delete` must be FALSE
2. **Grant listing query** - Only authenticated+SELECT should appear  
3. **Policy confirmation query** - RLS policy remains intact

---

### Technical Notes

- **Why `anon` had privileges**: Supabase's `public` schema has default grants that auto-apply to new tables. The original migration only addressed `authenticated`, not `anon`.
- **Why keep `authenticated` SELECT**: The RLS policy already restricts SELECT to admins only. Revoking SELECT would break admin access.
- **Service role**: Edge functions use the service role key which bypasses RLS entirely, so they can still INSERT/UPDATE as needed.

