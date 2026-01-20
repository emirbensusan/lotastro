# WMS Implementation Plan for CRM Integration (Contract v1.0.6)

> **Version**: 1.0.6  
> **Date**: 2026-01-20  
> **Estimated Effort**: 10 days

## Overview

This plan implements all WMS-side changes required by the canonical contract v1.0.6. The implementation is split into **5 batches** for manageable deployment.

Key changes include:
- **Supply Requests**: New table mirroring CRM supply requests (manufacturing + import_from_central)
- **Partaj Allocation Model**: arrived_soft → planned → allocated workflow
- **shipment.approved triggers PO creation**: PO (WMS Order) is only created upon CRM approval or manager override
- **po_number required**: Every order must have po_number included in order.created webhook
- **Single-PO full fulfillment**: No partial shipments per PO
- **crm_deal_line_id**: Required on reservation_lines and order_lots for line-level tracking

---

## Batch 1: Contract + Database Migrations (Day 1-2)

### 1.1 Copy Contract File
- Copy v1.0.6 contract byte-identical to `docs/integration_contract_v1.md`
- Verify: 596 lines, version 1.0.6, dated 2026-01-20
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

### 1.5 Database Migration: Extend `reservation_lines` Table (v1.0.6 NEW)

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

### 1.7 Database Migration: Extend `order_lots` Table (v1.0.6 NEW)

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
  lines: Array<{  // REQUIRED per v1.0.6
    crm_deal_line_id: string;
    wms_order_line_id: string;
    quality_code: string;
    color_code: string;
    ordered_meters: number;
  }>;
})
```

### 2.2 Update `supabase/functions/wms-webhook-receiver/index.ts`

Add handlers for 2 new CRM to WMS events:

**Handle `supply_request.created`:**
- Create record in `supply_requests` table
- Link to existing `manufacturing_order` if `type = manufacturing` and `mo_number` provided
- Set initial status = 'planned'
- Log to `integration_outbox`

**Handle `shipment.approved`:**
1. Validate HMAC + idempotency
2. Verify reservation exists
3. Verify `allocation_state = allocated` (reject if not)
4. Create WMS Order (PO) with:
   - `po_number` = generated `order_number`
   - `crm_deal_id`, `crm_customer_id`, `crm_organization_id`
   - Lines from reservation with `crm_deal_line_id` preserved
5. Emit `order.created` event (MUST include `po_number` + lines array)
6. If `ship_intent = immediate`: mark for Partaj staging
7. Clear `action_required` on reservation

### 2.3 Update `src/lib/crmNormalization.ts`

Add normalization functions for new statuses:
- `normalizeAllocationState()`
- `normalizeShipIntent()`
- `normalizeActionRequiredReason()`
- `normalizeSupplyRequestStatus()`

---

## Batch 3: Supply Requests + Allocation Pages (Day 4-6)

### 3.1 Create `src/pages/SupplyRequests.tsx`

**Features:**
- Combined view of manufacturing + import-from-central requests
- Status timeline: planned → eta_confirmed → in_transit → arrived_soft → allocated → closed
- Filter by type, status, quality/color
- Dashboard cards: Total in transit, Arrived (soft), Ready for allocation
- Actions:
  - **Confirm In Transit** (planned/eta_confirmed → in_transit)
  - **Mark Arrived (Soft)** (in_transit → arrived_soft) — CRITICAL: No inventory increase, no lot/roll
  - **View Linked Reservations**
- Emits `supply_request.status_updated` on status change

### 3.2 Create `src/pages/AllocationPlanning.tsx`

**Features:**
- Lists supply requests with status = `arrived_soft`
- For each supply: shows eligible reservations (matching quality/color)
- Shortage detection: Calculate if arrived meters < promised reservation meters
- Actions:
  - **Plan Allocation**: Select reservations → set `allocation_state = planned`
  - Emit `reservation.allocation_planned` event with line details
  - If shortage: set `action_required_reason = needs_shortage_decision`, block PO creation

### 3.3 Create `src/pages/AllocationEntry.tsx`

**Features:**
- Lists reservations with `allocation_state = planned`
- For each reservation:
  - Enter lot/roll/meters (reuse existing roll selection UI)
  - On save: set `allocation_state = allocated`
  - Set `action_required` based on `ship_intent`:
    - If immediate: `action_required_reason = needs_shipment_approval`
    - If ship_on_date without date: `action_required_reason = needs_ship_date`
  - Emit `reservation.allocated` event with lot/roll details + `crm_deal_line_id`

### 3.4 Create `src/pages/PartajStaging.tsx`

**Features:**
- Lists Orders (POs) created from shipment approvals/overrides
- Primary display column: `po_number`
- Shows staging status and ship date
- Actions:
  - **Mark Staged** → feeds into existing pick/pack flow
  - **View Order Details**

---

## Batch 4: Dialogs + Override/Shortage Handling (Day 7-8)

### 4.1 Create `src/components/ShipmentOverrideDialog.tsx`

**Features:**
- Triggered when manager wants to proceed without CRM `shipment.approved`
- Required fields:
  - Override reason (dropdown from contract enum: customer_confirmed_email, customer_confirmed_whatsapp, customer_confirmed_phone, customer_confirmed_text, approval_link_received, ship_immediate_policy, manager_directive, ops_emergency, other)
  - Notes (optional freeform text)
- On confirm:
  1. Create record in `shipment_approval_overrides` table
  2. Set `orders.override_used = true`, `override_reason`, `override_by`, `override_at`
  3. Create Order (PO) with `po_number`
  4. Emit `order.created` to CRM (includes `po_number` + lines)
  5. Set `reservation.action_required_reason = override_used`
  6. Send notification email to CRM admin via Resend

### 4.2 Create `src/components/ShortageDecisionDialog.tsx`

**Features:**
- Shows which reservations are affected and by how much
- Manager selects decision: Partial fulfill / Delay / Cancel / Reallocate
- Decision is audit logged to `audit_logs` table
- Unlocks allocation for approved reservations
- Notifies sales manager via Resend email

### 4.3 Create `src/components/SupplyRequestStatusDialog.tsx`

**Features:**
- Status transition dialog for supply requests
- Validates allowed transitions
- Records status history
- Emits `supply_request.status_updated` webhook

---

## Batch 5: Navigation + Internal Emails + Tests (Day 9-10)

### 5.1 Update `src/App.tsx`

Add new routes:
```typescript
const SupplyRequests = lazyWithRetry(() => import("./pages/SupplyRequests"));
const AllocationPlanning = lazyWithRetry(() => import("./pages/AllocationPlanning"));
const AllocationEntry = lazyWithRetry(() => import("./pages/AllocationEntry"));
const PartajStaging = lazyWithRetry(() => import("./pages/PartajStaging"));

<Route path="/supply-requests" element={<ProtectedRoute><SupplyRequests /></ProtectedRoute>} />
<Route path="/allocation-planning" element={<ProtectedRoute><AllocationPlanning /></ProtectedRoute>} />
<Route path="/allocation-entry" element={<ProtectedRoute><AllocationEntry /></ProtectedRoute>} />
<Route path="/partaj-staging" element={<ProtectedRoute><PartajStaging /></ProtectedRoute>} />
```

### 5.2 Update `src/components/SidebarV2.tsx`

Add navigation items:
- Add "Supply Requests" under Inventory section
- Add new "Partaj" section with:
  - Allocation Planning
  - Allocation Entry
  - Partaj Staging

### 5.3 Create Email Notifications (Resend)

Create/update edge functions to send 6 mandatory internal emails per contract Section 15.2:

| Email | Trigger | Recipients |
|-------|---------|------------|
| Supply request created | `supply_request.created` handled | WMS Ops |
| ETA near | supply_request.eta_date approaches | WMS Ops + Sales Owner |
| In transit confirmed | status → in_transit | Sales Owner |
| Soft arrival confirmed | status → arrived_soft | Sales Owner |
| Approval needed | action_required_reason = needs_shipment_approval | Sales Owner/Manager |
| Override used | override logged | Sales Manager |

### 5.4 Update `docs/TEST-CASES.md`

Add comprehensive CRM-WMS integration test cases (see separate section below).

---

## Files Created/Modified Summary

### New Files
| File | Description |
|------|-------------|
| `docs/integration_contract_v1.md` | Replace with v1.0.6 (byte-identical) |
| `src/pages/SupplyRequests.tsx` | Supply requests module |
| `src/pages/AllocationPlanning.tsx` | Allocation planning queue |
| `src/pages/AllocationEntry.tsx` | Allocation entry page |
| `src/pages/PartajStaging.tsx` | Partaj staging queue |
| `src/components/ShipmentOverrideDialog.tsx` | Manager override dialog |
| `src/components/ShortageDecisionDialog.tsx` | Shortage decision dialog |
| `src/components/SupplyRequestStatusDialog.tsx` | Status change dialog |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/migrations/2026XXXX_*.sql` | Schema changes |
| `src/lib/webhookTrigger.ts` | Add 3 new event types + update dispatchOrderCreated with po_number + lines |
| `src/lib/crmNormalization.ts` | Add allocation state normalization functions |
| `supabase/functions/wms-webhook-receiver/index.ts` | Handle supply_request.created, shipment.approved |
| `src/App.tsx` | Add 4 new routes |
| `src/components/SidebarV2.tsx` | Add navigation items |
| `docs/TEST-CASES.md` | Add CRM-WMS integration test cases |

---

## Contract Compliance Self-Check

| Check | Expected | Verification |
|-------|----------|--------------|
| po_number generated at order creation | Yes | po_number = order_number at creation |
| po_number included in order.created payload | Yes | dispatchOrderCreated includes po_number |
| crm_deal_id stored on reservations/orders | Yes | Already exists, verified in schema |
| crm_deal_line_id on reservation_lines | Yes | New column added |
| crm_deal_line_id on order_lots | Yes | New column added |
| lines[] in order.created payload | Yes | dispatchOrderCreated includes lines array |
| lines[] in reservation.allocated payload | Yes | dispatchReservationAllocated includes lines array |
| arrived_soft does NOT increase inventory | Yes | No INSERT to lots/rolls on status change |
| reservation.allocation_planned emits correctly | Yes | New helper function |
| reservation.allocated emits correctly | Yes | New helper function with lines |
| shipment.approved creates PO | Yes | Handled in wms-webhook-receiver |
| Single-PO full fulfillment | Yes | No partial shipment logic |
| Override reason logging enforced | Yes | CHECK constraint on table |
| Idempotency keys have no timestamps | Yes | generateIdempotencyKey uses source:entity:id:action:v1 |
| HMAC validation on inbound | Yes | verifySignature in wms-webhook-receiver |
| Outbound webhook retries logged | Yes | integration_outbox table |

---

## Decisions Made

| Topic | Decision |
|-------|----------|
| Supply Requests Table | New `supply_requests` table (not reusing existing) |
| PO Number Generation | Use `order_number` as `po_number` |
| Manufacturing Orders Relationship | Sit alongside with `manufacturing_order_id` FK link |
| Email Infrastructure | Use existing Resend integration |

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

- Contract: `docs/integration_contract_v1.md` (v1.0.6)
- CRM Integration Spec: `docs/CRM-INTEGRATION.md`
- Test Cases: `docs/TEST-CASES.md` (Section 13)
