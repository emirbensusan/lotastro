# WMS Implementation Plan for CRM/WMS Integration v1.0.23

> **Status**: DRAFT — Pending Review  
> **Contract Version**: v1.0.23 (LOCKED)  
> **Contract Authority**: `docs/wms_crm_v1_0_23_integration_updated/integration_contract_v1_0_23(1)(1).md`  
> **Created**: 2026-01-31  
> **Revised**: 2026-02-02 (Session breakdown added)  
> **Total Estimated Sessions**: 54

---

## DRIFT PREVENTION RULES (HARD REQUIREMENTS)

These rules are **non-negotiable** and must be followed throughout implementation:

### DR-1: Contract as Schema Authority
The locked contract file `integration_contract_v1_0_23(1)(1).md` is the **single source of truth** for:
- Event names (exact spelling)
- Payload field names and types
- Status enum values
- Idempotency key formats

**Any deviation from contract schemas is a blocking defect.**

### DR-2: Reject Unknown Fields
All inbound event handlers MUST:
1. Validate payload against contract schema
2. **Log** any fields present in payload but not in contract schema
3. **Reject** (HTTP 400) payloads with unknown fields if strict mode is enabled
4. Store violation details in `integration_contract_violations` audit table

### DR-3: Contract Compliance Checklist
Every batch that touches integration events MUST include:
```
### Contract Compliance Checklist
- [ ] Event names match contract exactly
- [ ] Payload fields match contract schema (no extras, no missing required)
- [ ] Idempotency key format: 5 segments, ends with :v1
- [ ] Status enums use contract-defined values only
- [ ] UOM restricted to MT|KG only (contract requirement)
```

### DR-4: No Invented Events or Fields
If functionality requires events/fields not in contract:
1. **DO NOT IMPLEMENT** as integration event
2. Flag as **CONTRACT CHANGE REQUEST** in this document
3. Implement only after contract amendment is approved and locked

### DR-5: Idempotency Key Validation
All idempotency keys MUST:
- Have exactly 5 colon-separated segments
- Format: `<source>:<entity>:<entity_id>:<action>:v1`
- Use dashes (not colons) for composite entity_ids
- End with `:v1` (version segment)

### DR-6: Table Naming Authority

**WMS canonical table name**: `user_org_grants_mirror`

This table mirrors CRM's `user_org_roles` table via the `org_access.updated` event. Throughout all WMS implementation artifacts (code, snippets, tests, QA steps), use **only** `user_org_grants_mirror`. The CRM table name exists only as documentation context and must not appear in WMS execution code.

---

## MULTI-ORG UI RULES (LOCKED)

Per PRD Section 2 and Agent Checklist Section 1:

### Scope UI Rules (what users see)

All list pages implement two org scopes:
- **Active Org** (default)
- **All Orgs** (optional, gated)

### Toggle + Org-Label Policy (LOCKED)

**Hard rule:** UI gating MUST NOT be derived from `COUNT(DISTINCT org)`.

Instead, use a WMS-side policy function that maps:
- **Contract-defined CRM roles** in `user_org_grants_mirror.role_in_org` (MUST remain exactly):
  - `sales_owner | sales_manager | pricing | accounting | admin`
- **WMS operational roles** (stored separately, e.g., `public.user_roles`) for UI minimization.

Policy requirements:
- **Can toggle “All Orgs”**: `sales_manager`, `accounting`, `pricing`, `admin`
- **Cannot toggle “All Orgs”**: `sales_owner` (even if multi-org grants exist)
- **Warehouse roles** (e.g., `warehouse_staff`) may have multi-org grants but:
  - **Org toggle hidden**
  - **Org badges/columns hidden** (minimized UI)

### Implementation Rule (use policy + persisted Active Org, caller-bound functions)
```typescript
// Complete pattern for org-scoped list pages
// All RPC calls are caller-bound (use auth.uid() internally) — NO p_user_id parameter

// 1. Get UI policy (caller-bound, uses auth.uid() internally)
const { data: uiPolicy } = await supabase.rpc('user_wms_ui_policy');

// 2. Get user's persisted Active Org preference (caller-bound)
const { data: activeOrgId } = await supabase.rpc('get_active_org_id');

// 3. Manage org scope state
const [orgScope, setOrgScope] = useState<'active' | 'all'>('active');

// 4. Determine visibility based on policy (NOT grant count)
const showOrgToggle = Boolean(uiPolicy?.show_org_toggle);
const showOrgColumn = Boolean(uiPolicy?.show_org_labels_in_all_scope) && orgScope === 'all';
const showOrgBadge = Boolean(uiPolicy?.show_org_labels_in_all_scope) && orgScope === 'all';

// 5. Compute org filter based on scope
// IMPORTANT: null activeOrgId in Active scope = block queries, not show everything
if (orgScope === 'active' && !activeOrgId) {
  // Force org selection before showing data
  return <OrgSelectionRequired onSelect={handleActiveOrgChange} />;
}
const orgFilter = orgScope === 'all' 
  ? undefined  // No filter = all accessible orgs (RLS enforces)
  : activeOrgId;  // Filter to persisted Active Org

// 6. Handle Active Org selection with error feedback
const handleActiveOrgChange = async (newOrgId: string) => {
  const { data: success, error } = await supabase.rpc('set_active_org_id', { p_org_id: newOrgId });
  
  if (error || success === false) {
    toast.error('Unable to switch organization. You may not have access.');
    return;  // Revert UI selection if needed
  }
  
  // Refetch activeOrgId after successful update
  refetchActiveOrg();
  toast.success('Organization switched');
};
```

---

## Table of Contents

1. [Document Alignment](#document-alignment)
2. [QA Traceability Matrix](#qa-traceability-matrix)
3. [Operational Infrastructure](#operational-infrastructure)
4. [Batch 0: Contract Alignment & Guards](#batch-0-contract-alignment--guards)
5. [Batch 1: Contract File + Integration Inbox](#batch-1-contract-file--integration-inbox)
6. [Batch 2: Multi-Org Identity + org_access.updated Handler](#batch-2-multi-org-identity--org_accessupdated-handler)
7. [Batch 3: Reservations Schema Extensions](#batch-3-reservations-schema-extensions)
8. [Batch 4: Orders Schema Extensions + PO Number Generator](#batch-4-orders-schema-extensions--po-number-generator)
9. [Batch 5: Supply Requests Mirror + Events](#batch-5-supply-requests-mirror--events)
10. [Batch 6: stock.changed Event](#batch-6-stockchanged-event)
11. [Batch 7: Allocation Planning + Entry Pages](#batch-7-allocation-planning--entry-pages)
12. [Batch 8: Shipment Approval + Override](#batch-8-shipment-approval--override)
13. [Batch 9: Central Stock Checks (Abra)](#batch-9-central-stock-checks-abra)
14. [Batch 10: Post-PO Issues (Discrepancy Loop)](#batch-10-post-po-issues-discrepancy-loop)
15. [Batch 11: Costing Module](#batch-11-costing-module)
16. [Batch 12: Invoice Control + Fulfillment Gate](#batch-12-invoice-control--fulfillment-gate)
17. [Batch 13: PO Command Center](#batch-13-po-command-center)
18. [Final Consolidated Inventories](#final-consolidated-inventories)
19. [CRM Dependencies Per Batch](#crm-dependencies-per-batch)
20. [Contract Change Requests](#contract-change-requests)
21. [Files/Functions Created or Modified](#filesfunctions-created-or-modified)

---

## Document Alignment

This implementation plan is **100% aligned** with the following canonical v1.0.23 documents:

| Document | Location | Purpose |
|----------|----------|---------|
| **Integration Contract v1.0.23 (LOCKED)** | `docs/wms_crm_v1_0_23_integration_updated/integration_contract_v1_0_23(1)(1).md` | Schema authority (30 WMS→CRM events, 11 CRM→WMS events) |
| Epic Implementation Plan | `docs/wms_crm_v1_0_23_integration_updated/WMS_CRM_EPIC_IMPLEMENTATION_PLAN_v1_0_23_UPDATED.md` | 17-batch execution roadmap |
| QA Test Plan | `docs/wms_crm_v1_0_23_integration_updated/QA_TestPlan_CRM_WMS_v1_0_23_UPDATED.md` | 503-line test coverage |
| PRD | `docs/wms_crm_v1_0_23_integration_updated/PRD_CRM_Pricing_Thresholds_v1_9_v1_0_23_UPDATED.md` | Multi-org + pricing + credit rules |
| Agent Checklist | `docs/wms_crm_v1_0_23_integration_updated/Agent_Checklist_Pricing_Thresholds_WarehouseCheck_v1_10_v1_0_23_UPDATED.md` | WMS implementation checklist |
| Appendix | `docs/wms_crm_v1_0_23_integration_updated/WMS_Appendix_PricingThresholds_Inputs_v1_9_v1_0_23_UPDATED.md` | Data requirements |
| User Stories | `docs/wms_crm_v1_0_23_integration_updated/CRM_WMS_UserStories_v1_0_23.md` | 83 user stories |
| Master User Journeys | `docs/wms_crm_v1_0_23_integration_updated/CRM_WMS_USER_JOURNEYS_v1_0_23_AGGREGATED_MASTER.md` | 99 user journeys |

---

## QA Traceability Matrix

Every batch MUST map to at least one QA test case from QA_TestPlan_CRM_WMS_v1_0_23_UPDATED.md.

| Batch | User Stories | Contract Events | QA Test Cases |
|-------|--------------|-----------------|---------------|
| 0 | #72, #81, #82, #83 | (infrastructure) | B-01, B-02, QA Addendum A-F |
| 1 | #72 | (infrastructure) | B-01, B-02 |
| 2 | #1, #2 | `org_access.updated` | RLS-01, RLS-02, RLS-03, F-01, D-01, PREF-01, PREF-02, PREF-03, PREF-04, SEC-01, SEC-02, SEC-03, SEC-04, UX-01 |
| 3 | #10, #83 | (prepares allocation events) | FUL-01, LAB-01 |
| 4 | #6, #7, #82, #84 | `order.created` | ID-01, ID-02, ID-03, ORD-01 |
| 5 | #11 | `supply_request.created`, `supply_request.status_updated` | (supply tracking) |
| 6 | #16, #81 | `stock.changed` | E-01, QA Addendum E |
| 7 | #19 | `reservation.allocation_planned`, `reservation.allocated` | FUL-01 |
| 8 | #20, #21 | `shipment.approved` (inbound), `order.created` | FUL-01, FUL-02 |
| 9 | #46-50 | `central_stock_check.completed` | ABR-01, ABR-02, ABR-03, ABR-04, ABRA-01, ABRA-02 |
| 10 | #72, #85, #86, #93 | `post_po_issue.created/updated/resolved` | DPO-01, DPO-02, DPO-03, DPO-04 |
| 11 | #75-80 | `costing.invoice_posted/receipt_linked/adjustment_posted/wac_updated` | CST-01 to CST-06 |
| 12 | #72 | `invoice_control.passed/failed` | INV-01, INV-02, INV-03 |
| 13 | #9 | (uses all prior events) | (command center) |

---

## Session Breakdown

This section breaks down the 14 batches (0-13) into discrete execution sessions. Each session is designed to be:
- **Completable in 45-90 minutes** (typical Lovable session)
- **Self-contained** with clear acceptance gates
- **Sequentially safe** (no dependencies on incomplete work)

### Batch Summary & Session Allocation

| Batch | Name | Sessions | Total Est. |
|-------|------|----------|------------|
| 0 | Contract Alignment & Guards | 3 | 3 |
| 1 | Integration Inbox | 3 | 3 |
| 2 | Multi-Org Identity | 5 | 5 |
| 3 | Reservations Schema Extensions | 3 | 3 |
| 4 | Orders Schema + PO Generator | 4 | 4 |
| 5 | Supply Requests Mirror | 3 | 3 |
| 6 | stock.changed Event | 3 | 3 |
| 7 | Allocation Planning + Entry | 5 | 5 |
| 8 | Shipment Approval + Override | 4 | 4 |
| 9 | Central Stock Checks (Abra) | 5 | 5 |
| 10 | Post-PO Issues | 4 | 4 |
| 11 | Costing Module | 5 | 5 |
| 12 | Invoice Control | 3 | 3 |
| 13 | PO Command Center | 4 | 4 |
| **TOTAL** | | | **54 sessions** |

### BATCH 0: Contract Alignment & Guards (3 Sessions)

**Purpose:** Establish drift prevention infrastructure before any integration work.

#### Session 0.1: Contract Violations Table + Validation Functions
**Scope:**
- Create `integration_contract_violations` table with all columns
- Create `validate_idempotency_key()` function
- Create `validate_contract_uom()` function
- Add indexes for violations table

**Acceptance Gates:**
- [ ] `SELECT * FROM integration_contract_violations LIMIT 1` succeeds
- [ ] `SELECT * FROM validate_idempotency_key('wms:order:123:created:v1')` returns valid=true
- [ ] `SELECT * FROM validate_idempotency_key('wms:order:123:created')` returns valid=false (4 segments)
- [ ] `SELECT validate_contract_uom('MT')` = true
- [ ] `SELECT validate_contract_uom('YD')` = false

#### Session 0.2: Contract Schema Definitions (TypeScript)
**Scope:**
- Create `supabase/functions/_shared/contract-schemas.ts`
- Define `CONTRACT_UOM_VALUES`, `validateIdempotencyKey()`, `validatePayloadSchema()`
- Define `logContractViolation()` helper
- Define `EVENT_SCHEMAS` for all 11 CRM→WMS events

**Acceptance Gates:**
- [ ] File created and deployable
- [ ] `validateIdempotencyKey()` unit tests pass
- [ ] All event schemas match contract exactly

#### Session 0.3: HMAC + Schema Validation (TypeScript)
**Scope:**
- Create `supabase/functions/_shared/contract-validation.ts`
- Implement `validateInboundEvent()` with HMAC, schema, UOM validation
- Add unknown field detection and logging
- Configure STRICT_MODE behavior

**Acceptance Gates:**
- [ ] Valid request with correct HMAC passes
- [ ] Invalid HMAC returns 401
- [ ] Unknown fields logged and rejected (strict mode)
- [ ] Missing required fields return 400 with details
- [ ] Invalid UOM rejected with 400

### BATCH 1: Integration Inbox (3 Sessions)

**Purpose:** Create inbound event logging table and webhook receiver.

#### Session 1.1: Integration Inbox Table + RLS
**Scope:**
- Create `integration_inbox` table with all columns
- Add indexes (idempotency, status, event_type, retry)
- Configure RLS (admin-only read, service role write)
- Revoke authenticated access

**Acceptance Gates:**
- [ ] `SELECT * FROM integration_inbox LIMIT 1` succeeds for admin
- [ ] Non-admin authenticated user cannot SELECT
- [ ] Indexes created and verified

#### Session 1.2: Webhook Receiver Core Logic
**Scope:**
- Update `wms-webhook-receiver` edge function
- Implement `handleInboundEvent()` with idempotency check
- Implement payload hash computation
- Add "Failed → Pending" retry logic (Contract Appendix D.3)

**Acceptance Gates:**
- [ ] New event creates row with status='pending'
- [ ] Duplicate idempotency_key returns 200 (no new row)
- [ ] Failed status converts to pending on retry
- [ ] Payload hash drift logged

#### Session 1.3: Webhook Receiver Integration + QA
**Scope:**
- Integrate contract validation into receiver
- Deploy and test end-to-end
- Test all rejection scenarios

**Acceptance Gates:**
- [ ] Valid event logged successfully
- [ ] Invalid 4-segment key returns 400
- [ ] Invalid HMAC returns 401
- [ ] Unknown event type rejected

### BATCH 2: Multi-Org Identity (5 Sessions)

**Purpose:** Implement org grants mirroring, active org persistence, and UI policy.

#### Session 2.1: Org Grants Mirror Table
**Scope:**
- Create `user_org_grants_mirror` table
- Add role_in_org CHECK constraint (contract taxonomy)
- Create all indexes
- Configure basic RLS

**Acceptance Gates:**
- [ ] Table created with correct schema
- [ ] Invalid role_in_org rejected
- [ ] Indexes verified

#### Session 2.2: Active Org Preferences Table + Functions
**Scope:**
- Create `user_active_org_preferences` table
- Create `get_active_org_id()` function (caller-bound)
- Create `set_active_org_id(p_org_id)` function (caller-bound)
- Apply REVOKE/GRANT pattern

**Acceptance Gates:**
- [ ] `SELECT get_active_org_id()` returns org or NULL
- [ ] `SELECT set_active_org_id('valid-org')` returns true
- [ ] `SELECT set_active_org_id('invalid-org')` returns false
- [ ] `SELECT has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')` = false

#### Session 2.3: Org Access Helper Functions
**Scope:**
- Create `user_has_org_access(p_org_id)` function
- Create `get_user_org_ids()` function
- Apply REVOKE/GRANT pattern
- Test caller-bound security

**Acceptance Gates:**
- [ ] Functions work for authenticated users
- [ ] Anon cannot execute any function
- [ ] Correct org list returned

#### Session 2.4: UI Policy Function
**Scope:**
- Create `user_wms_ui_policy()` function
- Implement role-based toggle visibility logic
- Handle warehouse role override
- Handle unauthenticated callers

**Acceptance Gates:**
- [ ] Warehouse user with multi-org: `show_org_toggle = false`
- [ ] Manager role: `show_org_toggle = true`
- [ ] Sales_owner only: `show_org_toggle = false`
- [ ] Unauthenticated: returns error JSON

#### Session 2.5: org_access.updated Handler + QA
**Scope:**
- Implement `handleOrgAccessUpdated()` in webhook receiver
- Add sequence guard for out-of-order protection
- Implement snapshot replacement logic
- Full QA verification

**Acceptance Gates:**
- [ ] Event processed, rows created in mirror table
- [ ] Older sequence ignored with warning
- [ ] Snapshot replaces previous grants
- [ ] All SEC-* and PREF-* tests pass

### BATCH 3: Reservations Schema Extensions (3 Sessions)

**Purpose:** Extend reservations for allocation and lab workflow.

#### Session 3.1: Reservation Table Extensions
**Scope:**
- Add allocation_state column with CHECK constraint
- Add allocation planning columns (planned_at, planned_by)
- Add action_required_reason column
- Add sample/lab workflow columns

**Acceptance Gates:**
- [ ] All columns added
- [ ] Invalid allocation_state rejected
- [ ] Indexes created

#### Session 3.2: Reservation Line Extensions
**Scope:**
- Add lab_status column (requested, in_progress, sent, approved, rejected)
- Add cutting audit columns
- Add CRM deal line linkage
- Add UOM column (MT/KG only)

**Acceptance Gates:**
- [ ] Line-level columns added
- [ ] Invalid UOM rejected
- [ ] Lab status workflow functional

#### Session 3.3: Reservation Event Handlers
**Scope:**
- Implement reservation event dispatchers
- Create `dispatchReservationAllocated()`
- Create `dispatchReservationAllocationPlanned()`
- QA verification

**Acceptance Gates:**
- [ ] Events dispatched with correct schema
- [ ] Idempotency keys 5 segments
- [ ] UOM validated

### BATCH 4: Orders Schema + PO Generator (4 Sessions)

**Purpose:** Extend orders for CRM integration with org-prefixed PO numbers.

#### Session 4.1: Orders Table Extensions
**Scope:**
- Add po_number column (unique)
- Add crm_organization_id (NOT NULL constraint)
- Add crm_deal_id column
- Add override tracking columns

**Acceptance Gates:**
- [ ] Columns added
- [ ] Order without org_id rejected
- [ ] Override reason enum enforced

#### Session 4.2: PO Number Generator
**Scope:**
- Create `generate_po_number(p_org_prefix)` function
- Implement Crockford Base32 generation
- Add format constraint `{ORG}P{8-CHAR}`
- Handle uniqueness with retry loop

**Acceptance Gates:**
- [ ] `generate_po_number('MOD')` returns `MODPXXXXXXXX`
- [ ] `generate_po_number(NULL)` raises exception
- [ ] `generate_po_number('invalid')` raises exception
- [ ] Duplicate PO never generated

#### Session 4.3: Order Lots + Status Tracking
**Scope:**
- Add order_lots columns (crm_deal_line_id, uom)
- Create order_status_seq trigger
- Add invoice tracking columns
- Add carrier preference columns

**Acceptance Gates:**
- [ ] UOM restricted to MT/KG
- [ ] Status change increments sequence
- [ ] Invoice status enum enforced

#### Session 4.4: Order Creation + order.created Event
**Scope:**
- Implement order creation with mandatory org
- Create `dispatchOrderCreated()` event
- Integration with PO generator
- QA verification

**Acceptance Gates:**
- [ ] Order created with correct PO format
- [ ] order.created event dispatched
- [ ] Idempotency key format correct

### BATCH 5: Supply Requests Mirror (3 Sessions)

**Purpose:** Mirror supply request data from CRM for allocation planning.

#### Session 5.1: Supply Requests Mirror Table
**Scope:**
- Create `supply_requests_mirror` table
- Add all required columns from contract
- Configure indexes and RLS

**Acceptance Gates:**
- [ ] Table created with correct schema
- [ ] RLS configured

#### Session 5.2: supply_request Event Handlers
**Scope:**
- Implement `handleSupplyRequestCreated()`
- Implement `handleSupplyRequestStatusUpdated()`
- Add sequence guard

**Acceptance Gates:**
- [ ] Events processed correctly
- [ ] Out-of-order rejected

#### Session 5.3: Supply Tracking Integration + QA
**Scope:**
- Connect to allocation planning
- Test milestone updates (eta_confirmed, in_transit, arrived_soft)
- QA verification

**Acceptance Gates:**
- [ ] Status transitions work
- [ ] Milestone timestamps recorded

### BATCH 6: stock.changed Event (3 Sessions)

**Purpose:** Emit stock change events to CRM.

#### Session 6.1: Stock Transactions Table
**Scope:**
- Create `stock_transactions` table
- Add NULL-safe scope keys (Contract Appendix C)
- Configure indexes

**Acceptance Gates:**
- [ ] Table created
- [ ] Scope keys generated correctly

#### Session 6.2: dispatchStockChanged Implementation
**Scope:**
- Create `dispatchStockChanged()` function
- Validate UOM (MT/KG only)
- Build payload per contract schema
- Include snapshot values (on_hand, reserved, available)

**Acceptance Gates:**
- [ ] Payload matches contract exactly
- [ ] Invalid UOM rejected
- [ ] delta_meters calculated

#### Session 6.3: Integration + Cache Update
**Scope:**
- Wire stock changes to dispatcher
- Update `stock_by_quality_cache`
- QA verification

**Acceptance Gates:**
- [ ] Inventory change triggers event
- [ ] Cache updated correctly
- [ ] Idempotency verified

### BATCH 7: Allocation Planning + Entry (5 Sessions)

**Purpose:** Create allocation planning and entry UI pages.

#### Session 7.1: Allocation Planning Page Structure
**Scope:**
- Create `/allocation-planning` route
- Implement basic page layout
- Add org scope filtering
- Connect to reservations data

**Acceptance Gates:**
- [ ] Page renders
- [ ] Org filtering works

#### Session 7.2: Allocation Planning Grid
**Scope:**
- Build reservation lines grid
- Show incoming supply matches
- Implement planning actions

**Acceptance Gates:**
- [ ] Grid displays data
- [ ] Filtering works

#### Session 7.3: Allocation Entry Page Structure
**Scope:**
- Create `/allocation-entry` route
- Implement lot/roll selection UI
- Connect to planned allocations

**Acceptance Gates:**
- [ ] Page renders
- [ ] Planned items displayed

#### Session 7.4: Allocation Entry Actions
**Scope:**
- Implement lot/roll/meters assignment
- Update allocation_state
- Emit reservation.allocated event

**Acceptance Gates:**
- [ ] Allocation persisted
- [ ] State updated correctly
- [ ] Event dispatched

#### Session 7.5: Allocation QA + Polish
**Scope:**
- Full workflow testing
- Error handling
- Performance optimization

**Acceptance Gates:**
- [ ] End-to-end workflow passes
- [ ] FUL-01 tests pass

### BATCH 8: Shipment Approval + Override (4 Sessions)

**Purpose:** Handle inbound shipment.approved and implement override queue.

#### Session 8.1: shipment.approved Handler
**Scope:**
- Implement `handleShipmentApproved()` event handler
- Validate allocation_state = allocated
- Create order from approved shipment

**Acceptance Gates:**
- [ ] Event processed
- [ ] Order created
- [ ] Validation enforced

#### Session 8.2: Approval Override Queue Page
**Scope:**
- Create `/approvals/shipment` route
- Display pending approvals requiring override
- Show reason codes

**Acceptance Gates:**
- [ ] Page renders
- [ ] Pending items displayed

#### Session 8.3: Override Actions + Reason Capture
**Scope:**
- Implement override form
- Capture reason code and notes
- Record override_by and override_at

**Acceptance Gates:**
- [ ] Override persisted
- [ ] Reason code required
- [ ] Audit trail complete

#### Session 8.4: Override Integration + QA
**Scope:**
- Connect override to order creation
- Emit order.created after override
- QA verification

**Acceptance Gates:**
- [ ] Override triggers order
- [ ] FUL-02 tests pass

### BATCH 9: Central Stock Checks - Abra (5 Sessions)

**Purpose:** Implement central stock check workflow for on-hand verification.

#### Session 9.1: Central Stock Checks Table
**Scope:**
- Create `central_stock_checks` table
- Add status workflow columns
- Configure indexes and RLS

**Acceptance Gates:**
- [ ] Table created
- [ ] Status enum enforced

#### Session 9.2: Stock Checks Queue Page
**Scope:**
- Create `/central-stock-checks` route
- Display pending checks queue
- Add filtering by status

**Acceptance Gates:**
- [ ] Page renders
- [ ] Queue displayed

#### Session 9.3: Check Result Entry
**Scope:**
- Implement result form (found_in_abra, not_in_abra, uncertain)
- Capture available_qty and proposed_next_step
- Update check status

**Acceptance Gates:**
- [ ] Results persisted
- [ ] ETA captured when needed

#### Session 9.4: central_stock_check.completed Event
**Scope:**
- Emit completion event to CRM
- Include all required fields
- Wire to UI action

**Acceptance Gates:**
- [ ] Event dispatched
- [ ] Schema matches contract

#### Session 9.5: Abra Integration + QA
**Scope:**
- Enforce check completion before "Send back"
- Weekly digest email support
- QA verification

**Acceptance Gates:**
- [ ] ABR-01 to ABR-04 tests pass
- [ ] ABRA-01, ABRA-02 tests pass

### BATCH 10: Post-PO Issues (4 Sessions)

**Purpose:** Implement discrepancy reporting and resolution loop.

#### Session 10.1: Post-PO Issues Table
**Scope:**
- Create `post_po_issues` table
- Add issue_type, status, line-level blocking
- Configure indexes

**Acceptance Gates:**
- [ ] Table created
- [ ] Issue types enforced

#### Session 10.2: Issue Reporting UI
**Scope:**
- Add issue flagging on order lines
- Capture issue details and reason
- Block affected lines

**Acceptance Gates:**
- [ ] Issues can be created
- [ ] Lines blocked correctly

#### Session 10.3: Post-PO Issue Events
**Scope:**
- Emit `post_po_issue.created`
- Emit `post_po_issue.updated`
- Emit `post_po_issue.resolved`

**Acceptance Gates:**
- [ ] Events dispatched correctly
- [ ] Idempotency maintained

#### Session 10.4: Issue Resolution + QA
**Scope:**
- Implement resolution workflow
- Sync to CRM timeline
- QA verification

**Acceptance Gates:**
- [ ] DPO-01 to DPO-04 tests pass

### BATCH 11: Costing Module (5 Sessions)

**Purpose:** Implement supplier invoice capture and landed cost allocation.

#### Session 11.1: Costing Tables
**Scope:**
- Create `supplier_invoices` table
- Create `supplier_invoice_lines` table
- Create `landed_cost_allocations` table

**Acceptance Gates:**
- [ ] Tables created
- [ ] Relationships correct

#### Session 11.2: Invoice Capture UI
**Scope:**
- Create invoice entry form
- Capture header + lines
- FX rate selection with override

**Acceptance Gates:**
- [ ] Invoice persisted
- [ ] FX rate recorded with audit

#### Session 11.3: Landed Cost Allocation
**Scope:**
- Allocate costs to receipts/lots
- Support later adjustments with audit
- Update WAC calculation

**Acceptance Gates:**
- [ ] Costs allocated
- [ ] WAC updated in TRY

#### Session 11.4: Costing Events
**Scope:**
- Emit `costing.invoice_posted`
- Emit `costing.receipt_linked`
- Emit `costing.adjustment_posted`
- Emit `costing.wac_updated`

**Acceptance Gates:**
- [ ] All events dispatched
- [ ] Schema correct

#### Session 11.5: Costing QA + Mirror to CRM
**Scope:**
- Send cost mirrors to CRM
- Store overhead pools per org
- QA verification

**Acceptance Gates:**
- [ ] CST-01 to CST-06 tests pass

### BATCH 12: Invoice Control (3 Sessions)

**Purpose:** Implement invoice control queue and fulfillment gate.

#### Session 12.1: Invoice Control Columns + Queue
**Scope:**
- Add invoice_status, invoice_control_status to orders
- Create invoice control queue page
- Pagination + Excel export

**Acceptance Gates:**
- [ ] Columns added
- [ ] Queue page renders

#### Session 12.2: Pass/Fail Actions
**Scope:**
- Implement pass action
- Implement fail action with required note
- Role gating (WMS Ops only)

**Acceptance Gates:**
- [ ] Status transitions work
- [ ] Failure requires note

#### Session 12.3: Invoice Control Events + QA
**Scope:**
- Emit `invoice_control.passed`
- Emit `invoice_control.failed`
- QA verification

**Acceptance Gates:**
- [ ] INV-01 to INV-03 tests pass

### BATCH 13: PO Command Center (4 Sessions)

**Purpose:** Create unified PO management dashboard.

#### Session 13.1: Command Center Page Structure
**Scope:**
- Create `/po-command-center` route
- Implement stage cards layout
- Connect to orders data

**Acceptance Gates:**
- [ ] Page renders
- [ ] Stage counts displayed

#### Session 13.2: Universal Orders Table
**Scope:**
- Build orders table with all statuses
- Implement column configuration
- Add inline actions

**Acceptance Gates:**
- [ ] Table renders
- [ ] Filtering works

#### Session 13.3: Human Gates Tabs
**Scope:**
- Add Warehouse Confirmation tab
- Add Payment Confirmation tab
- Add Shipment Approval tab
- Add Shortage Decisions tab

**Acceptance Gates:**
- [ ] Tabs render
- [ ] Filtered correctly

#### Session 13.4: Command Center Polish + QA
**Scope:**
- Performance optimization
- Real-time updates
- Full QA verification

**Acceptance Gates:**
- [ ] Sub-second load times
- [ ] All filters work

### Execution Timeline

#### Phase 1: Foundation (Batches 0-2) — 11 sessions
Critical infrastructure for all subsequent work.

#### Phase 2: Schema & Events (Batches 3-6) — 13 sessions
Core data model extensions and event infrastructure.

#### Phase 3: Workflows (Batches 7-9) — 14 sessions
Allocation and verification workflows.

#### Phase 4: Operations (Batches 10-13) — 16 sessions
Operational features and command center.

### Quick Reference: Session IDs

| Session | Description |
|---------|-------------|
| 0.1 | Contract violations table |
| 0.2 | Contract schemas (TS) |
| 0.3 | HMAC validation (TS) |
| 1.1 | Integration inbox table |
| 1.2 | Webhook receiver core |
| 1.3 | Webhook receiver QA |
| 2.1 | Org grants mirror table |
| 2.2 | Active org preferences |
| 2.3 | Org access functions |
| 2.4 | UI policy function |
| 2.5 | org_access.updated handler |
| 3.1 | Reservation table extensions |
| 3.2 | Reservation line extensions |
| 3.3 | Reservation event handlers |
| 4.1 | Orders table extensions |
| 4.2 | PO number generator |
| 4.3 | Order lots + status tracking |
| 4.4 | order.created event |
| 5.1 | Supply requests mirror table |
| 5.2 | Supply request handlers |
| 5.3 | Supply tracking integration |
| 6.1 | Stock transactions table |
| 6.2 | dispatchStockChanged |
| 6.3 | Stock change integration |
| 7.1 | Allocation planning structure |
| 7.2 | Allocation planning grid |
| 7.3 | Allocation entry structure |
| 7.4 | Allocation entry actions |
| 7.5 | Allocation QA |
| 8.1 | shipment.approved handler |
| 8.2 | Override queue page |
| 8.3 | Override actions |
| 8.4 | Override integration |
| 9.1 | Central stock checks table |
| 9.2 | Stock checks queue page |
| 9.3 | Check result entry |
| 9.4 | check.completed event |
| 9.5 | Abra integration QA |
| 10.1 | Post-PO issues table |
| 10.2 | Issue reporting UI |
| 10.3 | Post-PO issue events |
| 10.4 | Issue resolution QA |
| 11.1 | Costing tables |
| 11.2 | Invoice capture UI |
| 11.3 | Landed cost allocation |
| 11.4 | Costing events |
| 11.5 | Costing QA |
| 12.1 | Invoice control queue |
| 12.2 | Pass/fail actions |
| 12.3 | Invoice control events |
| 13.1 | Command center structure |
| 13.2 | Universal orders table |
| 13.3 | Human gates tabs |
| 13.4 | Command center polish |

### Session Notes

1. **Session duration estimate:** 45-90 minutes each
2. **Buffer sessions:** Add 10-15% buffer for unexpected complexity
3. **Parallel work:** Sessions within a batch can sometimes be parallelized if multiple developers
4. **QA sessions:** Each batch ends with integration QA — don't skip
5. **Checkpoint rule:** Never proceed to next batch until all acceptance gates pass

---

## Operational Infrastructure

### Inbound Event Logging

| Aspect | Specification |
|--------|---------------|
| **Table** | `integration_inbox` |
| **Columns** | `event_type`, `payload`, `idempotency_key`, `status`, `processed_at`, `error_message`, `payload_hash`, `attempt_count` |
| **Statuses** | `pending` → `processing` → `processed` / `failed` |
| **Validation** | 5-segment idempotency key, HMAC signature, schema validation, unknown field rejection |
| **Edge Function** | `wms-webhook-receiver` logs all received events |

### Outbound Event Queuing/Retry

| Aspect | Specification |
|--------|---------------|
| **Table** | `integration_outbox` (existing) |
| **Target** | `target_system = 'crm'` |
| **Retry Fields** | `next_retry_at`, `retry_count`, `max_retries` |
| **Edge Functions** | `webhook-dispatcher`, `process-webhook-retries` |

### Idempotency Enforcement

| Aspect | Specification |
|--------|---------------|
| **Format** | `<source>:<entity>:<entity_id>:<action>:v1` (exactly 5 segments) |
| **Index** | `idx_outbox_idempotency` on `integration_outbox(idempotency_key)` |
| **Behavior** | Check if key exists; if `status = 'processed'`, return 200; if `status = 'failed'`, update to pending |
| **Sequence Handling** | Out-of-order protection using monotonic `*_seq` fields |

### NULL-Safe Uniqueness (Contract Appendix C)

For all cache/mirror tables with nullable dimensions:

```sql
-- Canonical sentinel values
-- UUID nullable: 00000000-0000-0000-0000-000000000000
-- TEXT nullable: __NULL__

-- Scope key pattern (apply to all cache tables)
org_scope_key := COALESCE(crm_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
warehouse_scope_key := COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
color_scope_key := COALESCE(color_code, '__NULL__')
```

---

## Batch 0: Contract Alignment & Guards

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1 |
| **Priority** | P0 — Prerequisite |
| **Dependencies** | None |
| **CRM Required** | No |

### Purpose

Establish drift prevention infrastructure BEFORE any integration work begins.

### DB Scope

#### New Table: `integration_contract_violations`

```sql
CREATE TABLE integration_contract_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'unknown_field', 'missing_required_field', 'invalid_enum_value',
    'invalid_idempotency_format', 'schema_mismatch', 'uom_violation'
  )),
  field_name TEXT,
  field_value TEXT,
  expected_schema JSONB,
  received_payload JSONB,
  idempotency_key TEXT,
  source_system TEXT,
  logged_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);

CREATE INDEX idx_contract_violations_type ON integration_contract_violations(violation_type, logged_at DESC);
CREATE INDEX idx_contract_violations_event ON integration_contract_violations(event_type, logged_at DESC);
```

#### Idempotency Key Validation Function (REVISED)

```sql
-- Validates idempotency key format per Contract v1.0.23
CREATE OR REPLACE FUNCTION validate_idempotency_key(p_key TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT
) 
LANGUAGE plpgsql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts TEXT[];
BEGIN
  -- Check for NULL or empty
  IF p_key IS NULL OR p_key = '' THEN
    RETURN QUERY SELECT false, 'Idempotency key is empty or null';
    RETURN;
  END IF;
  
  v_parts := string_to_array(p_key, ':');
  
  -- Must have exactly 5 segments
  IF array_length(v_parts, 1) != 5 THEN
    RETURN QUERY SELECT false, format('Expected 5 segments, got %s', array_length(v_parts, 1));
    RETURN;
  END IF;
  
  -- Segment 1: source system
  IF v_parts[1] NOT IN ('wms', 'crm') THEN
    RETURN QUERY SELECT false, format('Invalid source system: %s (must be wms or crm)', v_parts[1]);
    RETURN;
  END IF;
  
  -- Segment 2: entity (non-empty)
  IF v_parts[2] IS NULL OR v_parts[2] = '' THEN
    RETURN QUERY SELECT false, 'Entity segment (2) is empty';
    RETURN;
  END IF;
  
  -- Segment 3: entity_id (non-empty, may contain dashes but not colons)
  IF v_parts[3] IS NULL OR v_parts[3] = '' THEN
    RETURN QUERY SELECT false, 'Entity ID segment (3) is empty';
    RETURN;
  END IF;
  
  -- Segment 4: action (non-empty)
  IF v_parts[4] IS NULL OR v_parts[4] = '' THEN
    RETURN QUERY SELECT false, 'Action segment (4) is empty';
    RETURN;
  END IF;
  
  -- Segment 5: version (must be v1)
  IF v_parts[5] != 'v1' THEN
    RETURN QUERY SELECT false, format('Invalid version: %s (must be v1)', v_parts[5]);
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;
```

#### UOM Validation Function

```sql
-- Per Contract: UOM MUST be MT or KG only (uppercase)
CREATE OR REPLACE FUNCTION validate_contract_uom(p_uom TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_uom IN ('MT', 'KG');
$$;
```

### Backend Scope

#### Contract Schema Definitions (TypeScript)

```typescript
// File: supabase/functions/_shared/contract-schemas.ts

/**
 * Contract v1.0.23 Schema Definitions
 * Source: integration_contract_v1_0_23(1)(1).md
 * DO NOT MODIFY without contract amendment
 */

// Valid UOM values per contract
export const CONTRACT_UOM_VALUES = ['MT', 'KG'] as const;
export type ContractUOM = typeof CONTRACT_UOM_VALUES[number];

// Idempotency key validation
export function validateIdempotencyKey(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: 'Idempotency key is empty' };
  }
  
  const parts = key.split(':');
  
  if (parts.length !== 5) {
    return { valid: false, error: `Expected 5 segments, got ${parts.length}` };
  }
  
  if (!['wms', 'crm'].includes(parts[0])) {
    return { valid: false, error: `Invalid source: ${parts[0]}` };
  }
  
  if (!parts[1] || !parts[2] || !parts[3]) {
    return { valid: false, error: 'Empty segment in key' };
  }
  
  if (parts[4] !== 'v1') {
    return { valid: false, error: `Invalid version: ${parts[4]}` };
  }
  
  return { valid: true };
}

// Schema validation with unknown field detection
export function validatePayloadSchema<T>(
  payload: Record<string, unknown>,
  schema: Record<string, 'required' | 'optional'>,
  eventType: string
): { valid: boolean; unknownFields: string[]; missingFields: string[] } {
  const unknownFields: string[] = [];
  const missingFields: string[] = [];
  
  // Check for unknown fields
  for (const key of Object.keys(payload)) {
    if (!(key in schema)) {
      unknownFields.push(key);
    }
  }
  
  // Check for missing required fields
  for (const [key, requirement] of Object.entries(schema)) {
    if (requirement === 'required' && !(key in payload)) {
      missingFields.push(key);
    }
  }
  
  return {
    valid: unknownFields.length === 0 && missingFields.length === 0,
    unknownFields,
    missingFields
  };
}

// Log contract violation
export async function logContractViolation(
  supabase: any,
  violation: {
    event_type: string;
    violation_type: 'unknown_field' | 'missing_required_field' | 'invalid_enum_value' | 
                   'invalid_idempotency_format' | 'schema_mismatch' | 'uom_violation';
    field_name?: string;
    field_value?: string;
    expected_schema?: object;
    received_payload?: object;
    idempotency_key?: string;
    source_system?: string;
  }
): Promise<void> {
  await supabase.from('integration_contract_violations').insert(violation);
  console.warn(`[CONTRACT VIOLATION] ${violation.violation_type}: ${violation.field_name || violation.event_type}`);
}

// Event schemas per Contract v1.0.23
export const EVENT_SCHEMAS = {
  'org_access.updated': {
    event: 'required',
    idempotency_key: 'required',
    user_id: 'required',
    org_access_seq: 'required',
    grants: 'required',
    updated_at: 'required',
    updated_by: 'optional'
  },
  'stock.changed': {
    event: 'required',
    idempotency_key: 'required',
    transaction_batch_id: 'required',
    crm_organization_id: 'optional',
    changed_at: 'required',
    reason: 'required',
    items: 'required',
    changed_by: 'optional'
  },
  // Add all other event schemas...
} as const;
```

#### HMAC + Schema Validation (TypeScript)

```typescript
// File: supabase/functions/_shared/contract-validation.ts

import { createHmac, timingSafeEqual } from 'node:crypto';
import { 
  validateIdempotencyKey, 
  validatePayloadSchema, 
  logContractViolation,
  EVENT_SCHEMAS,
  CONTRACT_UOM_VALUES
} from './contract-schemas.ts';

const STRICT_MODE = true; // Reject unknown fields

export interface ValidationResult {
  valid: boolean;
  status: number;
  error?: string;
  violations: string[];
}

export async function validateInboundEvent(
  supabase: any,
  req: Request,
  payload: Record<string, unknown>
): Promise<ValidationResult> {
  const violations: string[] = [];
  
  // 1. Validate HMAC signature
  const signature = req.headers.get('x-webhook-signature');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  
  if (!signature || !webhookSecret) {
    return { valid: false, status: 401, error: 'Missing signature', violations: [] };
  }
  
  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (sigBuffer.length !== expectedBuffer.length || 
      !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, status: 401, error: 'Invalid signature', violations: [] };
  }
  
  // 2. Validate idempotency key format
  const idempotencyKey = payload.idempotency_key as string;
  const keyValidation = validateIdempotencyKey(idempotencyKey);
  
  if (!keyValidation.valid) {
    await logContractViolation(supabase, {
      event_type: payload.event as string || 'unknown',
      violation_type: 'invalid_idempotency_format',
      field_value: idempotencyKey,
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    
    return { 
      valid: false, 
      status: 400, 
      error: `Invalid idempotency key: ${keyValidation.error}`,
      violations: [`idempotency_key: ${keyValidation.error}`]
    };
  }
  
  // 3. Validate event schema
  const eventType = payload.event as string;
  const schema = EVENT_SCHEMAS[eventType as keyof typeof EVENT_SCHEMAS];
  
  if (!schema) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'schema_mismatch',
      received_payload: payload,
      source_system: 'crm'
    });
    
    return {
      valid: false,
      status: 400,
      error: `Unknown event type: ${eventType}`,
      violations: [`Unknown event: ${eventType}`]
    };
  }
  
  const schemaValidation = validatePayloadSchema(payload, schema, eventType);
  
  // Log unknown fields
  for (const field of schemaValidation.unknownFields) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'unknown_field',
      field_name: field,
      field_value: String(payload[field]),
      received_payload: payload,
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    violations.push(`Unknown field: ${field}`);
  }
  
  // Reject if strict mode and unknown fields present
  if (STRICT_MODE && schemaValidation.unknownFields.length > 0) {
    return {
      valid: false,
      status: 400,
      error: `Unknown fields in payload: ${schemaValidation.unknownFields.join(', ')}`,
      violations
    };
  }
  
  // Check missing required fields
  for (const field of schemaValidation.missingFields) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'missing_required_field',
      field_name: field,
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    violations.push(`Missing required field: ${field}`);
  }
  
  if (schemaValidation.missingFields.length > 0) {
    return {
      valid: false,
      status: 400,
      error: `Missing required fields: ${schemaValidation.missingFields.join(', ')}`,
      violations
    };
  }
  
  // 4. Validate UOM if present
  if ('uom' in payload && !CONTRACT_UOM_VALUES.includes(payload.uom as any)) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'uom_violation',
      field_name: 'uom',
      field_value: String(payload.uom),
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    
    return {
      valid: false,
      status: 400,
      error: `Invalid UOM: ${payload.uom} (must be MT or KG)`,
      violations: [`Invalid UOM: ${payload.uom}`]
    };
  }
  
  return { valid: true, status: 200, violations };
}
```

### Contract Compliance Checklist

- [x] Event names match contract exactly (infrastructure only)
- [x] Idempotency key validation: 5 segments, ends with :v1
- [x] Unknown field detection and logging implemented
- [x] UOM validation restricted to MT|KG only

### Done Proof

| Check | Method |
|-------|--------|
| Violation table exists | `SELECT * FROM integration_contract_violations LIMIT 1` |
| Key validation works | `SELECT * FROM validate_idempotency_key('wms:order:123:created:v1')` returns valid=true |
| Invalid key rejected | `SELECT * FROM validate_idempotency_key('wms:order:123:created')` returns valid=false |
| UOM validation | `SELECT validate_contract_uom('MT')` = true, `SELECT validate_contract_uom('YD')` = false |

### QA Test IDs

- QA Addendum A: Contract authority verification
- QA Addendum B: Idempotency key format validation
- QA Addendum C: Inbox retry semantics

---

## Batch 1: Contract File + Integration Inbox

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1 |
| **Priority** | P0 — Foundation |
| **Dependencies** | Batch 0 |
| **CRM Required** | No |

### Contract Scope

- **Events**: None (ingestion/logging only — no business handlers)
- **Purpose**: Establish canonical contract file and create inbound event logging table

### DB Scope

#### New Table: `integration_inbox`

```sql
CREATE TABLE integration_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  source_system TEXT DEFAULT 'crm',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempt_count INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbox_idempotency ON integration_inbox(idempotency_key);
CREATE INDEX idx_inbox_status ON integration_inbox(status, created_at);
CREATE INDEX idx_inbox_event_type ON integration_inbox(event_type, created_at DESC);
CREATE INDEX idx_inbox_retry ON integration_inbox(status, next_retry_at) WHERE status = 'failed';
```

#### RLS Policies (Per Contract Appendix D.2)

```sql
ALTER TABLE integration_inbox ENABLE ROW LEVEL SECURITY;

-- No direct end-user access (service role only + admin view)
REVOKE ALL ON TABLE integration_inbox FROM authenticated;

-- Admin-only visibility for debugging
CREATE POLICY "inbox_select_admin_only"
  ON integration_inbox
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Backend Scope

#### Edge Function: `wms-webhook-receiver` (Updated)

Implements Contract Appendix D.3 retry semantics:

```typescript
// Receiver MUST implement "Failed → Pending (Update, Not Insert)"
async function handleInboundEvent(supabase: any, payload: any, idempotencyKey: string, payloadHash: string) {
  // Check for existing entry
  const { data: existing } = await supabase
    .from('integration_inbox')
    .select('id, status, payload_hash, attempt_count')
    .eq('idempotency_key', idempotencyKey)
    .single();
  
  if (existing) {
    // Already processed/processing - return 200
    if (['processed', 'processing', 'pending'].includes(existing.status)) {
      // Log drift if payload hash differs
      if (existing.payload_hash !== payloadHash) {
        console.warn(`[DRIFT] Payload hash differs for ${idempotencyKey}`);
        await supabase.from('integration_inbox')
          .update({ last_error: `[DRIFT] Payload hash changed: ${existing.payload_hash} → ${payloadHash}` })
          .eq('id', existing.id);
      }
      return { status: 200, message: 'Already processed' };
    }
    
    // Failed - convert to pending for retry (per Appendix D.3.2)
    if (existing.status === 'failed') {
      await supabase.from('integration_inbox')
        .update({
          status: 'pending',
          attempt_count: (existing.attempt_count ?? 0) + 1,
          last_error: null,
          next_retry_at: null,
          last_attempt_at: null
        })
        .eq('id', existing.id);
      
      return { status: 200, message: 'Queued for retry' };
    }
  }
  
  // New event - insert
  await supabase.from('integration_inbox').insert({
    event_type: payload.event,
    payload,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    status: 'pending',
    attempt_count: 0
  });
  
  return { status: 201, message: 'Event received' };
}
```

### Contract Compliance Checklist

- [x] Event names match contract exactly (infrastructure only)
- [x] Idempotency key format: 5 segments, ends with :v1
- [x] Retry semantics per Contract Appendix D.3
- [x] RLS prevents NULL-org leak per Contract Appendix D.2

### Done Proof

| Check | Method |
|-------|--------|
| Contract file updated | Verify `docs/wms_crm_v1_0_23_integration_updated/integration_contract_v1_0_23(1)(1).md` is authoritative |
| Table exists | `SELECT * FROM integration_inbox LIMIT 1` succeeds |
| Event logging works | Send test event with valid HMAC, verify row in inbox with status='pending' |
| Invalid key rejected | Send event with 4-segment key, verify HTTP 400 response |
| Retry semantics | Send duplicate with status=failed, verify status flips to pending |

### QA Test IDs

- B-01: Idempotency key format validation
- B-02: Duplicate event handling
- QA Addendum C: Inbox retry semantics

---

## Batch 2: Multi-Org Identity + org_access.updated Handler

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2 |
| **Priority** | P0 — Foundation |
| **Dependencies** | Batch 1 |
| **CRM Required** | Yes — must emit `org_access.updated` |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `org_access.updated` | CRM → WMS | `crm:org_access:{user_id}-{org_access_seq}:updated:v1` |

**Contract Reference**: Section "New Event Definition: org_access.updated"

### DB Scope

#### New Table: `user_org_grants_mirror`

```sql
CREATE TABLE user_org_grants_mirror (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  crm_organization_id UUID NOT NULL,
  role_in_org TEXT NOT NULL CHECK (role_in_org IN (
    'sales_owner', 'sales_manager', 'pricing', 'accounting', 'admin'
  )),
  is_active BOOLEAN DEFAULT true,
  org_access_seq INTEGER NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, crm_organization_id)
);

CREATE INDEX idx_org_grants_user ON user_org_grants_mirror(user_id);
CREATE INDEX idx_org_grants_org ON user_org_grants_mirror(crm_organization_id);
CREATE INDEX idx_org_grants_active ON user_org_grants_mirror(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_org_grants_seq ON user_org_grants_mirror(user_id, org_access_seq DESC);
```

#### New Table: `user_active_org_preferences`

```sql
-- Active Org Preference (per Checklist: "Store an Active Org per user")
CREATE TABLE user_active_org_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_org_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_active_org ON user_active_org_preferences(active_org_id);

-- RLS: User can only see/update their own preference
ALTER TABLE user_active_org_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_org_preference"
  ON user_active_org_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

#### New Functions

```sql
-- Check if CURRENT USER has access to specific org (caller-bound)
CREATE OR REPLACE FUNCTION user_has_org_access(p_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = auth.uid() 
      AND crm_organization_id = p_org_id 
      AND is_active = true
  );
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION user_has_org_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_has_org_access(UUID) TO authenticated;

-- Get all org IDs CURRENT USER has access to (caller-bound)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT COALESCE(
    array_agg(crm_organization_id),
    ARRAY[]::UUID[]
  )
  FROM user_org_grants_mirror
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION get_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_org_ids() TO authenticated;

-- Get active org for CURRENT USER with fallback to first available grant
-- Returns NULL for unauthenticated users (UI must handle this defensively)
CREATE OR REPLACE FUNCTION get_active_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_active_org UUID;
  v_first_grant UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;  -- UI must handle: don't treat NULL as "show all"
  END IF;
  
  -- Get stored preference
  SELECT active_org_id INTO v_active_org
  FROM user_active_org_preferences
  WHERE user_id = v_user_id;
  
  -- If no preference or stored org is no longer accessible, use first available grant
  IF v_active_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = v_active_org
      AND is_active = true
  ) THEN
    SELECT crm_organization_id INTO v_first_grant
    FROM user_org_grants_mirror
    WHERE user_id = v_user_id AND is_active = true
    ORDER BY synced_at ASC
    LIMIT 1;
    
    v_active_org := v_first_grant;
  END IF;
  
  RETURN v_active_org;
END;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION get_active_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_org_id() TO authenticated;

-- Set active org for CURRENT USER with validation
-- Returns false if user doesn't have access (UI should show toast/revert)
CREATE OR REPLACE FUNCTION set_active_org_id(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Validate CURRENT USER has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = p_org_id
      AND is_active = true
  ) THEN
    RETURN false;  -- UI should show error toast
  END IF;
  
  -- Upsert preference
  INSERT INTO user_active_org_preferences (user_id, active_org_id, updated_at)
  VALUES (v_user_id, p_org_id, now())
  ON CONFLICT (user_id)
  DO UPDATE SET active_org_id = p_org_id, updated_at = now();
  
  RETURN true;
END;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION set_active_org_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_active_org_id(UUID) TO authenticated;

-- UI policy function: CALLER-BOUND (no p_user_id parameter)
-- Uses auth.uid() internally to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.user_wms_ui_policy()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_warehouse_role BOOLEAN;
  v_can_toggle_all_orgs BOOLEAN;
BEGIN
  -- Caller-bound: use authenticated user, not parameter
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'show_org_toggle', false,
      'show_org_labels_in_all_scope', false,
      'default_scope', 'active',
      'error', 'unauthenticated'
    );
  END IF;
  
  -- WMS operational role override: warehouse users do NOT get org toggle/labels
  v_is_warehouse_role := public.has_role(v_user_id, 'warehouse_staff'::user_role);

  IF v_is_warehouse_role THEN
    v_can_toggle_all_orgs := false;
  ELSE
    -- Contract-defined CRM taxonomy gating (NOT org-count):
    -- Allowed: sales_manager, accounting, pricing, admin
    -- Disallowed: sales_owner
    v_can_toggle_all_orgs := EXISTS (
      SELECT 1
      FROM public.user_org_grants_mirror g
      WHERE g.user_id = v_user_id
        AND g.is_active = true
        AND g.role_in_org IN ('sales_manager', 'accounting', 'pricing', 'admin')
    );
  END IF;

  RETURN jsonb_build_object(
    'show_org_toggle', v_can_toggle_all_orgs,
    'show_org_labels_in_all_scope', v_can_toggle_all_orgs AND NOT v_is_warehouse_role,
    'default_scope', 'active'
  );
END;
$$;

-- Defense-in-depth: revoke from PUBLIC, grant only to authenticated
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO authenticated;
```

#### Permission Grant Summary (Defense-in-Depth)

All security-sensitive functions follow the REVOKE-then-GRANT pattern to ensure anonymous callers cannot execute them under any Postgres configuration:

```sql
-- Applied to all caller-bound functions
REVOKE ALL ON FUNCTION public.user_wms_ui_policy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_org_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.user_wms_ui_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
```

**Verification query:**
```sql
-- Should return false for all functions
SELECT 
  'user_wms_ui_policy' as fn, 
  has_function_privilege('anon', 'user_wms_ui_policy()', 'EXECUTE') as anon_can_exec
UNION ALL
SELECT 'get_active_org_id', has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')
UNION ALL
SELECT 'set_active_org_id', has_function_privilege('anon', 'set_active_org_id(uuid)', 'EXECUTE')
UNION ALL
SELECT 'user_has_org_access', has_function_privilege('anon', 'user_has_org_access(uuid)', 'EXECUTE')
UNION ALL
SELECT 'get_user_org_ids', has_function_privilege('anon', 'get_user_org_ids()', 'EXECUTE');
```

### Backend Scope

#### Event Handler: `handleOrgAccessUpdated`

```typescript
interface OrgAccessGrant {
  crm_organization_id: string;
  role_in_org: 'sales_owner' | 'sales_manager' | 'pricing' | 'accounting' | 'admin';
  is_active: boolean;
}

interface OrgAccessUpdatedPayload {
  event: 'org_access.updated';
  idempotency_key: string;
  user_id: string;
  org_access_seq: number;
  grants: OrgAccessGrant[];
  updated_at: string;
  updated_by?: string;
}

async function handleOrgAccessUpdated(supabase: any, payload: OrgAccessUpdatedPayload) {
  const { user_id, org_access_seq, grants } = payload;
  
  // Sequence guard - reject out-of-order events
  const { data: existing } = await supabase
    .from('user_org_grants_mirror')
    .select('org_access_seq')
    .eq('user_id', user_id)
    .order('org_access_seq', { ascending: false })
    .limit(1)
    .single();
  
  if (existing && existing.org_access_seq >= org_access_seq) {
    console.warn(`[org_access.updated] Out-of-order: received seq ${org_access_seq}, have ${existing.org_access_seq}`);
    return { status: 'skipped', reason: 'out_of_order_sequence' };
  }
  
  // Replace all grants for user with new snapshot (per contract)
  await supabase
    .from('user_org_grants_mirror')
    .delete()
    .eq('user_id', user_id);
  
  if (grants && grants.length > 0) {
    await supabase
      .from('user_org_grants_mirror')
      .insert(grants.map(g => ({
        user_id,
        crm_organization_id: g.crm_organization_id,
        role_in_org: g.role_in_org,
        is_active: g.is_active,
        org_access_seq
      })));
  }
  
  return { status: 'processed' };
}
```

### Contract Compliance Checklist

- [x] Event name: `org_access.updated` (matches contract)
- [x] Idempotency key format: `crm:org_access:{user_id}-{org_access_seq}:updated:v1`
- [x] Payload schema matches contract exactly
- [x] Sequence guard for out-of-order protection
- [x] Snapshot replacement (not merge)

### Done Proof

| Check | Method |
|-------|--------|
| Table populated | Send `org_access.updated` event, verify rows in `user_org_grants_mirror` |
| Active Org table exists | `SELECT * FROM user_active_org_preferences LIMIT 1` succeeds |
| Function works | `SELECT user_has_org_access('org-uuid')` returns correct boolean (caller-bound) |
| get_active_org_id() works | `SELECT get_active_org_id()` returns valid org UUID or NULL |
| set_active_org_id() works | `SELECT set_active_org_id('valid-org-uuid')` returns true |
| Invalid org rejected | `SELECT set_active_org_id('no-access-org-uuid')` returns false |
| UI policy (warehouse) | For a `warehouse_staff` user with **multiple** org grants: `SELECT (user_wms_ui_policy()->>'show_org_toggle')::boolean` returns false |
| UI policy (manager) | For a user with any grant `role_in_org IN ('sales_manager','accounting','pricing','admin')`: policy returns `show_org_toggle=true` and `show_org_labels_in_all_scope=true` |
| UI policy (sales_owner) | For a user with only `role_in_org='sales_owner'` grants (even across orgs): policy returns `show_org_toggle=false` |
| Anon blocked from policy fn | `SELECT has_function_privilege('anon', 'user_wms_ui_policy()', 'EXECUTE')` returns false |
| Anon blocked from org fn | `SELECT has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')` returns false |
| EXECUTE grants applied | `SELECT has_function_privilege('authenticated', 'get_active_org_id()', 'EXECUTE')` returns true |
| Sequence guard | Send older seq, verify warning log and no data change |

### QA Test IDs

- RLS-01: User sees only permitted org data
- RLS-02: Multi-org user can switch context
- RLS-03: Out-of-order sequence rejected
- F-01: Org grants snapshot replacement
- D-01: Missing org access handled gracefully
- QA Addendum (UI policy):
  - Warehouse multi-org grants do NOT show org toggle
  - Manager roles show toggle + org column only when scope=All
  - sales_owner never sees org toggle even if multi-org grants exist
- QA Addendum F: Ordering/sequence handling

**Security & Preference Tests:**
- SEC-01: Anonymous caller cannot execute `user_wms_ui_policy()` (permission denied) OR function returns `error: 'unauthenticated'` if exec is allowed — either outcome is acceptable, goal is no data leakage
- SEC-02: `set_active_org_id(p_org_id)` cannot affect another user's preference (caller-bound via `auth.uid()`)
- SEC-03: All SECURITY DEFINER functions use `auth.uid()` internally, not parameters
- SEC-04: All security functions have `REVOKE ALL FROM PUBLIC` applied — verify with `SELECT has_function_privilege('anon', 'get_active_org_id()', 'EXECUTE')` returns false
- PREF-01: Active Org preference persists across sessions
- PREF-02: `get_active_org_id()` falls back to first grant if stored org is inaccessible
- PREF-03: `set_active_org_id(p_org_id)` returns false for orgs user doesn't have access to
- PREF-04: UI blocks data display when `activeOrgId = null` in Active scope (no data leakage)
- UX-01: UI shows toast when `set_active_org_id()` returns false

---

## Batch 4: Orders Schema Extensions + PO Number Generator

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P0 — Schema Foundation |
| **Dependencies** | Batch 1, Batch 2 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `order.created` | WMS → CRM | `wms:order:{id}:created:v1` |

### DB Scope

#### Alter Table: `orders`

```sql
-- PO Number (primary identifier) - MANDATORY ORG PREFIX
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number TEXT UNIQUE;

-- CRM linkage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_organization_id UUID NOT NULL; -- MANDATORY

-- Add constraint to prevent PO creation without org
ALTER TABLE orders ADD CONSTRAINT orders_require_org 
  CHECK (crm_organization_id IS NOT NULL);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_deal_id UUID;

-- Override tracking with LOCKED reason codes per Checklist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_used BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_reason TEXT
  CHECK (override_reason IS NULL OR override_reason IN (
    'urgent_customer_request',
    'manager_discretion', 
    'system_unavailable',
    'credit_exception',
    'other'
  ));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_by UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;

-- Status sequence for event ordering
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status_seq INTEGER DEFAULT 0;

-- Invoice tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'not_issued'
  CHECK (invoice_status IN ('not_issued', 'pending', 'issued', 'paid'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_control_status TEXT DEFAULT 'pending_control'
  CHECK (invoice_control_status IN ('pending_control', 'passed', 'failed', 'bypassed'));

-- Carrier preference (Journey #84)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS use_customer_carrier BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_carrier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_carrier_account TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_carrier_instructions TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_po_number ON orders(po_number);
CREATE INDEX IF NOT EXISTS idx_orders_crm_org ON orders(crm_organization_id);
```

#### Alter Table: `order_lots`

```sql
-- CRM deal line linkage
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS crm_deal_line_id UUID;

-- Unit of measure - CONTRACT RESTRICTED TO MT|KG ONLY
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'MT'
  CHECK (uom IN ('MT', 'KG')); -- Per Contract: "uom MUST be MT or KG only"

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_lots_deal_line ON order_lots(crm_deal_line_id);
```

#### PO Number Generator (MANDATORY ORG PREFIX)

```sql
-- CRITICAL: No default prefix - org MUST be provided
-- Per Checklist: "Org-prefixed, non-sequential identifiers"
-- Format: {ORG}P{8-CHAR} e.g., MODP8F3K2Q7A

CREATE OR REPLACE FUNCTION generate_po_number(p_org_prefix TEXT)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
  v_chars TEXT := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Crockford Base32 (no I,L,O,U)
  v_result TEXT := '';
  i INTEGER;
BEGIN
  -- MANDATORY: Org prefix required
  IF p_org_prefix IS NULL OR p_org_prefix = '' THEN
    RAISE EXCEPTION 'Org prefix is required for PO number generation. Cannot generate PO without organization context.';
  END IF;
  
  -- Validate prefix format (2-4 uppercase letters)
  IF NOT (p_org_prefix ~ '^[A-Z]{2,4}$') THEN
    RAISE EXCEPTION 'Invalid org prefix format: %. Must be 2-4 uppercase letters.', p_org_prefix;
  END IF;
  
  LOOP
    -- Generate 8-character Crockford Base32 code
    v_result := '';
    FOR i IN 1..8 LOOP
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    
    v_code := p_org_prefix || 'P' || v_result;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM orders WHERE po_number = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique PO number after 100 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Add constraint to ensure PO follows format
ALTER TABLE orders ADD CONSTRAINT orders_po_format 
  CHECK (po_number ~ '^[A-Z]{2,4}P[0-9A-Z]{8}$');
```

#### Status Sequence Trigger

```sql
CREATE OR REPLACE FUNCTION increment_order_status_seq()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.order_status_seq := COALESCE(OLD.order_status_seq, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_seq ON orders;
CREATE TRIGGER trg_order_status_seq
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_order_status_seq();
```

### Backend Scope

#### Order Creation with Mandatory Org

```typescript
// CRITICAL: Org prefix MUST be derived from order's org context
async function createOrder(
  supabase: any, 
  orderData: OrderInput, 
  crmOrgId: string
): Promise<Order> {
  // Get org prefix from org mapping
  const { data: orgConfig } = await supabase
    .from('org_configurations') // or however org prefixes are stored
    .select('prefix')
    .eq('crm_organization_id', crmOrgId)
    .single();
  
  if (!orgConfig?.prefix) {
    throw new Error(`No org prefix configured for organization ${crmOrgId}`);
  }
  
  // Generate PO number with mandatory org prefix
  const { data: poNumber, error: poError } = await supabase
    .rpc('generate_po_number', { p_org_prefix: orgConfig.prefix });
  
  if (poError) {
    throw new Error(`Failed to generate PO number: ${poError.message}`);
  }
  
  const order = {
    ...orderData,
    po_number: poNumber,
    crm_organization_id: crmOrgId // MANDATORY
  };
  
  return order;
}
```

### Contract Compliance Checklist

- [x] Event name: `order.created` (matches contract)
- [x] Idempotency key format: `wms:order:{id}:created:v1`
- [x] PO number format: `{ORG}P{8-CHAR}` with mandatory org prefix
- [x] UOM restricted to MT|KG only per contract
- [x] Override reason codes locked to enum
- [x] Status sequence for order.status_changed events

### Done Proof

| Check | Method |
|-------|--------|
| PO number format | Create order, verify format `{ORG}P{8-CHAR}` |
| No default prefix | Call `generate_po_number(NULL)` fails with exception |
| Prefix validation | Call `generate_po_number('invalid')` fails |
| Uniqueness | Attempt duplicate, verify rejection |
| UOM constraint | Attempt insert with `uom='YD'`, verify rejection |

### QA Test IDs

- ID-01: PO number format `{ORG}P{CODE8}`
- ID-02: PO number uniqueness
- ID-03: Prefix changes apply future-only

---

## Batch 6: stock.changed Event

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1.5 |
| **Priority** | P1 — Integration |
| **Dependencies** | Batch 1 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `stock.changed` | WMS → CRM | `wms:stock:{transaction_batch_id}:changed:v1` |

**Contract Reference**: "Canonical Payload Definition: stock.changed (v1.0.23)"

### Payload Schema (LOCKED per Contract)

```json
{
  "event": "stock.changed",
  "idempotency_key": "wms:stock:{transaction_batch_id}:changed:v1",
  "transaction_batch_id": "uuid",
  "crm_organization_id": "uuid|null",
  "changed_at": "timestamptz",
  "reason": "receipt|fulfillment|adjustment|transfer|count",
  "items": [
    {
      "quality_code": "string",
      "color_code": "string|null",
      "warehouse_id": "uuid|null",
      "uom": "MT|KG",
      "on_hand_meters": 1250.00,
      "reserved_meters": 100.00,
      "available_meters": 1150.00,
      "delta_meters": 150.00
    }
  ],
  "changed_by": "uuid|null"
}
```

### DB Scope

#### New Table: `stock_transactions`

```sql
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL CHECK (reason IN ('receipt', 'fulfillment', 'adjustment', 'transfer', 'count')),
  crm_organization_id UUID, -- nullable per contract
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by UUID,
  emitted_at TIMESTAMPTZ,
  
  -- Scope keys for NULL-safe uniqueness (Contract Appendix C)
  org_scope_key UUID GENERATED ALWAYS AS (
    COALESCE(crm_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED
);

CREATE INDEX idx_stock_txn_batch ON stock_transactions(transaction_batch_id);
CREATE INDEX idx_stock_txn_reason ON stock_transactions(reason, changed_at DESC);
```

### Backend Scope

#### Dispatcher: `dispatchStockChanged`

```typescript
interface StockItem {
  quality_code: string;
  color_code: string | null;
  warehouse_id: string | null;
  uom: 'MT' | 'KG'; // Contract: MUST be MT or KG only
  on_hand_meters: number;
  reserved_meters: number;
  available_meters: number;
  delta_meters?: number;
}

async function dispatchStockChanged(
  supabase: any,
  transactionBatchId: string,
  reason: 'receipt' | 'fulfillment' | 'adjustment' | 'transfer' | 'count',
  items: StockItem[],
  crmOrgId?: string,
  changedBy?: string
): Promise<void> {
  // Validate UOM per contract
  for (const item of items) {
    if (!['MT', 'KG'].includes(item.uom)) {
      throw new Error(`Invalid UOM: ${item.uom}. Contract requires MT or KG only.`);
    }
  }
  
  const payload = {
    event: 'stock.changed',
    idempotency_key: `wms:stock:${transactionBatchId}:changed:v1`,
    transaction_batch_id: transactionBatchId,
    crm_organization_id: crmOrgId || null,
    changed_at: new Date().toISOString(),
    reason,
    items: items.map(item => ({
      quality_code: item.quality_code,
      color_code: item.color_code,
      warehouse_id: item.warehouse_id,
      uom: item.uom,
      on_hand_meters: item.on_hand_meters,
      reserved_meters: item.reserved_meters,
      available_meters: item.available_meters,
      delta_meters: item.delta_meters
    })),
    changed_by: changedBy || null
  };
  
  await dispatchWebhookEvent(supabase, payload);
}
```

### Contract Compliance Checklist

- [x] Event name: `stock.changed` (matches contract exactly)
- [x] Idempotency key: `wms:stock:{transaction_batch_id}:changed:v1` (5 segments)
- [x] Payload schema matches contract exactly
- [x] UOM restricted to MT|KG only
- [x] Snapshot values included (on_hand, reserved, available)
- [x] transaction_batch_id is stable per batch (not time-derived)

### Done Proof

| Check | Method |
|-------|--------|
| Event dispatched | Inventory change triggers `stock.changed` event |
| Idempotency | Replay same batch_id creates no duplicate effects |
| UOM validated | Attempt dispatch with `uom='YD'` fails |
| Snapshot values | Payload includes on_hand, reserved, available |

### QA Test IDs

- E-01: stock.changed scope keys
- QA Addendum E: stock.changed cache correctness

---

## Files/Functions Created or Modified

### SQL Migrations

| Batch | File/Migration | Description |
|-------|---------------|-------------|
| 0 | `create_contract_violations_table` | Contract violation audit table |
| 0 | `create_idempotency_validation_function` | `validate_idempotency_key()` |
| 0 | `create_uom_validation_function` | `validate_contract_uom()` |
| 1 | `create_integration_inbox_table` | Inbound event logging |
| 2 | `create_user_org_grants_mirror_table` | Multi-org RLS mirror |
| 2 | `create_org_access_functions` | `user_has_org_access()`, `get_user_org_ids()` |
| 4 | `alter_orders_add_integration_columns` | PO number, org linkage, overrides |
| 4 | `create_po_number_generator` | `generate_po_number()` - MANDATORY org prefix |
| 4 | `alter_order_lots_add_uom` | UOM restricted to MT|KG |
| 6 | `create_stock_transactions_table` | Stock change tracking |

### Edge Functions

| Batch | Function | Description |
|-------|----------|-------------|
| 0 | `_shared/contract-schemas.ts` | Contract schema definitions |
| 0 | `_shared/contract-validation.ts` | HMAC + schema validation |
| 1 | `wms-webhook-receiver` | Updated with retry semantics |
| 2 | (handler in receiver) | `handleOrgAccessUpdated` |
| 6 | `webhook-dispatcher` | Updated `dispatchStockChanged` |

### RLS Policies

| Batch | Table | Policy Description |
|-------|-------|-------------------|
| 1 | `integration_inbox` | Admin-only (no NULL-org leak) |
| 2 | `user_org_grants_mirror` | User sees own grants, service role full |

---

## Contract Change Requests

Items that require functionality not in Contract v1.0.23:

| ID | Description | Requested By | Status |
|----|-------------|--------------|--------|
| (none) | | | |

**Rule**: No implementation proceeds on items in this table until contract amendment is approved.

---

## CRM Dependencies Per Batch

| Batch | CRM Must Provide |
|-------|------------------|
| 2 | Emit `org_access.updated` with grants[] + org_access_seq |
| 5 | Emit `supply_request.created` with required fields |
| 8 | Emit `shipment.approved` with carrier preferences |

All other batches can proceed independently with WMS emitting events.

---

## Open Items

### Pending Decisions

| ID | Question | Impact | Owner |
|----|----------|--------|-------|
| OI-1 | Is returns (Journey #295) IN or POST v1.0.23? | Batch 14 + `returns` table | Product |

### Known Limitations

| ID | Limitation | Workaround |
|----|-----------|------------|
| KL-1 | No kg↔m conversion in v1 | UOM must match catalog |
