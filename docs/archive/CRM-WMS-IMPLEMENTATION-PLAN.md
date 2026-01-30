# WMS Implementation Plan for CRM Integration (Contract v1.0.7)

> **Version**: 1.0.7  
> **Date**: 2026-01-20  
> **Estimated Effort**: 10 days

## Overview

This plan implements all WMS-side changes required by the canonical contract v1.0.7. The implementation is split into **5 batches** for manageable deployment.

**Key v1.0.7 Requirements:**
- **Supply Requests**: New table mirroring CRM supply requests (manufacturing + import_from_central)
- **Universal Shipment Approval**: `shipment.approved` applies to BOTH ON-HAND and INCOMING-BACKED reservations
- **Partaj Allocation Model**: Only applies to INCOMING-BACKED reservations (`crm_supply_request_id IS NOT NULL`)
- **ON-HAND reservations**: Do NOT require `allocation_state=allocated` before shipment approval (no deadlock)
- **po_number required**: Every order must have `po_number` included in `order.created` webhook
- **Single-PO full fulfillment**: No partial shipments per PO
- **crm_deal_line_id**: Required on `reservation_lines` and `order_lots` for line-level tracking
- **UI Label Lock**: `arrived_soft` MUST display as "Arrived (Soft)"

---

## Prerequisites

Before starting implementation, gather the following:

### Secrets Required (WMS Side)

| Secret Name | Description | Where to Obtain |
|-------------|-------------|-----------------|
| `CRM_API_KEY` | API key for calling CRM endpoints | CRM Admin → Settings → API Keys |
| `CRM_API_URL` | Base URL for CRM API endpoints | CRM deployment URL (e.g., `https://<crm-project-id>.supabase.co/functions/v1`) |
| `CRM_WEBHOOK_SECRET` | Shared secret for HMAC signing | Generate 32-byte secret, share with CRM team |
| `RESEND_API_KEY` | Email delivery service | Already configured ✓ |

### Secrets to Share with CRM Team

| Secret Name | Value |
|-------------|-------|
| `WMS_API_URL` | `https://kwcwbyfzzordqwudixvl.supabase.co/functions/v1` |
| `WMS_API_KEY` | Generate in Admin → API Keys |
| `WMS_WEBHOOK_SECRET` | Same as `CRM_WEBHOOK_SECRET` (shared) |

### Prerequisites Checklist

- [ ] CRM API URL confirmed
- [ ] CRM API Key received from CRM team
- [ ] Shared webhook secret agreed and configured in both systems
- [ ] Integration contract v1.0.7 copied byte-identical to `docs/integration_contract_v1.md`
- [ ] WMS API key generated and shared with CRM team

---

## Batch 1: Contract + Database Migrations (Day 1-2)

### 1.1 Copy Contract File
- Copy v1.0.7 contract byte-identical to `docs/integration_contract_v1.md`
- Verify: 628 lines, version 1.0.7, dated 2026-01-20
- Event counts: CRM to WMS = 9, WMS to CRM = 18, Total = 27

### 1.2 Database Migration: Create `supply_requests` Table

```sql
CREATE TABLE supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_supply_request_id UUID UNIQUE,
  crm_deal_id UUID,
  crm_customer_id UUID,
  crm_organization_id UUID,
  manufacturing_order_id UUID REFERENCES manufacturing_orders(id), -- FK link
  type TEXT NOT NULL CHECK (type IN ('manufacturing', 'import_from_central')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'eta_confirmed', 'in_transit', 'arrived_soft', 'allocated', 'closed', 'cancelled'
  )),
  quality_code TEXT NOT NULL,
  color_code TEXT,
  meters NUMERIC(12,2) NOT NULL,
  eta_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view supply_requests" 
  ON supply_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert supply_requests" 
  ON supply_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update supply_requests" 
  ON supply_requests FOR UPDATE TO authenticated USING (true);
```

### 1.3 Database Migration: Create `supply_request_status_history` Table

```sql
CREATE TABLE supply_request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_request_id UUID NOT NULL REFERENCES supply_requests(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE supply_request_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view history" 
  ON supply_request_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert history" 
  ON supply_request_status_history FOR INSERT TO authenticated WITH CHECK (true);
```

### 1.4 Database Migration: Extend `reservations` Table

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS crm_supply_request_id UUID;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ship_intent TEXT DEFAULT 'unknown';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ship_date DATE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS allocation_state TEXT DEFAULT 'unallocated';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS action_required BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS action_required_reason TEXT;

-- Add constraints
DO $$ BEGIN
  ALTER TABLE reservations ADD CONSTRAINT chk_ship_intent 
    CHECK (ship_intent IN ('immediate', 'ship_on_date', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reservations ADD CONSTRAINT chk_allocation_state 
    CHECK (allocation_state IN ('unallocated', 'planned', 'allocated'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reservations ADD CONSTRAINT chk_action_required_reason 
    CHECK (action_required_reason IS NULL OR action_required_reason IN (
      'needs_allocation_plan', 'needs_roll_entry', 'needs_ship_date',
      'needs_customer_confirmation', 'needs_shipment_approval', 
      'needs_shortage_decision', 'override_used'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### 1.5 Database Migration: Extend `reservation_lines` Table

```sql
-- crm_deal_line_id required per contract Section 13.5
ALTER TABLE reservation_lines ADD COLUMN IF NOT EXISTS crm_deal_line_id UUID;
```

### 1.6 Database Migration: Extend `orders` Table

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_organization_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_used BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_by UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_notes TEXT;

-- Set po_number = order_number for existing orders (backward compat)
UPDATE orders SET po_number = order_number WHERE po_number IS NULL;

-- Add unique constraint
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_po_number_unique UNIQUE (po_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Constraint for override_reason
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT chk_override_reason 
    CHECK (override_reason IS NULL OR override_reason IN (
      'customer_confirmed_email', 'customer_confirmed_whatsapp', 'customer_confirmed_phone',
      'customer_confirmed_text', 'approval_link_received', 'ship_immediate_policy',
      'manager_directive', 'ops_emergency', 'other'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### 1.7 Database Migration: Extend `order_lots` Table

```sql
-- crm_deal_line_id required per contract Section 13.5
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS crm_deal_line_id UUID;
```

### 1.8 Database Migration: Create `shipment_approval_overrides` Table

```sql
CREATE TABLE shipment_approval_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id),
  order_id UUID REFERENCES orders(id),
  override_reason TEXT NOT NULL CHECK (override_reason IN (
    'customer_confirmed_email', 'customer_confirmed_whatsapp', 'customer_confirmed_phone',
    'customer_confirmed_text', 'approval_link_received', 'ship_immediate_policy',
    'manager_directive', 'ops_emergency', 'other'
  )),
  override_notes TEXT,
  overridden_by UUID NOT NULL,
  overridden_at TIMESTAMPTZ DEFAULT now(),
  crm_notified BOOLEAN DEFAULT false,
  crm_notified_at TIMESTAMPTZ
);

ALTER TABLE shipment_approval_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view overrides" 
  ON shipment_approval_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert overrides" 
  ON shipment_approval_overrides FOR INSERT TO authenticated WITH CHECK (true);
```

---

## Batch 2: Webhook Integration (Day 2-3)

### 2.1 Update `src/lib/webhookTrigger.ts`

Add 3 new event types per contract:
```typescript
export type WebhookEventType = 
  // ... existing ...
  | 'supply_request.status_updated'
  | 'reservation.allocation_planned'
  | 'reservation.allocated';
```

Add helper functions:

```typescript
// NEW: dispatchSupplyRequestStatusUpdated
export function dispatchSupplyRequestStatusUpdated(request: {
  crm_supply_request_id: string;
  crm_deal_id?: string;
  old_status: string;
  new_status: string;
  eta_date?: string;
  notes?: string;
})

// NEW: dispatchReservationAllocationPlanned
export function dispatchReservationAllocationPlanned(reservation: {
  wms_reservation_id: string;
  crm_deal_id: string;
  crm_supply_request_id: string;
  planned_meters: number;
  lines: Array<{
    crm_deal_line_id: string;
    wms_reservation_line_id: string;
    quality_code: string;
    color_code: string;
    planned_meters: number;
  }>;
})

// NEW: dispatchReservationAllocated
export function dispatchReservationAllocated(reservation: {
  wms_reservation_id: string;
  crm_deal_id: string;
  lines: Array<{
    crm_deal_line_id: string;
    wms_reservation_line_id: string;
    quality_code: string;
    color_code: string;
    allocated_meters: number;
    lot_id: string;
    roll_id: string;
  }>;
})
```

**Update `dispatchOrderCreated`** to include required fields per contract Section 14.4:
```typescript
export function dispatchOrderCreated(order: {
  wms_order_id: string;
  po_number: string;  // REQUIRED
  order_number: string;
  crm_deal_id: string;  // REQUIRED for CRM demand
  crm_customer_id: string;
  crm_organization_id: string;
  lines: Array<{  // REQUIRED per contract
    crm_deal_line_id: string;
    wms_order_line_id: string;
    quality_code: string;
    color_code: string;
    ordered_meters: number;
  }>;
})
```

### 2.2 Update `supabase/functions/wms-webhook-receiver/index.ts`

**Handle `supply_request.created`:**
- Create record in `supply_requests` table
- Link to existing `manufacturing_order` if `type = manufacturing` and `mo_number` provided
- Set initial status = 'planned'
- Log to `integration_outbox`

**Handle `shipment.approved` (v1.0.7 UNIVERSAL GATE):**

```
1. Validate HMAC + idempotency
2. Fetch reservation by wms_reservation_id
3. Determine reservation source:
   
   IF crm_supply_request_id IS NULL (ON-HAND):
     - Validate reservation lines are fulfillable from on-hand stock
     - NO allocation_state check required (v1.0.7 fix)
   
   ELSE (INCOMING-BACKED / Partaj):
     - Validate allocation_state = 'allocated'
     - Reject with error if not allocated

4. Create WMS Order with po_number = order_number
5. Copy lines preserving crm_deal_line_id
6. Emit order.created with po_number and lines[]
7. Clear action_required on reservation
```

### 2.3 Update `src/lib/crmNormalization.ts`

Add normalization functions for new statuses:
- `normalizeAllocationState()`
- `normalizeShipIntent()`
- `normalizeActionRequiredReason()`
- `normalizeSupplyRequestStatus()`
- Spelling normalization: `canceled` → `cancelled`

---

## Batch 3: Supply Requests + Allocation Pages (Day 4-6)

### 3.1 Create `src/pages/SupplyRequests.tsx`

**Purpose:** Track incoming supply (manufacturing + import-from-central)

**Features:**
- Dashboard cards: Total in transit, Arrived (Soft), Ready for allocation
- Status timeline with **LOCKED labels**:
  - `planned` → "Planned"
  - `eta_confirmed` → "ETA Confirmed"
  - `in_transit` → "In Transit"
  - `arrived_soft` → **"Arrived (Soft)"** ← v1.0.7 LOCKED
  - `allocated` → "Allocated"
  - `closed` → "Closed"
  - `cancelled` → "Cancelled"
- Filter by type, status, quality/color
- Actions:
  - **Confirm In Transit** (planned/eta_confirmed → in_transit)
  - **Mark Arrived (Soft)** (in_transit → arrived_soft)
- Emits `supply_request.status_updated` on status change
- **CRITICAL**: "Mark Arrived (Soft)" does NOT increase inventory

### 3.2 Create `src/pages/AllocationPlanning.tsx`

**Purpose:** Plan which reservations will be fulfilled from arrived supply

**Applies to:** INCOMING-BACKED reservations only (`crm_supply_request_id IS NOT NULL`)

**Features:**
- Lists supply requests with `status = 'arrived_soft'`
- Shows eligible reservations (matching quality/color)
- Shortage detection with warning
- Actions:
  - Plan Allocation → sets `allocation_state = 'planned'`
  - Emits `reservation.allocation_planned`
  - If shortage: sets `action_required_reason = 'needs_shortage_decision'`

### 3.3 Create `src/pages/AllocationEntry.tsx`

**Purpose:** Enter lot/roll/meters for planned reservations

**Applies to:** INCOMING-BACKED reservations only

**Features:**
- Lists reservations with `allocation_state = 'planned'`
- Enter lot/roll/meters per line
- On save:
  - Sets `allocation_state = 'allocated'`
  - Sets `action_required_reason = 'needs_shipment_approval'`
  - Emits `reservation.allocated` with line details

### 3.4 Create `src/pages/ShipNextDay.tsx`

**Purpose:** Post-PO staging queue (v1.0.7 clarification: NOT the allocation step)

**Features:**
- Lists WMS Orders (POs) created from shipment approvals
- Primary display column: `po_number`
- Shows staging status and ship date
- Actions: Mark Staged, View Order Details
- This is the final step before pick/pack

---

## Batch 4: Dialogs + Override/Shortage Handling (Day 7-8)

### 4.1 Create `src/components/ShipmentOverrideDialog.tsx`

**Purpose:** Allow manager to create PO without CRM `shipment.approved`

**Features:**
- Override reason dropdown (contract-locked values):
  - `customer_confirmed_email`
  - `customer_confirmed_whatsapp`
  - `customer_confirmed_phone`
  - `customer_confirmed_text`
  - `approval_link_received`
  - `ship_immediate_policy`
  - `manager_directive`
  - `ops_emergency`
  - `other`
- Notes field
- On confirm:
  1. Logs to `shipment_approval_overrides` table
  2. Sets `orders.override_used = true`
  3. Creates WMS Order with `po_number`
  4. Emits `order.created`
  5. Sends notification email via Resend

### 4.2 Create `src/components/ShortageDecisionDialog.tsx`

**Purpose:** Manager decision when supply is insufficient

**Features:**
- Shows affected reservations and shortage amount
- Decision options: Partial fulfill, Delay, Cancel, Reallocate
- Audit logs decision
- Unlocks allocation for approved reservations

### 4.3 Create `src/components/SupplyRequestStatusDialog.tsx`

**Purpose:** Status transitions for supply requests

---

## Batch 5: Navigation + Internal Emails + Tests (Day 9-10)

### 5.1 Add Routes to `src/App.tsx`

```typescript
const SupplyRequests = lazyWithRetry(() => import("./pages/SupplyRequests"));
const AllocationPlanning = lazyWithRetry(() => import("./pages/AllocationPlanning"));
const AllocationEntry = lazyWithRetry(() => import("./pages/AllocationEntry"));
const ShipNextDay = lazyWithRetry(() => import("./pages/ShipNextDay"));

<Route path="/supply-requests" element={<ProtectedRoute><SupplyRequests /></ProtectedRoute>} />
<Route path="/allocation-planning" element={<ProtectedRoute><AllocationPlanning /></ProtectedRoute>} />
<Route path="/allocation-entry" element={<ProtectedRoute><AllocationEntry /></ProtectedRoute>} />
<Route path="/ship-next-day" element={<ProtectedRoute><ShipNextDay /></ProtectedRoute>} />
```

### 5.2 Update `src/components/SidebarV2.tsx`

Add navigation items:
- Add "Supply Requests" under Inventory section
- Add new "Fulfillment" section with:
  - Allocation Planning
  - Allocation Entry
  - Ship Next Day

### 5.3 Create Email Notifications (Resend)

6 mandatory internal emails per contract Section 15.2:

| Email | Trigger | Recipients |
|-------|---------|------------|
| Supply request created | `supply_request.created` handled | WMS Ops |
| ETA near | supply_request.eta_date approaches | WMS Ops + Sales Owner |
| In transit confirmed | status → in_transit | Sales Owner |
| Soft arrival confirmed | status → arrived_soft | Sales Owner |
| Approval needed | action_required_reason = needs_shipment_approval | Sales Owner/Manager |
| Override used | override logged | Sales Manager |

### 5.4 Update `docs/TEST-CASES.md`

Add comprehensive CRM-WMS integration test cases (see separate section in TEST-CASES.md).

---

## New Pages Summary (UX)

| Page | Route | Purpose |
|------|-------|---------|
| **Supply Requests** | `/supply-requests` | Track manufacturing + import requests, mark arrivals |
| **Allocation Planning** | `/allocation-planning` | Plan which reservations get fulfilled from arrived supply |
| **Allocation Entry** | `/allocation-entry` | Enter lot/roll/meters for planned reservations |
| **Ship Next Day** | `/ship-next-day` | Post-PO staging queue before pick/pack |

### Visual Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CRM-WMS INTEGRATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

  CRM Creates                    WMS Receives
  Supply Request ──────────────► supply_request.created
       │
       ▼
┌──────────────────┐
│ Supply Requests  │ ← View/manage all supply requests
│ Page             │
└──────────────────┘
       │
       │ Confirm In Transit → Mark "Arrived (Soft)"
       ▼
┌──────────────────┐
│ Allocation       │ ← Select which reservations to fulfill
│ Planning         │   from arrived supply (INCOMING-BACKED only)
└──────────────────┘
       │
       │ allocation_state = 'planned'
       ▼
┌──────────────────┐
│ Allocation       │ ← Enter specific lot/roll/meters
│ Entry            │   allocation_state = 'allocated'
└──────────────────┘
       │
       │ action_required_reason = 'needs_shipment_approval'
       ▼
  CRM or Manager Override ────────► shipment.approved (CRM)
       │                            OR ShipmentOverrideDialog (WMS)
       ▼
  WMS Order (PO) Created ─────────► order.created webhook to CRM
       │
       ▼
┌──────────────────┐
│ Ship Next Day    │ ← Post-PO staging queue
│ (Staging Queue)  │   Shows POs ready for pick/pack
└──────────────────┘
       │
       ▼
  Pick/Pack ──────► Ship ──────► Deliver
```

---

## Files Created/Modified Summary

### New Files (9)

| File | Description |
|------|-------------|
| `docs/integration_contract_v1.md` | v1.0.7 contract (byte-identical) |
| `supabase/migrations/XXXXXX_crm_wms_integration.sql` | All schema changes |
| `src/pages/SupplyRequests.tsx` | Supply requests module |
| `src/pages/AllocationPlanning.tsx` | Allocation planning queue |
| `src/pages/AllocationEntry.tsx` | Allocation entry page |
| `src/pages/ShipNextDay.tsx` | Post-PO staging queue |
| `src/components/ShipmentOverrideDialog.tsx` | Manager override dialog |
| `src/components/ShortageDecisionDialog.tsx` | Shortage decision dialog |
| `src/components/SupplyRequestStatusDialog.tsx` | Status change dialog |

### Modified Files (6)

| File | Changes |
|------|---------|
| `src/lib/webhookTrigger.ts` | Add 3 events, update dispatchOrderCreated with po_number + lines |
| `src/lib/crmNormalization.ts` | Add normalization functions |
| `supabase/functions/wms-webhook-receiver/index.ts` | Handle supply_request.created, shipment.approved with ON-HAND/INCOMING-BACKED branching |
| `src/App.tsx` | Add 4 new routes |
| `src/components/SidebarV2.tsx` | Add navigation items |
| `docs/TEST-CASES.md` | Add CRM-WMS integration test cases |

---

## v1.0.7 Contract Compliance Self-Check

| Check | v1.0.7 Requirement | Implementation |
|-------|-------------------|----------------|
| Shipment approval is universal | Applies to ON-HAND and INCOMING-BACKED | Handler checks `crm_supply_request_id` to determine path |
| ON-HAND: no allocation_state check | `crm_supply_request_id IS NULL` skips allocation validation | Handler bypasses `allocation_state` check for ON-HAND |
| INCOMING-BACKED: requires allocated | `crm_supply_request_id IS NOT NULL` requires `allocation_state='allocated'` | Handler validates `allocation_state` for INCOMING-BACKED |
| `arrived_soft` displays as "Arrived (Soft)" | UI label locked | All UI components use locked string |
| Ship Next Day is post-PO | Clarified as staging queue | Page shows POs, not reservations |
| `manufacturing_order_id` FK | Link supply_requests to manufacturing_orders | FK column in schema |
| `po_number` in order.created | Required payload field | dispatchOrderCreated includes it |
| `lines[]` in order.created | Required array with crm_deal_line_id | dispatchOrderCreated includes lines |
| Spelling: cancelled | Normalize `canceled` → `cancelled` | crmNormalization handles it |
| Single-PO full fulfillment | No partial PO shipment | Enforced at order level |
| Override reason logging | Required for manager override | CHECK constraint on table |
| Idempotency keys have no timestamps | Format: source:entity:id:action:v1 | generateIdempotencyKey |

---

## Decisions Made

| Topic | Decision |
|-------|----------|
| Supply Requests Table | New `supply_requests` table (not reusing existing) |
| PO Number Generation | Use `order_number` as `po_number` |
| Manufacturing Orders Relationship | Sit alongside with `manufacturing_order_id` FK link |
| Email Infrastructure | Use existing Resend integration |
| Ship Next Day naming | Renamed from "Partaj Staging" to clarify post-PO purpose |

---

## Estimated Effort

| Batch | Days |
|-------|------|
| Batch 1: Contract + Migrations | 2 |
| Batch 2: Webhook Integration | 1.5 |
| Batch 3: Pages | 3 |
| Batch 4: Dialogs + Override/Shortage | 2 |
| Batch 5: Navigation + Emails + Tests | 1.5 |
| **Total** | **10 days** |

---

## References

- Contract: `docs/integration_contract_v1.md` (v1.0.7)
- CRM Integration Spec: `docs/CRM-INTEGRATION.md`
- Test Cases: `docs/TEST-CASES.md` (Section 13)
