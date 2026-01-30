# Integration Contract v1.0.9

> **Status:** CANONICAL (Locked)  
> **Applies To:** CRM Phase 6+, WMS Batch F+  
> **Last Updated:** 2026-01-20  
> **Contract Identifier:** integration_contract_v1  
>
> **This file must be byte-identical in both CRM and WMS repositories.**

---

## Table of Contents

1. [Canonical Entities](#1-canonical-entities)  
2. [Canonical Identifier Rules](#2-canonical-identifier-rules)  
3. [Canonical Event Names](#3-canonical-event-names)  
4. [Canonical Status Dictionaries](#4-canonical-status-dictionaries)  
5. [Event to Status Transition Table](#5-event-to-status-transition-table)  
6. [Idempotency Key Standard](#6-idempotency-key-standard)  
7. [PO Fulfillment Rules](#7-po-fulfillment-rules)  
8. [Partaj Allocation Model (Reservation-First)](#8-partaj-allocation-model-reservation-first)  
9. [Supply Requests (Manufacturing + Import-from-Central)](#9-supply-requests-manufacturing--import-from-central)  
10. [Cancellation Rules](#10-cancellation-rules)  
11. [Picking Behavior Requirements](#11-picking-behavior-requirements)  
12. [Pricing and Cost Ownership](#12-pricing-and-cost-ownership)  
13. [Required Schema Changes](#13-required-schema-changes)  
14. [API and Webhook Contracts](#14-api-and-webhook-contracts)  
15. [Notifications & Email Rules](#15-notifications--email-rules)  
16. [Required Pages & Views](#16-required-pages--views)  
17. [Implementation Notes](#17-implementation-notes)  
18. [Contract Lock Checklist](#18-contract-lock-checklist)  
19. [Version History](#19-version-history)  
20. [Lock Statement](#20-lock-statement)

---

## 1. Canonical Entities

| Entity | Owner | CRM Column | WMS Column | Notes |
|--------|-------|------------|------------|-------|
| Organization | CRM | `organization_id` | `crm_organization_id` | Multi-tenant isolation |
| Customer | CRM | `id` | `crm_customer_id` | CRM is source of truth |
| Deal | CRM | `id` | `crm_deal_id` | Commercial umbrella container (may create multiple POs) |
| DealLine | CRM | `deal_lines.id` | `crm_deal_line_id` | CRM is canonical for line tracking; WMS MUST persist `crm_deal_line_id` on reservation/order lines and echo it in events |
| SupplyRequest | CRM | `id` | `crm_supply_request_id` | Tracks manufacturing or import-from-central; mirrored to WMS |
| Reservation | WMS | `wms_reservation_id` | `id` | WMS is source of truth (includes Partaj allocation fields) |
| Order (WMS Order) | WMS | `wms_order_id` | `id` | WMS execution object for a PO |
| PO Number | WMS | `po_number` | `po_number` | Human-facing unique identifier per org; generated in WMS |
| Shipment | WMS | `wms_shipment_id` | `id` | WMS is source of truth |
| Inquiry | WMS | — | `id` | Optional (not mandatory) |
| Inventory | WMS | — | `id` | CRM sees masked availability only |

**Terminology (LOCKED):**
- **Deal ID (`crm_deal_id`)**: umbrella container shown in CRM (commercial).  
- **PO Number (`po_number`)**: primary human identifier for ops + customers; shown in WMS, CRM, and customer emails.  
- **WMS Order ID (`wms_order_id`)**: internal WMS identifier; may be hidden from humans.

---

## 2. Canonical Identifier Rules

### 2.1 Must-have identifiers in UI (LOCKED)

- **WMS UI primary identifier:** `po_number`  
- **CRM UI ops/comms primary identifier:** `po_number`  
- **CRM umbrella grouping:** Deal (Deal ID/Deal Number) groups multiple POs and reservations  
- **Customer emails:** MUST include `po_number` and line items; may include optional `customer_reference_po`

### 2.2 PO Number uniqueness (LOCKED)

- `po_number` MUST be unique per `crm_organization_id`.  
- Generated in WMS at `order.created`.  
- CRM MUST store `po_number` exactly as received (CRM must never invent PO numbers).

### 2.3 Required cross-links (LOCKED)

Every WMS Reservation and WMS Order created from CRM demand MUST carry:
- `crm_deal_id`
- `crm_customer_id`
- `crm_organization_id`

---

## 3. Canonical Event Names

### 3.1 CRM to WMS Events (9 events)

| Event | Description |
|-------|-------------|
| `customer.created` | New customer created in CRM |
| `customer.updated` | Customer details updated in CRM |
| `deal.approved` | Management approved deal (before customer offer) |
| `deal.accepted` | Customer accepted the offer |
| `deal.won` | Deal finalized, ready for WMS fulfillment |
| `deal.cancelled` | Deal cancelled by CRM |
| `deal.lines_updated` | Deal line items modified |
| `supply_request.created` | Manufacturing/import-from-central request created in CRM |
| `shipment.approved` | CRM approves shipment for a reservation (ON-HAND or INCOMING-BACKED). WMS creates PO/Order and generates `po_number`. |

### 3.2 WMS to CRM Events (18 events)

| Event | Description |
|-------|-------------|
| `inquiry.created` | New inquiry created in WMS |
| `inquiry.converted` | Inquiry converted to reservation |
| `reservation.created` | Reservation created |
| `reservation.released` | Reservation released (see release_reason) |
| `reservation.converted` | Reservation converted to order |
| `reservation.allocation_planned` | Reservation planned for arrived supply (no roll/lot yet) |
| `reservation.allocated` | Lot/roll/meters assigned; may require shipment approval |
| `order.created` | WMS Order created (MUST include `po_number`) |
| `order.picking_started` | Warehouse began picking |
| `order.prepared` | Warehouse finished picking and packing |
| `shipment.posted` | Shipment dispatched |
| `shipment.delivered` | Shipment delivered |
| `order.invoiced` | Invoice milestone (manual WMS action) |
| `order.fulfilled` | Closed and completed |
| `order.cancelled` | Cancelled in WMS |
| `stock.changed` | Inventory levels changed |
| `inventory.low_stock` | Low stock alert |
| `supply_request.status_updated` | Supply request milestone updated |

### 3.3 Removed Events (LOCKED)

- `deal.confirmed` — REMOVED, use `deal.won` instead

---

## 4. Canonical Status Dictionaries

### 4.1 CRM: deals.fulfillment_status (UNCHANGED)

`pending`, `reserved`, `picking`, `shipped`, `delivered`, `cancelled`

### 4.2 WMS: orders.status (UNCHANGED)

`draft`, `confirmed`, `reserved`, `picking`, `shipped`, `delivered`, `invoiced`, `fulfilled`, `cancelled`

### 4.3 WMS: reservations status (UNCHANGED)

- `reservations.status`: `active`, `released`  
- `reservations.release_reason` (when released): `expired`, `cancelled`, `converted`

### 4.4 WMS: orders.fulfillment_blocker_status (UNCHANGED)

`none`, `backordered`, `awaiting_incoming`, `needs_central_check`, `production_required`, `rejected`

### 4.5 SupplyRequest types (LOCKED)

`supply_requests.type`: `manufacturing`, `import_from_central`

### 4.6 SupplyRequest status (LOCKED)

`supply_requests.status`:
- `planned`
- `eta_confirmed`
- `in_transit`
- `arrived_soft` (**Arrived (Soft)**: no roll/lot yet, inventory NOT increased)
- `allocated`
- `closed`
- `cancelled`

### 4.7 Reservation allocation state (LOCKED)

`reservations.allocation_state`:
- `unallocated`
- `planned`
- `allocated`

### 4.8 Reservation ship intent (LOCKED)

`reservations.ship_intent`:
- `immediate`
- `ship_on_date`
- `unknown`

### 4.9 Reservation action required (LOCKED)

`reservations.action_required` BOOLEAN  
`reservations.action_required_reason` TEXT allowed values:
- `needs_allocation_plan`
- `needs_roll_entry`
- `needs_ship_date`
- `needs_customer_confirmation`
- `needs_shipment_approval`
- `needs_shortage_decision`
- `override_used`

### 4.10 Shipment approval override reasons (LOCKED)

If WMS Manager overrides shipment approval, WMS MUST record `override_reason` as one of:
- `customer_confirmed_email`
- `customer_confirmed_whatsapp`
- `customer_confirmed_phone`
- `customer_confirmed_text`
- `approval_link_received`
- `ship_immediate_policy`
- `manager_directive`
- `ops_emergency`
- `other`

---

## 5. Event to Status Transition Table

| Event | CRM deal fulfillment_status | WMS orders.status | Notes |
|-------|-----------------------------|-------------------|-------|
| `deal.won` | pending | — | Deal ready |
| `reservation.created` | reserved | — | Reservation exists |
| `supply_request.created` | no change | — | Supply request mirrored in WMS |
| `supply_request.status_updated` | no change | — | CRM mirrors milestones |
| `reservation.allocation_planned` | reserved | — | Planned; no roll/lot yet |
| `reservation.allocated` | reserved | — | Roll/lot entered; may need approval |
| `shipment.approved` | reserved | — | Triggers WMS to create PO/Order |
| `order.created` | reserved | confirmed | MUST include `po_number` |
| `order.picking_started` | picking | picking | |
| `order.prepared` | picking | picking | |
| `shipment.posted` | shipped | shipped | |
| `shipment.delivered` | delivered | delivered | |
| `order.invoiced` | no change | invoiced | |
| `order.fulfilled` | no change | fulfilled | |
| `deal.cancelled` | cancelled | cancelled | WMS sets action_required=true; requires soft-close |

---

## 6. Idempotency Key Standard (LOCKED)

Format:
`<source_system>:<entity>:<entity_id>:<action>:v1`

Examples:
- `crm:supply_request:<id>:created:v1`
- `wms:supply_request:<id>:status_updated:v1`
- `wms:reservation:<id>:allocation_planned:v1`
- `wms:reservation:<id>:allocated:v1`
- `crm:reservation:<id>:shipment_approved:v1`

---

## 7. PO Fulfillment Rules

### 7.1 Single-PO Full Fulfillment (LOCKED)

A **PO (`po_number` / WMS Order)** is a fully shipped unit.

- A PO MUST NOT be partially shipped.
- If only part of a deal can ship now, create a PO for the shippable portion and keep the remainder as a reservation for later PO.

### 7.2 PO Number generation (LOCKED)

- WMS generates `po_number` at `order.created`.
- WMS MUST include `po_number` in the `order.created` webhook payload to CRM.
- CRM MUST store `po_number` and use it as the primary reference in:
  - shipment approval inbox
  - deal “POs” section
  - customer email templates

### 7.3 Shipments per PO (DEFAULT POLICY)

- Default expectation: **1 shipment per PO**.
- If implementation supports multiple shipments, WMS MUST still enforce that a PO is fully shipped (no partial quantities).
- Any exception MUST be permission-gated and audit logged.

---

## 8. Partaj Allocation Model (Reservation-First)

**Definition (LOCKED):**  
Partaj is implemented using reservation allocation states and shipment approval gates. There is no separate “Partaj” entity.

**Reservation source rule (LOCKED):**
- If `reservations.crm_supply_request_id IS NULL` → reservation is **ON-HAND** (warehouse stock already exists).
- If `reservations.crm_supply_request_id IS NOT NULL` → reservation is **INCOMING-BACKED** (Partaj allocation flow applies).


### 8.1 Soft Arrival (LOCKED)

WMS MUST support `arrived_soft` where:
- supply is marked arrived
- reservations can be planned
- inventory is NOT increased
- roll/lot entry is NOT required yet

### 8.2 Reservation-first allocation (LOCKED)

Allocation happens in two steps:

1) `reservation.allocation_planned`  
   - ops decides which reservations will be fulfilled from arrived supply  
   - no roll/lot entered yet

2) `reservation.allocated`  
   - after physical separation, ops enters **lot + roll + meters**  
   - reservation becomes eligible for shipment approval flow

### 8.3 Shipment gating (LOCKED)

A PO (WMS Order) is created ONLY after **shipment approval** via either CRM approval or WMS manager override.

**Path A — INCOMING-BACKED (Partaj) reservations**
- Preconditions:
  - `reservations.crm_supply_request_id IS NOT NULL`
  - `reservation.allocation_state = allocated` (lot/roll/meters entered)
- Then either:
  - CRM sends `shipment.approved`, OR
  - WMS manager override is logged with `override_reason`

**Path B — ON-HAND reservations**
- Preconditions:
  - `reservations.crm_supply_request_id IS NULL`
  - WMS confirms reservation lines are fulfillable from on-hand stock
- Then either:
  - CRM sends `shipment.approved`, OR
  - WMS manager override is logged with `override_reason`

**Important (LOCKED):** ON-HAND reservations do **not** require `allocation_state=allocated` prior to shipment approval; lot/roll is captured during picking/prep.

### 8.4 Shortage handling (LOCKED)

If arrived supply is insufficient to fulfill multiple promised reservations:
- WMS MUST set `action_required=true` and `action_required_reason=needs_shortage_decision`
- WMS MUST block PO creation until a Sales Manager decision is recorded (audit logged)

---

## 9. Supply Requests (Manufacturing + Import-from-Central)

### 9.1 Ownership & mirroring (LOCKED)

- Supply requests are **created in CRM** and mirrored to WMS for operational tracking.
- WMS can update milestones (in transit, soft arrival, allocated, etc.) and must notify CRM via webhook.

**Manufacturing orders relationship (LOCKED):**
- WMS may keep its existing `manufacturing_orders` table.
- For `supply_requests.type='manufacturing'`, WMS MUST link the mirror record via `supply_requests.manufacturing_order_id` when such an operational manufacturing order exists.
- This contract does NOT require auto-creating manufacturing orders; it requires correct linkage and normalized milestone updates via `supply_request.status_updated`.

### 9.2 Relationship to reservations (LOCKED)

- A deal can have multiple supply requests and multiple reservations.
- Reservations may reference a supply request via `crm_supply_request_id`.

---

## 10. Cancellation Rules

- `deal.cancelled`: WMS sets `orders.status='cancelled'`, sets `action_required=true`, requires soft-close (audit logged).
- If a supply request is cancelled, WMS MUST not allocate it to reservations.

---

## 11. Picking Behavior Requirements (UNCHANGED)

Line-level adjustments (variance/substitution) require permission-gated approvals.

---

## 12. Pricing and Cost Ownership (UNCHANGED)

- Quote prices + commercial approvals: CRM  
- Inbound costs + actual lots picked: WMS

---

## 13. Required Schema Changes

### 13.1 CRM: supply_requests (NEW)

```sql
CREATE TABLE supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- manufacturing | import_from_central
  status TEXT DEFAULT 'planned',
  quality_code TEXT NOT NULL,
  color_code TEXT,
  meters NUMERIC(12,2) NOT NULL,
  eta_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 13.2 WMS: supply_requests mirror (NEW or extend existing manufacturing module)

```sql
ALTER TABLE supply_requests ADD COLUMN crm_supply_request_id UUID;
ALTER TABLE supply_requests ADD COLUMN crm_deal_id UUID;
ALTER TABLE supply_requests ADD COLUMN crm_customer_id UUID;
ALTER TABLE supply_requests ADD COLUMN crm_organization_id UUID;
ALTER TABLE supply_requests ADD COLUMN type TEXT;   -- manufacturing | import_from_central
ALTER TABLE supply_requests ADD COLUMN status TEXT; -- planned | eta_confirmed | in_transit | arrived_soft | allocated | closed | cancelled
ALTER TABLE supply_requests ADD COLUMN eta_date DATE;
ALTER TABLE supply_requests ADD COLUMN manufacturing_order_id UUID; -- optional FK to existing manufacturing_orders
```

### 13.3 WMS: reservations fields (NEW)

```sql
ALTER TABLE reservations ADD COLUMN crm_supply_request_id UUID;
ALTER TABLE reservations ADD COLUMN ship_intent TEXT DEFAULT 'unknown';
ALTER TABLE reservations ADD COLUMN ship_date DATE;
ALTER TABLE reservations ADD COLUMN allocation_state TEXT DEFAULT 'unallocated';
ALTER TABLE reservations ADD COLUMN action_required BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN action_required_reason TEXT;
```

### 13.4 WMS: orders (PO number + override logging) (NEW)

```sql
ALTER TABLE orders ADD COLUMN po_number TEXT;
ALTER TABLE orders ADD COLUMN override_used BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN override_reason TEXT;
ALTER TABLE orders ADD COLUMN override_notes TEXT;
ALTER TABLE orders ADD COLUMN override_by UUID;
ALTER TABLE orders ADD COLUMN override_at TIMESTAMPTZ;
```

### 13.5 WMS: reservation_lines + order_lines (line mapping) (NEW)

WMS MUST persist CRM line linkage on line records so CRM can reconcile meters and audits deterministically.

```sql
ALTER TABLE reservation_lines ADD COLUMN crm_deal_line_id UUID NOT NULL;
ALTER TABLE order_lines ADD COLUMN crm_deal_line_id UUID NOT NULL;
```


### 13.6 CRM: deal_orders (multi-PO support) (NEW)

```sql
CREATE TABLE deal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  wms_order_id TEXT NOT NULL,
  po_number TEXT NOT NULL,
  customer_reference_po TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 14. API and Webhook Contracts

### 14.1 CRM Exposes (UNCHANGED)

- `POST /crm-get-customer`
- `POST /crm-search-customers`
- `POST /crm-integration-api` (webhook receiver; HMAC validated)

### 14.2 WMS Exposes (UNCHANGED)

- `POST /api-get-inventory`
- `POST /api-get-catalog`
- `POST /api-create-order`

### 14.3 HMAC Signing (LOCKED)

Header: `X-Signature`, `X-Timestamp`  
Algorithm: HMAC-SHA256  
Payload: `JSON.stringify(body) + timestamp`  
Window: 5 minutes

### 14.4 Required payload fields (LOCKED)

**CRM → WMS: `shipment.approved` payload MUST include:**
- `wms_reservation_id`
- `crm_deal_id`
- `crm_customer_id`
- `crm_organization_id`
- `ship_intent`
- `requested_ship_date` (nullable)
- `approver_user_id`

WMS MUST:
- determine reservation source using `crm_supply_request_id`:
  - **INCOMING-BACKED**: validate `allocation_state=allocated`
  - **ON-HAND**: validate reservation lines are fulfillable from on-hand stock (no `allocation_state` requirement)
- create WMS Order (PO)
- generate `po_number`
- emit `order.created` including `po_number`

**WMS → CRM: `order.created` payload MUST include:**
- `wms_order_id`
- `po_number`
- `crm_deal_id`
- `crm_customer_id`
- `crm_organization_id`
- `lines[]` array (required) containing, per line:
  - `crm_deal_line_id`
  - `wms_order_line_id`
  - `quality_code`, `color_code`
  - `ordered_meters`

**WMS → CRM: `reservation.allocated` payload MUST include (line-level):**
- `wms_reservation_id`
- `crm_deal_id`
- `lines[]` array (required) containing, per allocated line:
  - `crm_deal_line_id`
  - `wms_reservation_line_id`
  - `quality_code`, `color_code`
  - `allocated_meters`
  - `lot_id` (or lot code)
  - `roll_id` (or roll code)

---

## 15. Notifications & Email Rules

### 15.1 Customer emails (LOCKED)

- Customer shipment emails are **human-approved only** (no automatic sends).
- Bulk send is allowed (e.g., “Loaded and on the way”, end-of-day “Delivered”).
- Customer emails MUST include:
  - `po_number`
  - line item details
  - optional `customer_reference_po` if present

### 15.2 Mandatory internal emails (minimum set, LOCKED)

(i) Supply request created → WMS Ops  
(ii) ETA near → WMS Ops + Sales Owner  
(iii) In transit confirmed → Sales Owner  
(iv) Soft arrival confirmed → Sales Owner + visible in CRM inbox  
(v) Approval needed (needs_shipment_approval) → Sales Owner/Manager  
(vi) Override used → Sales Manager

---

## 16. Required Pages & Views (LOCKED UX REQUIREMENTS)

### 16.1 CRM Pages (NEW)

1) **Supply Requests Dashboard**
- Create/manage manufacturing + import_from_central requests
- Status timeline mirrored from WMS

2) **Shipment Approval Inbox (Universal Gate)**
- Lists reservations where `action_required_reason` is:
  - `needs_shipment_approval` (applies to ON-HAND and INCOMING-BACKED)
  - `needs_ship_date`
  - `needs_shortage_decision`
- Must show reservation source derived from `crm_supply_request_id` (ON-HAND vs INCOMING-BACKED)
- Actions:
  - Approve shipment → emits `shipment.approved`
  - Set ship date / ship intent

3) **Deal Detail: Supply & POs**
- Shows:
  - supply requests
  - reservations (allocation_state, ship_intent)
  - all POs (`po_number`) under the deal (from `deal_orders`)
  - audit trail

### 16.2 WMS Pages (NEW)

1) **Supply Requests (Manufacturing + Import)**
- Actions:
  - Confirm In Transit
  - Mark Arrived (Soft)

2) **Allocation Planning Queue**
- Select reservations → set allocation_state=planned → emit `reservation.allocation_planned`

3) **Allocation Entry (Lot/Roll/Meters input)**
- Enter allocations → set allocation_state=allocated → emit `reservation.allocated`

4) **Ship Next Day (Staging Queue)**
- Shows POs (WMS Orders) created from shipment approval/override, primary display `po_number`.
- This is **post-PO** and is not the Partaj allocation step.

---

## 17. Implementation Notes

### 17.1 Inquiry is optional (LOCKED)

Inquiry is NOT mandatory. Flows may go directly to reservation or order, but all created objects must carry required CRM cross-links.

### 17.2 Spelling normalization (LOCKED)

Canonical spelling is `cancelled`. WMS must normalize any internal `canceled` to `cancelled` in outbound payloads and CRM-facing views.

---


**Auto-reservation on `deal.won` (LOCKED):**
- When WMS receives `deal.won`, it MUST attempt to create a reservation immediately.
- If on-hand stock is sufficient: create reservation (`reservations.crm_supply_request_id IS NULL`) and emit `reservation.created`.
- If on-hand stock is insufficient: create a reservation in **unallocated** state with `action_required_reason='needs_shortage_decision'` OR attach/require a `supply_request` flow (manufacturing/import) per business rules; do not silently drop.
- A deal must not remain in "won but not reserved" state without an explicit blocker/action_required path.

### 17.3 Derived UI stages (LOCKED)

**Command Center stage ordering (LOCKED):**
- Default ordering for display: Pending/Reserved → Awaiting Approval → PO Created → Picking/Prepared → Shipped → Delivered → Invoiced → Fulfilled/Closed → Cancelled.
- Note: Invoicing may occur after delivery; dashboards MUST show **Delivered** before **Invoiced** when both apply.


**Purpose:** enable "command center" dashboards without creating new canonical lifecycle states.

**Rule (LOCKED):** Derived UI stages are **computed** from canonical fields/events and may be displayed in UI, but MUST NOT be written as new values into:
- CRM `deals.fulfillment_status`
- WMS `orders.status`
- any other locked status dictionary

#### CRM: Fulfillment Command Center derived stages
- `pending_reserve` (exception only): `deals.fulfillment_status='pending'` AND no active reservation (`wms_reservation_id IS NULL`) — should be rare because `deal.won` must auto-attempt reservation
- `reserved`: `deals.fulfillment_status='reserved'`
- `awaiting_shipment_approval`: any linked reservation where `action_required_reason='needs_shipment_approval'`
- `awaiting_ship_date`: any linked reservation where `action_required_reason='needs_ship_date'`
- `po_created`: deal has ≥1 row in `deal_orders` (show all) 
- `in_progress`: `deals.fulfillment_status='picking'`
- `shipped`: `deals.fulfillment_status='shipped'`
- `delivered`: `deals.fulfillment_status='delivered'`
- `cancelled`: `deals.fulfillment_status='cancelled'`


**Deal aggregation rule (LOCKED):**
- A Deal is considered **OPEN** until the **last active PO** under the deal reaches a closure outcome.
- Closure outcomes for POs: `fulfilled` or `cancelled` (and `partial_closed` only if explicitly used as a closure outcome).
- In Command Center, if any PO is not closed, the Deal must remain OPEN and show a "PO Breakdown" with per-PO stages.

#### WMS: PO Command Center derived stages
- `incoming_soft_arrived`: supply_request.status='arrived_soft'
- `awaiting_allocation_plan`: reservations where `allocation_state='unallocated'` AND `crm_supply_request_id IS NOT NULL`
- `allocation_planned`: reservations where `allocation_state='planned'`
- `allocated_waiting_approval`: reservations where `allocation_state='allocated'` AND `action_required_reason='needs_shipment_approval'`
- `po_created`: orders where `po_number IS NOT NULL` AND `orders.status IN ('confirmed','picking','shipped','delivered','invoiced','fulfilled','cancelled')`
- `picking`: `orders.status='picking'` AND last_order_event != 'order.prepared'
- `prepared`: last_order_event = 'order.prepared' (UI-only; `orders.status` remains 'picking')
- `shipped`: `orders.status='shipped'` (driven by `shipment.posted`)
- `delivered`: `orders.status='delivered'` (driven by `shipment.delivered`)
- `invoiced`: `orders.status='invoiced'`
- `fulfilled`: `orders.status='fulfilled'`
- `blocked`: `orders.fulfillment_blocker_status != 'none'` OR `orders.action_required=true`

**Canonical constraint (LOCKED):** shipment movement states MUST use canonical shipment events (`shipment.posted`, `shipment.delivered`). Do NOT introduce `order.shipped` / `order.delivered` events.

## 18. Contract Lock Checklist

- [ ] Auto-reservation on `deal.won` is enforced (deal should not sit in won-without-reservation without action_required)
- [ ] Deal aggregation rule: Deal remains OPEN until last PO is closed; UI shows PO breakdown when mixed
- [ ] Command Center dashboards use Derived UI stages only; they do NOT write new lifecycle values into locked status dictionaries
- [ ] Pre-PO work anchors on reservation id; PO number is shown only after `order.created` generates it


- [ ] Filename is EXACT: `docs/integration_contract_v1.md`
- [ ] Contract copied byte-for-byte into BOTH repos
- [ ] `deal.confirmed` appears ONLY in Removed Events
- [ ] Idempotency keys have NO timestamps
- [ ] `po_number` is generated in WMS and included in `order.created` payload
- [ ] CRM stores all POs under a deal via `deal_orders` (including `customer_reference_po` when provided)
- [ ] WMS stores `crm_deal_line_id` on reservation/order lines and echoes it in events
- [ ] Shipment approval uses `shipment.approved`; WMS creates the PO/Order
- [ ] Single-PO full fulfillment enforced (no partial PO shipment)
- [ ] Soft arrival does not increase inventory
- [ ] Shipment approval for ON-HAND reservations does NOT require allocation_state=allocated (no deadlock)
- [ ] `arrived_soft` is displayed as "Arrived (Soft)" in UI
- [ ] Override requires reason code + audit logging

---

## 19. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.9 | 2026-01-20 | Lock Command Center stage set and aggregation rules; require auto-reservation attempt on `deal.won`; define derived stage ordering (Delivered before Invoiced); define deal-level stage as OPEN until last PO fulfilled/closed |
| 1.0.8 | 2026-01-20 | Add CRM `/fulfillment` and WMS `/po-command-center` command center dashboards; lock Derived UI stages as computed-only (no new canonical statuses); clarify pre-PO anchoring on reservation id; reinforce shipment events as canonical |
| 1.0.7 | 2026-01-20 | Fix shipment.approved gating to support ON-HAND reservations (no allocation_state requirement); clarify Partaj applies only to INCOMING-BACKED reservations; lock "Arrived (Soft)" UI label; rename shipment approvals as universal gate; add manufacturing_orders linkage via supply_requests.manufacturing_order_id |
| 1.0.6 | 2026-01-20 | Add `customer_reference_po` to `deal_orders`; require WMS line mapping with `crm_deal_line_id` on reservation/order lines; require line arrays in `order.created` and `reservation.allocated` payloads |
| 1.0.5 | 2026-01-19 | Lock PO number as primary identifier; lock single-PO full fulfillment; lock shipment.approved trigger; expand override reasons; lock supply request ownership (CRM) + WMS mirroring; lock Partaj reservation-first allocation + soft arrival; lock required pages + notifications |

---

## 20. Lock Statement

Any change to this contract requires:
1) Bumping version
2) Updating Last Updated
3) Adding Version History entry
4) Updating BOTH repos
5) Coordinating deployment timing

This contract is LOCKED.
