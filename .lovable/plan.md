# WMS-CRM Integration v1.0.23 - Implementation Plan

## Batch 2: Multi-Org Identity — COMPLETE ✅

| Session | Status | Description |
|---------|--------|-------------|
| 2.1 | ✅ COMPLETE | Org Grants Mirror Table |
| 2.2 | ✅ COMPLETE | Active Org Preferences |
| 2.3 | ✅ COMPLETE | Org Access Helper Functions |
| 2.4 | ✅ COMPLETE | UI Policy Function |
| 2.5 | ✅ COMPLETE | org_access.updated Handler |

---

## Session 2.5 Implementation Summary

**Completed: 2025-02-03**

### Database Objects Created

1. **`user_org_grants_sync_state` table** - Service-role only table tracking last applied `org_access_seq` per user. Survives empty snapshot replacements for sequence guard protection.

2. **`replace_user_org_grants_snapshot(UUID, INT, JSONB)` RPC** - Atomic function performing:
   - DELETE all existing grants for user
   - INSERT new grants from snapshot
   - UPSERT sync state with new sequence number
   - All in single transaction

### Edge Function Handler Added

**`handleOrgAccessUpdated()`** in `wms-webhook-receiver/index.ts`:
- Sequence guard using `user_org_grants_sync_state` (not mirror table)
- Filters malformed grants (missing `crm_organization_id`)
- Filters inactive grants (`is_active: false`) 
- Deduplicates by org_id (last wins)
- Logs schema violations to `integration_contract_violations`
- Calls atomic RPC for snapshot replacement

### Security Model

| Layer | Access |
|-------|--------|
| `user_org_grants_sync_state` | service_role only (RLS enabled, no policies) |
| `replace_user_org_grants_snapshot` RPC | service_role only (SECURITY DEFINER) |

---

## Next Steps: Batch 3

Ready to proceed with Batch 3 sessions when approved.
