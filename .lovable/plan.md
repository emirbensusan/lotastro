

# Session 2.5: org_access.updated Handler + QA — AMENDED Implementation Plan (v2)

## Status: READY FOR IMPLEMENTATION
## Batch: 2 (Multi-Org Identity)
## Prerequisites: Session 2.1 ✅ Session 2.2 ✅ Session 2.3 ✅ Session 2.4 ✅

---

## Amendments Applied

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | **Blocker: Sequence guard breaks on empty grants** | ✅ Added `user_org_grants_sync_state` table |
| 2 | **Bug: `.single()` throws on 0 rows** | ✅ Changed to `.maybeSingle()` |
| 3 | **Gap: Active snapshot invariant not enforced** | ✅ Filter out `is_active: false` grants + log violation |
| 4 | **Robustness: Non-atomic DELETE→INSERT** | ✅ Created atomic RPC function |
| 5 | **NEW: RLS + GRANT mismatch on sync_state** | ✅ Removed authenticated grant (service-role only) |
| 6 | **NEW: Validate crm_organization_id presence** | ✅ Filter malformed grants + log schema violation |

---

## Session Objective

Implement the `handleOrgAccessUpdated()` handler in the webhook receiver to process CRM org access events and synchronize grants to `user_org_grants_mirror` using the snapshot replacement pattern.

**Critical Requirements:**
- Sequence guard using dedicated sync_state table (persists even when grants empty)
- Atomic snapshot replacement via RPC function
- Filter inactive grants AND grants with missing org_id from payload
- Log contract violations for sequence/schema issues

---

## Part 1: Database Migration

### 1A. Sync State Table (Service-Role Only)

```sql
-- Stores last applied org_access_seq per user
-- Prevents stale events from overwriting newer state (even when grants=[])
CREATE TABLE IF NOT EXISTS public.user_org_grants_sync_state (
  user_id UUID PRIMARY KEY,
  last_org_access_seq INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled but NO policies = service-role only access
ALTER TABLE public.user_org_grants_sync_state ENABLE ROW LEVEL SECURITY;

-- FIX #5: Service-role only - no authenticated grant (avoids RLS/GRANT confusion)
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM PUBLIC;
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM anon;
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM authenticated;
GRANT ALL ON TABLE public.user_org_grants_sync_state TO service_role;

COMMENT ON TABLE public.user_org_grants_sync_state IS 
  'Tracks last applied org_access_seq per user. Service-role only (no RLS policies). Independent of mirror rows to survive empty snapshots.';
```

### 1B. Atomic Snapshot Replacement RPC

```sql
-- Atomically replaces user org grants snapshot
-- All operations in single transaction: delete old + insert new + update sync state
-- NOTE: Runs as SECURITY DEFINER (owned by postgres via migration). Bypasses RLS on mirror table.
CREATE OR REPLACE FUNCTION public.replace_user_org_grants_snapshot(
  p_user_id UUID,
  p_org_access_seq INT,
  p_grants JSONB  -- Array of {crm_organization_id, role_in_org, is_active?}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inserted_count INT := 0;
BEGIN
  -- Step 1: Delete all existing grants for this user
  DELETE FROM public.user_org_grants_mirror 
  WHERE user_id = p_user_id;

  -- Step 2: Insert new grants (if any)
  -- p_grants is already deduplicated, filtered, and validated in TS handler
  IF p_grants IS NOT NULL AND jsonb_array_length(p_grants) > 0 THEN
    INSERT INTO public.user_org_grants_mirror 
      (user_id, crm_organization_id, role_in_org, is_active, org_access_seq, synced_at)
    SELECT
      p_user_id,
      (g->>'crm_organization_id')::UUID,
      (g->>'role_in_org')::TEXT,
      COALESCE((g->>'is_active')::BOOLEAN, true),
      p_org_access_seq,
      now()
    FROM jsonb_array_elements(p_grants) g;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  -- Step 3: Update sync state (persists seq even when grants empty)
  INSERT INTO public.user_org_grants_sync_state (user_id, last_org_access_seq, updated_at)
  VALUES (p_user_id, p_org_access_seq, now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_org_access_seq = EXCLUDED.last_org_access_seq,
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'org_access_seq', p_org_access_seq
  );
END;
$$;

COMMENT ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) IS 
  'Atomically replaces user org grants snapshot. SECURITY DEFINER owned by postgres (migration). Service-role only.';

-- Privilege hardening: service-role only
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) TO service_role;
```

---

## Part 2: TypeScript Handler Implementation

### 2A. Interfaces (add near line 64, after existing interfaces)

```typescript
interface OrgAccessGrant {
  crm_organization_id: string;
  role_in_org: 'sales_owner' | 'sales_manager' | 'pricing' | 'accounting' | 'admin';
  is_active?: boolean;
}

interface OrgAccessUpdatedPayload {
  user_id: string;
  org_access_seq: number;
  grants: OrgAccessGrant[];
  updated_at?: string;
  updated_by?: string | null;
}
```

### 2B. Handler Function (add before Deno.serve, ~line 325)

```typescript
async function handleOrgAccessUpdated(
  supabase: ReturnType<typeof createClient>,
  payload: OrgAccessUpdatedPayload
): Promise<{ success: boolean; message: string }> {
  const { user_id, org_access_seq, grants } = payload;

  // Validate required fields
  if (!user_id || typeof org_access_seq !== 'number') {
    return { 
      success: false, 
      message: 'Missing required fields: user_id or org_access_seq' 
    };
  }

  // ========================================
  // SEQUENCE GUARD: Read from sync_state table (survives empty snapshots)
  // ========================================
  const { data: syncState, error: syncError } = await supabase
    .from('user_org_grants_sync_state')
    .select('last_org_access_seq')
    .eq('user_id', user_id)
    .maybeSingle();  // FIX #2: Use maybeSingle() to handle first-event case

  if (syncError) {
    console.error('[org_access.updated] Sync state lookup failed:', syncError);
    return { success: false, message: `Sync state lookup failed: ${syncError.message}` };
  }

  const currentSeq = syncState?.last_org_access_seq ?? 0;

  if (currentSeq >= org_access_seq) {
    // Log as contract violation (sequence out of order)
    await supabase.from('integration_contract_violations').insert({
      event_type: 'org_access.updated',
      idempotency_key: `crm:org_access:${user_id}-${org_access_seq}:updated:v1`,
      source_system: 'crm',
      violation_type: 'sequence_out_of_order',
      violation_message: `Received seq ${org_access_seq} but current is ${currentSeq}`,
      field_name: 'org_access_seq',
      field_value: String(org_access_seq),
      expected_value: `> ${currentSeq}`,
    });

    console.warn(
      `[org_access.updated] Ignoring out-of-order event: ` +
      `received seq ${org_access_seq}, current ${currentSeq}`
    );

    return {
      success: true,
      message: `Ignored: sequence ${org_access_seq} <= current ${currentSeq}`,
    };
  }

  // ========================================
  // VALIDATE + FILTER GRANTS
  // ========================================
  const rawGrants = grants || [];
  
  // FIX #6: Filter out grants with missing/invalid crm_organization_id
  const malformedGrants = rawGrants.filter(
    g => typeof g.crm_organization_id !== 'string' || g.crm_organization_id.length === 0
  );
  
  if (malformedGrants.length > 0) {
    await supabase.from('integration_contract_violations').insert({
      event_type: 'org_access.updated',
      idempotency_key: `crm:org_access:${user_id}-${org_access_seq}:updated:v1`,
      source_system: 'crm',
      violation_type: 'schema_violation',
      violation_message: `Received ${malformedGrants.length} grants with missing/invalid crm_organization_id`,
      field_name: 'grants[].crm_organization_id',
      field_value: 'undefined or empty',
      expected_value: 'valid UUID string',
    });

    console.warn(
      `[org_access.updated] Schema violation: ${malformedGrants.length} malformed grants filtered out`
    );
  }

  // FIX #3: Filter out inactive grants (contract requires active-only snapshot)
  const inactiveGrants = rawGrants.filter(g => g.is_active === false);
  
  if (inactiveGrants.length > 0) {
    await supabase.from('integration_contract_violations').insert({
      event_type: 'org_access.updated',
      idempotency_key: `crm:org_access:${user_id}-${org_access_seq}:updated:v1`,
      source_system: 'crm',
      violation_type: 'schema_violation',
      violation_message: `Received ${inactiveGrants.length} inactive grants in snapshot (contract requires active-only)`,
      field_name: 'grants[].is_active',
      field_value: 'false',
      expected_value: 'true or omitted',
    });

    console.warn(
      `[org_access.updated] Schema violation: ${inactiveGrants.length} inactive grants filtered out`
    );
  }

  // Apply both filters: valid org_id AND active
  const validGrants = rawGrants.filter(
    g => typeof g.crm_organization_id === 'string' && 
         g.crm_organization_id.length > 0 &&
         g.is_active !== false
  );

  // Deduplicate by crm_organization_id (last wins)
  const deduplicatedGrants = new Map<string, OrgAccessGrant>();
  for (const grant of validGrants) {
    deduplicatedGrants.set(grant.crm_organization_id, grant);
  }

  const grantArray = Array.from(deduplicatedGrants.values()).map(g => ({
    crm_organization_id: g.crm_organization_id,
    role_in_org: g.role_in_org,
    is_active: true,  // Always true after filtering
  }));

  // ========================================
  // ATOMIC SNAPSHOT REPLACEMENT via RPC
  // ========================================
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'replace_user_org_grants_snapshot',
    {
      p_user_id: user_id,
      p_org_access_seq: org_access_seq,
      p_grants: grantArray,
    }
  );

  if (rpcError) {
    console.error('[org_access.updated] RPC failed:', rpcError);
    return { success: false, message: `Snapshot replacement failed: ${rpcError.message}` };
  }

  const insertedCount = (rpcResult as { inserted_count?: number })?.inserted_count ?? grantArray.length;

  console.log(
    `[org_access.updated] User ${user_id}: replaced grants with ${insertedCount} orgs (seq ${org_access_seq})`
  );

  return {
    success: true,
    message: insertedCount > 0
      ? `Synced ${insertedCount} grants for user (seq ${org_access_seq})`
      : `Removed all grants for user (seq ${org_access_seq})`,
  };
}
```

### 2C. Switch Case Addition (add after existing handlers)

```typescript
case 'org_access.updated':
  result = await handleOrgAccessUpdated(
    supabase, 
    event.payload as unknown as OrgAccessUpdatedPayload
  );
  break;
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Sync state table** | Persists last seq even when grants=[] (fixes blocker #1) |
| **Service-role only on sync_state** | No RLS policies = no authenticated access. Avoids RLS/GRANT mismatch (fix #5) |
| **`.maybeSingle()`** | Returns null for first event instead of throwing (fix #2) |
| **Filter invalid org_ids** | Prevents Map.set(undefined, ...) and UUID cast failures (fix #6) |
| **Filter inactive grants** | Enforces "active-only snapshot" invariant (fix #3) |
| **RPC for atomicity** | DELETE+INSERT+sync_state in single transaction (fix #4) |
| **Log all violations** | Audit trail for contract drift without blocking |
| **Deduplication in TS** | Handles duplicate org_ids before sending to RPC |
| **Return success for stale seq** | Event was valid but not applied; CRM should not retry |

---

## Files Created/Modified

| File | Type | Description |
|------|------|-------------|
| `supabase/migrations/YYYYMMDD_session_2_5_org_access_handler.sql` | CREATE | Sync state table + RPC function |
| `supabase/functions/wms-webhook-receiver/index.ts` | MODIFY | Add handler + interfaces + switch case |
| `.lovable/plan.md` | UPDATE | Session 2.5 status |

---

## Acceptance Gates

| # | Gate | Verification | Expected |
|---|------|--------------|----------|
| 1 | Event processed, rows created | Send valid event → query mirror table | Rows exist with correct data |
| 2 | Older sequence ignored | Send seq 2, then seq 1 | Seq 1 returns success but no change |
| 3 | Sequence warning logged | Check `integration_contract_violations` | Row with `violation_type = 'sequence_out_of_order'` |
| 4 | Snapshot replaces previous | User has 2 orgs → send event with 1 org | User now has 1 org only |
| 5 | Empty grants removes all | Send event with `grants: []` | User has 0 rows in mirror |
| 6 | **Empty grants preserves seq** | Send seq 2 with `grants: []`, then seq 1 with orgs | Seq 1 rejected (sync_state = 2) |
| 7 | Duplicate orgs handled | Payload has same org twice | No unique constraint error |
| 8 | Invalid role rejected | Payload with `role_in_org: 'invalid'` | Insert fails (CHECK constraint) |
| 9 | Inactive grants filtered | Payload with `is_active: false` entries | Only active grants inserted + violation logged |
| 10 | First event for user works | User has no prior grants | Creates rows without error |
| 11 | **Malformed org_id filtered** | Payload with missing/empty crm_organization_id | Grant filtered + violation logged |

---

## Security Summary

| Layer | Implementation |
|-------|----------------|
| **sync_state table: PUBLIC** | REVOKE ALL |
| **sync_state table: anon** | REVOKE ALL |
| **sync_state table: authenticated** | REVOKE ALL (no grant, no RLS policy = inaccessible) |
| **sync_state table: service_role** | GRANT ALL |
| **RPC: PUBLIC** | REVOKE ALL |
| **RPC: anon** | REVOKE ALL |
| **RPC: authenticated** | REVOKE ALL |
| **RPC: service_role** | GRANT EXECUTE |
| **SECURITY DEFINER** | RPC owned by postgres (migration), bypasses RLS on mirror table |

---

## Complete Migration SQL

```sql
-- Session 2.5: org_access.updated Handler Infrastructure
-- Creates sync_state table (service-role only) + atomic snapshot replacement RPC

-- =============================================================================
-- 1. Sync State Table (service-role only, no authenticated access)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_org_grants_sync_state (
  user_id UUID PRIMARY KEY,
  last_org_access_seq INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled but NO policies = effective service-role only
ALTER TABLE public.user_org_grants_sync_state ENABLE ROW LEVEL SECURITY;

-- FIX #5: Explicitly revoke from authenticated (no RLS/GRANT mismatch)
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM PUBLIC;
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM anon;
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM authenticated;
GRANT ALL ON TABLE public.user_org_grants_sync_state TO service_role;

COMMENT ON TABLE public.user_org_grants_sync_state IS 
  'Tracks last applied org_access_seq per user. Service-role only (no RLS policies).';

-- =============================================================================
-- 2. Atomic Snapshot Replacement RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.replace_user_org_grants_snapshot(
  p_user_id UUID,
  p_org_access_seq INT,
  p_grants JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inserted_count INT := 0;
BEGIN
  DELETE FROM public.user_org_grants_mirror 
  WHERE user_id = p_user_id;

  IF p_grants IS NOT NULL AND jsonb_array_length(p_grants) > 0 THEN
    INSERT INTO public.user_org_grants_mirror 
      (user_id, crm_organization_id, role_in_org, is_active, org_access_seq, synced_at)
    SELECT
      p_user_id,
      (g->>'crm_organization_id')::UUID,
      (g->>'role_in_org')::TEXT,
      COALESCE((g->>'is_active')::BOOLEAN, true),
      p_org_access_seq,
      now()
    FROM jsonb_array_elements(p_grants) g;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  INSERT INTO public.user_org_grants_sync_state (user_id, last_org_access_seq, updated_at)
  VALUES (p_user_id, p_org_access_seq, now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_org_access_seq = EXCLUDED.last_org_access_seq,
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'org_access_seq', p_org_access_seq
  );
END;
$$;

COMMENT ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) IS 
  'Atomically replaces user org grants snapshot. SECURITY DEFINER, service-role only.';

REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) TO service_role;
```

---

## Estimated Duration

**Implementation:** 25 minutes  
**Testing:** 25 minutes  
**Total:** ~50 minutes

---

## Batch 2 Completion Status

After Session 2.5 implementation:

| Session | Status |
|---------|--------|
| 2.1: Org Grants Mirror Table | COMPLETE |
| 2.2: Active Org Preferences | COMPLETE |
| 2.3: Org Access Helper Functions | COMPLETE |
| 2.4: UI Policy Function | COMPLETE |
| 2.5: org_access.updated Handler | READY |

**Batch 2 will be COMPLETE after this session.**

