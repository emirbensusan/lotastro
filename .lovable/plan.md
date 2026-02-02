# WMS Implementation Plan v1.0.23 — Session Breakdown

## Overview

This document breaks down the 14 batches (0-13) into discrete execution sessions. Each session is designed to be:
- **Completable in 45-90 minutes** (typical Lovable session)
- **Self-contained** with clear acceptance gates
- **Sequentially safe** (no dependencies on incomplete work)

---

## Current Progress

- **Current Session:** 1.2 (Next to execute)
- **Last Completed:** Session 1.1 ✅
- **Status:** Integration Inbox table created with RLS

---

## Batch Summary & Session Allocation

| Batch | Name | Sessions | Status |
|-------|------|----------|--------|
| 0 | Contract Alignment & Guards | 3 | ✅ Complete |
| 1 | Integration Inbox | 3 | 🔄 In Progress (1/3) |
| 2 | Multi-Org Identity | 5 | ⬜ Not Started |
| 3 | Reservations Schema Extensions | 3 | ⬜ Not Started |
| 4 | Orders Schema + PO Generator | 4 | ⬜ Not Started |
| 5 | Supply Requests Mirror | 3 | ⬜ Not Started |
| 6 | stock.changed Event | 3 | ⬜ Not Started |
| 7 | Allocation Planning + Entry | 5 | ⬜ Not Started |
| 8 | Shipment Approval + Override | 4 | ⬜ Not Started |
| 9 | Central Stock Checks (Abra) | 5 | ⬜ Not Started |
| 10 | Post-PO Issues | 4 | ⬜ Not Started |
| 11 | Costing Module | 5 | ⬜ Not Started |
| 12 | Invoice Control | 3 | ⬜ Not Started |
| 13 | PO Command Center | 4 | ⬜ Not Started |
| **TOTAL** | | **54 sessions** | |

---

## Detailed Session Breakdown

---

### BATCH 0: Contract Alignment & Guards (3 Sessions)

**Purpose:** Establish drift prevention infrastructure before any integration work.

#### Session 0.1: Contract Violations Table + Validation Functions
**Scope:**
- Create `integration_contract_violations` table with all columns
- Create `validate_idempotency_key()` function
- Create `validate_contract_uom()` function
- Add indexes for violations table

**Acceptance Gates:**
- [x] `SELECT * FROM integration_contract_violations LIMIT 1` succeeds ✅
- [x] `SELECT * FROM validate_idempotency_key('wms:order:123:created:v1')` returns valid=true ✅
- [x] `SELECT * FROM validate_idempotency_key('wms:order:123:created')` returns valid=false (4 segments) ✅
- [x] `SELECT validate_contract_uom('MT')` = true ✅
- [x] `SELECT validate_contract_uom('YD')` = false ✅

**Completed:** 2025-02-02 | **Files Created:**
- `src/lib/contractValidation.ts` - Client-side validation helpers

---

#### Session 0.2: Contract Schema Definitions (TypeScript)
**Scope:**
- Create `supabase/functions/_shared/contract-schemas.ts`
- Define `CONTRACT_UOM_VALUES`, `validateIdempotencyKey()`, `validatePayloadSchema()`
- Define `logContractViolation()` helper
- Define `EVENT_SCHEMAS` for all 11 CRM→WMS events

**Acceptance Gates:**
- [x] File created and deployable ✅
- [x] `validateIdempotencyKey()` unit tests pass ✅
- [x] All event schemas match contract exactly ✅

**Completed:** 2025-02-02 | **Files Created:**
- `supabase/functions/_shared/contract-schemas.ts` - Edge function contract definitions

---

#### Session 0.3: HMAC + Schema Validation (TypeScript)
**Scope:**
- Create `supabase/functions/_shared/contract-validation.ts`
- Implement `validateInboundEvent()` with HMAC, schema, UOM validation
- Add unknown field detection and logging
- Configure STRICT_MODE behavior

**Acceptance Gates:**
- [x] Valid request with correct HMAC passes ✅
- [x] Invalid HMAC returns 401 ✅
- [x] Unknown fields logged and rejected (strict mode) ✅
- [x] Missing required fields return 400 with details ✅
- [x] Invalid UOM rejected with 400 ✅

**Completed:** 2025-02-02 | **Files Created:**
- `supabase/functions/_shared/contract-validation.ts` - HMAC + schema validation
- Secret added: `WMS_CRM_HMAC_SECRET`

---

### BATCH 1: Integration Inbox (3 Sessions)

**Purpose:** Create inbound event logging table and webhook receiver.

#### Session 1.1: Integration Inbox Table + RLS
**Scope:**
- Create `integration_inbox` table with all columns
- Add indexes (idempotency, status, event_type, retry)
- Configure RLS (admin-only read, service role write)
- Revoke authenticated access

**Acceptance Gates:**
- [x] `SELECT * FROM integration_inbox LIMIT 1` succeeds for admin ✅
- [x] Non-admin authenticated user cannot SELECT ✅
- [x] Indexes created and verified ✅

**Completed:** 2025-02-02 | **Files Created:**
- `supabase/functions/_tests/session_1_1_test.ts` - Integration inbox tests

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

#### Session 5.2: supply_request Event Handlers
**Scope:**
- Implement `handleSupplyRequestCreated()`
- Implement `handleSupplyRequestStatusUpdated()`
- Add sequence guard

**Acceptance Gates:**
- [ ] Events processed correctly
- [ ] Out-of-order rejected

---

#### Session 5.3: Supply Tracking Integration + QA
**Scope:**
- Connect to allocation planning
- Test milestone updates (eta_confirmed, in_transit, arrived_soft)
- QA verification

**Acceptance Gates:**
- [ ] Status transitions work
- [ ] Milestone timestamps recorded

---

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

---

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

---

#### Session 6.3: Integration + Cache Update
**Scope:**
- Wire stock changes to dispatcher
- Update `stock_by_quality_cache`
- QA verification

**Acceptance Gates:**
- [ ] Inventory change triggers event
- [ ] Cache updated correctly
- [ ] Idempotency verified

---

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

---

#### Session 7.2: Allocation Planning Grid
**Scope:**
- Build reservation lines grid
- Show incoming supply matches
- Implement planning actions

**Acceptance Gates:**
- [ ] Grid displays data
- [ ] Filtering works

---

#### Session 7.3: Allocation Entry Page Structure
**Scope:**
- Create `/allocation-entry` route
- Implement lot/roll selection UI
- Connect to planned allocations

**Acceptance Gates:**
- [ ] Page renders
- [ ] Planned items displayed

---

#### Session 7.4: Allocation Entry Actions
**Scope:**
- Implement lot/roll/meters assignment
- Update allocation_state
- Emit reservation.allocated event

**Acceptance Gates:**
- [ ] Allocation persisted
- [ ] State updated correctly
- [ ] Event dispatched

---

#### Session 7.5: Allocation QA + Polish
**Scope:**
- Full workflow testing
- Error handling
- Performance optimization

**Acceptance Gates:**
- [ ] End-to-end workflow passes
- [ ] FUL-01 tests pass

---

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

---

#### Session 8.2: Approval Override Queue Page
**Scope:**
- Create `/approvals/shipment` route
- Display pending approvals requiring override
- Show reason codes

**Acceptance Gates:**
- [ ] Page renders
- [ ] Pending items displayed

---

#### Session 8.3: Override Actions + Reason Capture
**Scope:**
- Implement override form
- Capture reason code and notes
- Record override_by and override_at

**Acceptance Gates:**
- [ ] Override persisted
- [ ] Reason code required
- [ ] Audit trail complete

---

#### Session 8.4: Override Integration + QA
**Scope:**
- Connect override to order creation
- Emit order.created after override
- QA verification

**Acceptance Gates:**
- [ ] Override triggers order
- [ ] FUL-02 tests pass

---

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

---

#### Session 9.2: Stock Checks Queue Page
**Scope:**
- Create `/central-stock-checks` route
- Display pending checks queue
- Add filtering by status

**Acceptance Gates:**
- [ ] Page renders
- [ ] Queue displayed

---

#### Session 9.3: Check Result Entry
**Scope:**
- Implement result form (found_in_abra, not_in_abra, uncertain)
- Capture available_qty and proposed_next_step
- Update check status

**Acceptance Gates:**
- [ ] Results persisted
- [ ] ETA captured when needed

---

#### Session 9.4: central_stock_check.completed Event
**Scope:**
- Emit completion event to CRM
- Include all required fields
- Wire to UI action

**Acceptance Gates:**
- [ ] Event dispatched
- [ ] Schema matches contract

---

#### Session 9.5: Abra Integration + QA
**Scope:**
- Enforce check completion before "Send back"
- Weekly digest email support
- QA verification

**Acceptance Gates:**
- [ ] ABR-01 to ABR-04 tests pass
- [ ] ABRA-01, ABRA-02 tests pass

---

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

---

#### Session 10.2: Issue Reporting UI
**Scope:**
- Add issue flagging on order lines
- Capture issue details and reason
- Block affected lines

**Acceptance Gates:**
- [ ] Issues can be created
- [ ] Lines blocked correctly

---

#### Session 10.3: Post-PO Issue Events
**Scope:**
- Emit `post_po_issue.created`
- Emit `post_po_issue.updated`
- Emit `post_po_issue.resolved`

**Acceptance Gates:**
- [ ] Events dispatched correctly
- [ ] Idempotency maintained

---

#### Session 10.4: Issue Resolution + QA
**Scope:**
- Implement resolution workflow
- Sync to CRM timeline
- QA verification

**Acceptance Gates:**
- [ ] DPO-01 to DPO-04 tests pass

---

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

---

#### Session 11.2: Invoice Capture UI
**Scope:**
- Create invoice entry form
- Capture header + lines
- FX rate selection with override

**Acceptance Gates:**
- [ ] Invoice persisted
- [ ] FX rate recorded with audit

---

#### Session 11.3: Landed Cost Allocation
**Scope:**
- Allocate costs to receipts/lots
- Support later adjustments with audit
- Update WAC calculation

**Acceptance Gates:**
- [ ] Costs allocated
- [ ] WAC updated in TRY

---

#### Session 11.4: Costing Events
**Scope:**
- Emit `costing.invoice_posted`
- Emit `costing.receipt_linked`
- Emit `costing.adjustment_posted`
- Emit `costing.wac_updated`

**Acceptance Gates:**
- [ ] All events dispatched
- [ ] Schema correct

---

#### Session 11.5: Costing QA + Mirror to CRM
**Scope:**
- Send cost mirrors to CRM
- Store overhead pools per org
- QA verification

**Acceptance Gates:**
- [ ] CST-01 to CST-06 tests pass

---

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

---

#### Session 12.2: Pass/Fail Actions
**Scope:**
- Implement pass action
- Implement fail action with required note
- Role gating (WMS Ops only)

**Acceptance Gates:**
- [ ] Status transitions work
- [ ] Failure requires note

---

#### Session 12.3: Invoice Control Events + QA
**Scope:**
- Emit `invoice_control.passed`
- Emit `invoice_control.failed`
- QA verification

**Acceptance Gates:**
- [ ] INV-01 to INV-03 tests pass

---

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

---

#### Session 13.2: Universal Orders Table
**Scope:**
- Build orders table with all statuses
- Implement column configuration
- Add inline actions

**Acceptance Gates:**
- [ ] Table renders
- [ ] Filtering works

---

#### Session 13.3: Human Gates Tabs
**Scope:**
- Add Warehouse Confirmation tab
- Add Payment Confirmation tab
- Add Shipment Approval tab
- Add Shortage Decisions tab

**Acceptance Gates:**
- [ ] Tabs render
- [ ] Filtered correctly

---

#### Session 13.4: Command Center Polish + QA
**Scope:**
- Performance optimization
- Real-time updates
- Full QA verification

**Acceptance Gates:**
- [ ] Sub-second load times
- [ ] All filters work

---

## Execution Timeline

### Phase 1: Foundation (Batches 0-2) — 11 sessions
Critical infrastructure for all subsequent work.

### Phase 2: Schema & Events (Batches 3-6) — 13 sessions
Core data model extensions and event infrastructure.

### Phase 3: Workflows (Batches 7-9) — 14 sessions
Allocation and verification workflows.

### Phase 4: Operations (Batches 10-13) — 16 sessions
Operational features and command center.

---

## Quick Reference: Session IDs

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

---

## Notes

1. **Session duration estimate:** 45-90 minutes each
2. **Buffer sessions:** Add 10-15% buffer for unexpected complexity
3. **Parallel work:** Sessions within a batch can sometimes be parallelized if multiple developers
4. **QA sessions:** Each batch ends with integration QA — don't skip
5. **Checkpoint rule:** Never proceed to next batch until all acceptance gates pass
