# WMS-CRM Integration Implementation Plan

## Session Status Summary

| Session | Status | Description |
|---------|--------|-------------|
| 0.1 | ✅ COMPLETE | Database foundations (tables, RLS policies) |
| 0.2 | ✅ COMPLETE | Contract schemas & validation utilities |
| 0.3 | ✅ COMPLETE | HMAC + Schema validation for Edge Functions |
| 1.1 | ✅ COMPLETE | Integration inbox table + security fix |
| 1.2 | ✅ COMPLETE | Webhook receiver core logic + canonical HMAC |
| 1.3 | 🔲 PENDING | Webhook receiver integration + QA |

---

## Session 1.2: Webhook Receiver Core Logic ✅ COMPLETE

### Implementation Summary

**Completed 2026-02-03**

#### Key Changes

1. **Canonical HMAC Convention Enforced**
   - `computeHmac(message, secret)` hashes EXACTLY the input message (no internal canonicalization)
   - `validateInboundEvent()` builds canonical string as `${timestampHeader}.${rawBody}`
   - HMAC verified over the canonical string, not raw body alone

2. **Updated contract-validation.ts**
   - Validation order: Signature header → Timestamp header → Timestamp freshness → Canonical HMAC → JSON parse → Schema validation
   - Returns 401 for missing/invalid HMAC or timestamp
   - Returns 400 for schema violations (idempotency key, unknown event, unknown fields, invalid UOM)

3. **Updated wms-webhook-receiver**
   - Uses `X-WMS-Signature` and `X-WMS-Timestamp` headers (with fallback to legacy headers)
   - Uses `WMS_CRM_HMAC_SECRET` secret (with fallback to `CRM_WEBHOOK_SECRET`)
   - Deployed and tested

4. **Comprehensive Test Coverage (session_1_2_test.ts)**
   - 23 tests total, all passing
   - 401 tests: Missing signature, missing timestamp, expired timestamp, invalid signature, body-only HMAC
   - 400 tests: Invalid idempotency key (4 segments, v2, invalid source), unknown event type, unknown fields, invalid UOM
   - 200 tests: Valid event with canonical HMAC, valid UOM (MT, KG)
   - HMAC unit tests: Exact message hashing, canonical string format verification

### Test Results

```
Session 1.2 Tests: 23 passed | 0 failed
Session 0.3 Tests: 18 passed | 0 failed (canonical HMAC updated)
```

### Critical HMAC Test Case (401-5)

```typescript
// Body-only HMAC MUST fail with 401
const wrongSig = computeHmac(body, secret);  // WRONG - no timestamp
const correctSig = computeHmac(`${ts}.${body}`, secret);  // CORRECT

// wrongSig → 401 INVALID_HMAC ✓
// correctSig → 200 ✓
```

---

## Session 1.1 Security Fix ✅ COMPLETE

### Summary
Fixed critical vulnerability where `anon` role had full privileges on `public.integration_inbox`.

### Migration Applied
```sql
REVOKE ALL PRIVILEGES ON TABLE public.integration_inbox FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.integration_inbox FROM authenticated;
ALTER TABLE public.integration_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_inbox FORCE ROW LEVEL SECURITY;
```

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

## Next: Session 1.3 - Webhook Receiver Integration + QA

### Scope
- Integrate contract validation into wms-webhook-receiver for full inbox-based event handling
- Write to `integration_inbox` with idempotency check
- Compute SHA-256 `payload_hash` for drift detection
- Retry logic: Convert "failed" status to "pending" on retry (Contract Appendix D.3)
- End-to-end testing of all rejection scenarios

### Acceptance Gates
1. New event creates row in `integration_inbox` with `status='pending'`
2. Duplicate `idempotency_key` returns 200 (no new row)
3. Failed status converts to pending on retry with `attempt_count` increment
4. Payload hash drift logged to `integration_contract_violations`
