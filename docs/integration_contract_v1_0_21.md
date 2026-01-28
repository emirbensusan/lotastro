# CRM ↔ WMS Integration Contract v1.0.21

> **Status:** CANONICAL (Locked)  
> **Applies To:** CRM Phase 6+, WMS Batch F+  
> **Last Updated:** 2026-01-21  
> **Contract Identifier:** integration_contract_v1  
>
> **This file must be byte-identical in both CRM and WMS repositories.**

---

## Table of Contents
- 1. Canonical Entities (Owner, Identifiers)
- 2. Identifier Strategy (Deal ID vs PO ID vs Reservation ID)
- 3. Canonical Event Names & Payload Rules
- 4. Status Dictionaries (CRM + WMS)
- 5. State Transitions & Flow Rules
- 6. Idempotency, Ordering, Retries
- 7. PO Rules (Single-PO Fulfillment Invariant)
- 8. Reservations (On-hand vs Incoming-backed Partaj Logic)
- 9. Supply Requests (Import-from-central + Manufacturing)
- 10. Cancellation & Soft-Close Rules
- 11. Picking/Shipping/Delivery/Invoice Lifecycle
- 12. Pricing & Threshold Dependencies (Reference Only)
- 13. Required Schemas (CRM + WMS)
- 14. API Endpoints + Webhooks
- 15. Notifications (Human-approved Customer Emails)
- 16. Required Pages & Views (CRM + WMS + Command Centers)
- 17. Implementation Notes
- 18. Permissions & Human Gating
- 21. Samples
- 22. Payment Gating
- 23. Contract Lock Checklist
- 24. Version History
- 25. Lock Statement

## 1. Canonical Entities

| Entity | Owner | CRM Column | WMS Column | Notes |
|--------|-------|------------|------------|-------|
| Organization | CRM | `organization_id` | `crm_organization_id` | Multi-tenant isolation |
| UserOrgGrant | CRM | `user_org_grants.id` | `user_org_grants_mirror.id` | Grant-based access: which users can access which orgs; CRM is source of truth, mirrored to WMS |
| CustomerCreditProfile | CRM | `customer_credit_profiles.id` | — | Per-org customer commercial profile (payment mode, credit limits, overdue rules, etc.); customer is shared across orgs |
| Customer | CRM | `id` | `crm_customer_id` | CRM is source of truth |
| Deal | CRM | `id` | `crm_deal_id` | Commercial umbrella container (may create multiple POs) |
| DealLine | CRM | `deal_lines.id` | `crm_deal_line_id` on WMS reservation/order lines | Line-level commercial & fulfillment granularity; used for reservations, POs, and shipment mapping |
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

#### 2.1.1 Human-readable code format (org-prefixed, non-sequential)

- `deal_number` format: `{ORG}DL{CODE8}`
- `po_number` format: `{ORG}P{CODE8}`
- `CODE`: 8 chars Crockford Base32 (or ULID base32). Generated randomly.
- `ORG`: `organizations.code_prefix` (admin-editable; future-only)

**Hard rule:** No sequential numbering. Enforce uniqueness with DB constraints; regenerate on collision.
  
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

### 2.4 Multi-Company Access Grants (LOCKED)

- **One user, multiple companies:** users authenticate once, but access is controlled per-company via **org grants**.
- **Source of truth:** CRM owns grants (`user_org_grants`), WMS mirrors them (`user_org_grants_mirror`).
- **RLS enforcement:** any org-scoped row is visible only if the user has a grant for that org.
- **UI rule (no new pages):** if a user has >1 org grant, list views must show an org badge/column and allow filtering; if user has exactly 1 org grant, the org badge/column may be hidden.
- **Shared customer pool:** `customers` are global. Commercials are per-org (pricing, credit, payments, and balances) via `customer_org_profiles`.

---


### 2.5 Customer Onboarding Gate (LOCKED)

**Goal:** prevent first-order risk and enforce basic customer qualification without creating daily friction.

#### 2.5.1 Customer onboarding questions (CRM-owned, configurable)

CRM MUST support a configurable set of onboarding questions (v1 defaults):

1) Company established year (YYYY)  
2) Monthly lining/pocketing order amount (numeric + UOM: meters/kg)  
3) Forecasted purchase amount from our company (numeric + UOM: meters/kg)

These questions MUST be editable in CRM settings (labels + required flags), and stored per customer as structured fields + timestamps.

#### 2.5.2 Customer review status

CRM MUST store:
- `customers.review_status` in: `approved` | `pending_review`
- `customers.review_missing_fields` (optional JSON) for UI badges/queues

**Default (LOCKED):** New customers start as `pending_review` unless explicitly approved by Sales Manager/Admin.

#### 2.5.3 First-order “Won” gate (LOCKED)

Regardless of payment mode (cash/credit), a Deal for a `pending_review` customer MUST NOT transition to `won` unless **one** of the following is true:

A) Onboarding questions are complete AND `customers.review_status='approved'`  
B) Sales Manager/Admin applies an explicit override: `deal.customer_review_override=true` with a mandatory reason note (audited)

This gate is **per customer** (not per org), and is intended to protect the very first commercial commitment.

#### 2.5.4 Visibility & queues (UI rule)

- Sales Manager/Admin MUST have a bulk queue: `Customers Pending Review` (can be a tab under `/credit` or Manager Inbox).
- Sales Owners can create customers and proceed up to Draft/Submitted, but “Won” is gated as above.

## 3. Canonical Event Names

### 3.1 CRM to WMS Events (11 events)

| Event | Description |
|-------|-------------|
| `customer.created` | New customer created in CRM |
| `customer.updated` | Customer details updated in CRM |
| `deal.approved` | Management approved deal (before customer offer) |
| `deal.accepted` | Customer accepted the offer |
| `deal.won` | Deal finalized, ready for WMS fulfillment |
| `org_access.updated` | User org access grants updated (CRM source of truth). WMS must refresh `user_org_grants_mirror` |
| `deal.cancelled` | Deal cancelled by CRM |
| `deal.lines_updated` | Deal line items modified |
| `supply_request.created` | Manufacturing/import-from-central request created in CRM |
| `shipment.approved` | CRM approves shipment for a reservation (ON-HAND or INCOMING-BACKED). WMS creates PO/Order and generates `po_number`. |
| `payment.confirmed` | CRM confirms payment for a PO/reservation (cash customers + any payment-required scenarios). Unlocks shipment approval unless overridden. |
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
- `needs_warehouse_confirmation`
- `needs_ship_date`
- `needs_customer_confirmation`
- `needs_shipment_approval`
- `needs_shortage_decision`
- `override_used`

### 4.10 Shipment approval override reasons (LOCKED)

If shipment approval is overridden (either **CRM Sales Manager** or **WMS Manager**), the approving system MUST record `override_reason` as one of:
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


**Override audit fields (LOCKED):** `override_used`, `override_reason`, `override_notes`, `override_by`, `override_at` MUST be captured and mirrored to the other system via payload fields when override was the basis for approval.

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
- `crm:payment:<crm_po_id_or_reservation_id>:confirmed:v1`
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

**INCOMING-BACKED lot/roll rule (LOCKED):**
- INCOMING-BACKED reservations are created with `quality_code`, `color_code`, and meters only.
- Lot/Roll identifiers are **unknown** at reservation creation time and become known only after physical separation and Allocation Entry.
- A reservation MUST NOT be considered “ready for shipment approval” until `allocation_state='allocated'` (lot/roll + meters-per-roll captured) unless override is used.



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

**Path B — ON-HAND reservations (Warehouse Confirmation Required)**
- Preconditions:
  - `reservations.crm_supply_request_id IS NULL`
  - `reservation.allocation_state = allocated` (**warehouse-confirmed** lot + roll + meters per roll entered)
  - If actual availability differs from the requested lines, WMS MUST:
    - update reservation lines to the **actual** lot/roll list (no partial PO shipments), and
    - set `action_required=true` with an appropriate reason (`needs_customer_confirmation` or `needs_shortage_decision`), before shipment approval proceeds
- Then either:
  - CRM sends `shipment.approved`, OR
  - WMS manager override is logged with `override_reason`

**Important (LOCKED):** ON-HAND reservations MUST reach `allocation_state=allocated` (lot/roll confirmed) **before** shipment approval. This is the mandatory “warehouse check” gate to handle WMS stock drift and prevent promising incorrect stock to customers.

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

-- Lifecycle timestamps (NEW; for command center + audit)
ALTER TABLE orders ADD COLUMN picking_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN picking_started_by UUID;
ALTER TABLE orders ADD COLUMN prepared_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN prepared_by UUID;
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN shipped_by UUID;
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivered_by UUID;
ALTER TABLE orders ADD COLUMN invoiced_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN invoiced_by UUID;

-- Carrier details (captured at shipment)
ALTER TABLE orders ADD COLUMN carrier_type TEXT CHECK (carrier_type IN ('internal', 'external'));
ALTER TABLE orders ADD COLUMN carrier_name TEXT;
ALTER TABLE orders ADD COLUMN tracking_id TEXT;
```

### 13.5 WMS: reservation_lines + order_lines (line mapping) (NEW)

WMS MUST persist CRM line linkage on line records so CRM can reconcile meters and audits deterministically.

```sql
ALTER TABLE reservation_lines ADD COLUMN crm_deal_line_id UUID NOT NULL;
ALTER TABLE order_lines ADD COLUMN crm_deal_line_id UUID NOT NULL;

-- Samples (line-level)
ALTER TABLE reservation_lines ADD COLUMN sample_kind TEXT NULL CHECK (sample_kind IN ('tape','a4','half_meter','custom_meters'));
ALTER TABLE reservation_lines ADD COLUMN sample_notes TEXT NULL;
ALTER TABLE reservation_lines ADD COLUMN sample_meters NUMERIC NULL;
ALTER TABLE reservation_lines ADD COLUMN sample_pieces INT NULL;

ALTER TABLE order_lines ADD COLUMN sample_kind TEXT NULL CHECK (sample_kind IN ('tape','a4','half_meter','custom_meters'));
ALTER TABLE order_lines ADD COLUMN sample_notes TEXT NULL;
ALTER TABLE order_lines ADD COLUMN sample_meters NUMERIC NULL;
ALTER TABLE order_lines ADD COLUMN sample_pieces INT NULL;

-- Cutting audit (used for samples and occasional full orders)
ALTER TABLE reservation_lines ADD COLUMN is_cut BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reservation_lines ADD COLUMN cut_reason TEXT NULL;
ALTER TABLE reservation_lines ADD COLUMN cut_by UUID NULL;
ALTER TABLE reservation_lines ADD COLUMN cut_at TIMESTAMPTZ NULL;

ALTER TABLE order_lines ADD COLUMN is_cut BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE order_lines ADD COLUMN cut_reason TEXT NULL;
ALTER TABLE order_lines ADD COLUMN cut_by UUID NULL;
ALTER TABLE order_lines ADD COLUMN cut_at TIMESTAMPTZ NULL;

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

### 13.7 CRM: deals (customer_reference_po)

```sql
ALTER TABLE deals ADD COLUMN customer_reference_po TEXT;
```

### 13.8 CRM: mirror/cache tables (recommended)

> These tables are **internal to CRM** for fast UI, derived stage computation, and audit.  
> They mirror WMS state; they do **not** replace WMS as source of truth.

```sql
-- Reservation mirror
CREATE TABLE IF NOT EXISTS reservation_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  wms_reservation_id UUID NOT NULL UNIQUE,
  crm_deal_id UUID NOT NULL,
  crm_deal_line_id UUID NULL,
  status TEXT NOT NULL,
  allocation_state TEXT NOT NULL,
  ship_intent TEXT NULL,
  requested_ship_date DATE NULL,
  action_required BOOLEAN NOT NULL DEFAULT false,
  action_required_reason TEXT NULL,
  supply_request_id UUID NULL,
  last_event_name TEXT NULL,
  last_event_at TIMESTAMPTZ NULL,
  payload JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order/PO mirror
CREATE TABLE IF NOT EXISTS order_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  wms_order_id UUID NOT NULL UNIQUE,
  crm_deal_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'full',
  carrier_type TEXT NULL,
  carrier_name TEXT NULL,
  tracking_id TEXT NULL,
  picking_started_at TIMESTAMPTZ NULL,
  prepared_at TIMESTAMPTZ NULL,
  shipped_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  invoiced_at TIMESTAMPTZ NULL,
  last_event_name TEXT NULL,
  last_event_at TIMESTAMPTZ NULL,
  payload JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crm_deal_id, po_number)
);

-- Stock availability cache for pricing staleness "in-stock only"
CREATE TABLE IF NOT EXISTS stock_by_quality_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  quality_code TEXT NOT NULL,
  on_hand_meters NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, quality_code)
);
```

### 13.9 Organizations, Org Grants, and Multi-Org Rules (CRM-owned)

This contract supports **multiple legal entities (“organizations”)** sharing the same user accounts and (optionally) shared customer identity, while keeping all commercial records strictly **org-scoped**.

#### 13.9.1 organizations
- `organizations.id` UUID (PK)
- `organizations.code_prefix` TEXT **(admin-editable; applies to future codes only)**  
  Examples: `MOD`, `JTR`
- `organizations.display_name` TEXT
- `organizations.created_at`, `updated_at`

#### 13.9.2 user_org_roles (grant-based access)
Each user can be granted access to one or more organizations, with a **role per org**.

- `user_org_roles.id` UUID (PK)
- `user_org_roles.user_id` UUID (FK auth.users)
- `user_org_roles.organization_id` UUID (FK organizations)
- `user_org_roles.org_role` TEXT NOT NULL  
  Examples: `sales_owner`, `sales_manager`, `pricing`, `accounting`, `warehouse_staff`, `warehouse_manager`, `admin`, `viewer`
- `user_org_roles.is_primary_org` BOOLEAN DEFAULT FALSE  
  *(one primary org per user; used for default Active Org selection)*
- `user_org_roles.created_at`, `updated_at`

**RLS rule:** users can only read/write org-scoped records where they have a matching `user_org_roles` grant, except warehouse roles (see 13.9.6).

#### 13.9.3 user_active_org_preferences (Active Org)
- `user_active_org_preferences.user_id` UUID (PK)
- `user_active_org_preferences.active_org_id` UUID (FK organizations)
- `user_active_org_preferences.updated_at`

**Default:** when a user is created and later granted orgs, set Active Org to their `is_primary_org` org (if present).

#### 13.9.4 customers + customer_org_profiles (shared identity, org-scoped commercial rules)
**Global identity (shared):**
- `customers.id` UUID (PK)
- Global identity & communications only: name, contacts, phone/email, etc.
- `customers.primary_org_id` UUID (FK organizations, nullable) *(optional default routing / “primary owner”)*
- Global default addresses (optional): `customers.default_billing_address_id`, `customers.default_shipping_address_id`

**Org-scoped commercial profile:**
- `customer_org_profiles.id` UUID (PK)
- `customer_org_profiles.customer_id` UUID (FK customers)
- `customer_org_profiles.organization_id` UUID (FK organizations)
- `customer_org_profiles.status` TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
- `customer_org_profiles.is_primary_org_for_customer` BOOLEAN DEFAULT FALSE *(at most one true per customer)*
- `customer_org_profiles.account_owner_user_id` UUID (nullable)
- `customer_org_profiles.payment_mode` TEXT CHECK (payment_mode IN ('cash','credit'))
- `customer_org_profiles.credit_limits_by_currency` JSONB  
  Example: `{ "USD": 50000, "EUR": 0, "TRY": 0 }`
- `customer_org_profiles.default_due_days` INTEGER DEFAULT 30
- **Per-org address overrides (allowed):**
  - `customer_org_profiles.billing_address_override_id` UUID (nullable)
  - `customer_org_profiles.shipping_address_override_id` UUID (nullable)
- `customer_org_profiles.created_at`, `updated_at`

**Visibility rule (no leakage):**
- `customer_org_profiles` rows may exist for all orgs, but are **fully hidden by RLS** unless the user has a grant for that org.
- Multi-org roles (sales manager/pricing/accounting/admin) can view cross-org breakdowns **only for orgs they are granted**.

**Inactive profiles:**
- Salespeople in that org: cannot create deals for inactive profiles; visibility policy is implementation-specific.
- Managers: can view and activate.

#### 13.9.5 Org-scoped entities (hard boundary)
Each record belongs to **exactly one organization**:
- deals, deal_lines
- reservations
- deal_orders (POs)
- payments ledger entries
- credit/exposure snapshots
- pricing (list prices, customer prices)
- customer_org_profiles

WMS stock is shared across orgs, but **reservations and orders always inherit organization_id from the deal**.

#### 13.9.6 Warehouse roles (operate across orgs with minimal org UI)
Warehouse staff/managers must be able to pick/ship for all orgs without worrying about company context.

Contract rule:
- Warehouse roles SHOULD be granted to all orgs in `user_org_roles` for operational completeness.
- UI may hide org labels for warehouse roles by default; org can appear in detail views only when the user also has a non-warehouse org role.

#### 13.9.7 Human-readable identifiers (non-sequential, org-prefixed)
For deals and POs, use a non-sequential human code with an org prefix.

**Format:**
- Deal: `{ORG}-D-{CODE}`
- PO: `{ORG}-PO-{CODE}`

**CODE:** 8 chars Crockford Base32 (or ULID base32), generated randomly.  
**Uniqueness:** enforce DB unique constraint on `(organization_id, deal_number)` and `(organization_id, po_number)`; on collision, regenerate.

**Prefix changes:** changing `organizations.code_prefix` applies to **future** codes only (no retroactive renames).


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
- `payment_required_before_ship`
- `payment_status`
- `override_used` (boolean)
- `override_reason` (nullable; required if override_used=true)
- `override_notes` (nullable)
- `override_by` (nullable)
- `override_at` (nullable)
- `crm_deal_id`
- `crm_customer_id`
- `crm_organization_id`
- `ship_intent`
- `requested_ship_date` (nullable)
- `approver_user_id`

WMS MUST:
- determine reservation source using `crm_supply_request_id`:
  - **INCOMING-BACKED**: validate `allocation_state=allocated`
  - **ON-HAND**: validate `allocation_state=allocated` (warehouse-confirmed lot/roll/meters per line)
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

**WMS → CRM: `shipment.posted` payload MUST include:**
- `wms_shipment_id`
- `wms_order_id`
- `po_number`
- `crm_deal_id`
- `carrier_type` (`internal` | `external`)
- `carrier_name` (required if carrier_type=`external`)
- `tracking_id` (required if carrier_type=`external`)
- `shipped_at`

**WMS → CRM: `shipment.delivered` payload MUST include:**
- `wms_shipment_id`
- `wms_order_id`
- `po_number`
- `crm_deal_id`
- `delivered_at`

**WMS → CRM: `order.invoiced` payload MUST include:**
- `wms_order_id`
- `po_number`
- `crm_deal_id`
- `invoiced_at`


---


#### 14.X `org_access.updated` (CRM → WMS)

```json
{
  "event": "org_access.updated",
  "payload": {
    "user_id": "<supabase_auth_user_uuid>",
    "granted_org_ids": ["<crm_organization_uuid>", "..."],
    "revoked_org_ids": ["<crm_organization_uuid>", "..."],
    "changed_by": "<supabase_auth_user_uuid>",
    "changed_at": "<timestamptz>"
  }
}
```

Rules:
- CRM sends the **full** effective org list on every change (idempotent).
- WMS upserts/deletes in `user_org_grants_mirror`.
- All events remain signed per the shared webhook secret.

## 15. Notifications & Email Rules

### 15.1 Customer status emails (LOCKED)

- **Customer-facing operational status emails are CRM-owned** (templates + recipients + branding). **WMS MUST NOT email customers directly.**
- CRM may **auto-send** customer status updates based on WMS lifecycle events (idempotent; “at-most-once” from the customer’s perspective).
- Default status emails (per org, configurable in CRM):
  1) Picking started (optional; default **OFF**)  
  2) Prepared / packed (optional; default **OFF**)  
  3) Shipped (default **ON**)  
  4) Delivered (default **ON**)  
  5) Ship-date scheduled/updated (optional; default **OFF**)

Hard rules:
- If a customer has opted out of status emails, CRM must not send (internal logging still applies).
- Every status email MUST include:
  - org identity (From Name + signature/footer)
  - `po_number`
  - `customer_reference_po` if present
  - current status + timestamp
  - for shipped: `carrier_type`, `carrier_name`, `tracking_id` (if available)
- Manual bulk send remains allowed (e.g., end-of-day “Delivered” batch), but must still respect opt-out.

WMS event data requirements (minimum):
- `po_number` (and `deal_number` if available for CRM linking)
- lifecycle timestamps: `picking_started_at`, `prepared_at`, `shipped_at`, `delivered_at`
- carrier fields on `shipment.posted`
- line snapshot or stable line IDs (CRM can reconstruct from `order_mirrors`)
### 15.2 Mandatory internal emails (minimum set, LOCKED)

(i) Supply request created → WMS Ops  
(ii) ETA near → WMS Ops + Sales Owner  
(iii) In transit confirmed → Sales Owner  
(iv) Soft arrival confirmed → Sales Owner + visible in CRM inbox  
(v) Approval needed (needs_shipment_approval) → Sales Owner/Manager  
(vi) Override used → Sales Manager

---


## 16. Required Pages & Views (LOCKED UX REQUIREMENTS)

### 16.1 CRM pages (required)

**Primary:** **Fulfillment Command Center** — `/fulfillment`

Must include:
- **Stage cards** (derived from WMS/CRM states) with counts
- **Human Gates panel** (tabs):
  - Warehouse Confirmation (ON-HAND)
  - Payment Confirmation (cash-before-ship / credit blocks)
  - Shipment Approval (creates PO in WMS)
  - Ship Date Required
  - Shortage Decisions
- **Universal table** (filterable; includes sample badge + order_type filter)

**Other required CRM pages**
- **Supply Tracking** — `/supply-tracking` (manufacturing + import_from_central requests)
- **Pricing Command Center** — `/pricing` (missing prices, approvals, stale prices in stock, history)
- **Payments Ledger** — `/payments` (bulk import + receipts; Sales Manager only)
- **FX Rates** — `/fx-rates` (effective-datetime USDTRY/EURTRY ratebook; Sales Manager only)
- **Deal Detail** — `/deals/:id` must show: Fulfillment tab (supply, reservations, POs timeline), Pricing tab (line pricing + approvals), customer_reference_po

### 16.2 WMS Pages (NEW)

1) **Supply Requests (Manufacturing + Import)**
- Actions:
  - Confirm In Transit
  - Mark Arrived (Soft)

2) **Allocation Planning Queue**
- Select reservations → set allocation_state=planned → emit `reservation.allocation_planned`

3) **Allocation Entry (Lot/Roll/Meters input)**
- Enter allocations → set allocation_state=allocated → emit `reservation.allocated`

4) **Picking Queue**
- Shows POs where `orders.status='picking'` and warehouse is ready to start picking.
- Primary display is `po_number`.

---

## 17. Implementation Notes

### 17.1 Inquiry is optional (LOCKED)

Inquiry is NOT mandatory. Flows may go directly to reservation or order, but all created objects must carry required CRM cross-links.

### 17.2 Spelling normalization (LOCKED)

Canonical spelling is `cancelled`. WMS must normalize any internal `canceled` to `cancelled` in outbound payloads and CRM-facing views.

---


**Auto-reservation on `deal.won` (LOCKED):**
- When WMS receives `deal.won`, it MUST attempt to create a reservation immediately.
- If on-hand stock is sufficient: create reservation (`reservations.crm_supply_request_id IS NULL`), set `action_required=true` + `action_required_reason='needs_warehouse_confirmation'` + `allocation_state='unallocated'`, then emit `reservation.created`.
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
- `awaiting_warehouse_confirmation`: any linked ON-HAND reservation where `action_required_reason='needs_warehouse_confirmation'`
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
- `awaiting_warehouse_confirmation`: reservations where `crm_supply_request_id IS NULL` AND `allocation_state='unallocated'` AND `action_required_reason='needs_warehouse_confirmation'`
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


**Invoicing gate (LOCKED):** `order.invoiced` MUST occur before `order.fulfilled`.

**Invoice control gate (LOCKED):** After invoicing, orders MUST enter an invoice-control stage before final closure:
- WMS stores `invoice_control_status` in: `pending_control` | `passed` | `failed`
- Default after invoicing: `pending_control`
- `order.fulfilled` is allowed only if `invoice_control_status='passed'`
- Only WMS Ops (or configured management role) can set `passed/failed` and MUST add a note on `failed`.
- A bulk queue view with pagination is REQUIRED (WMS: invoice control queue).

## 21. Sample Orders (NEW)

**Goal:** support sample requests (tape/bant, A4 kağıt, yarım metre, custom meters) end-to-end with full auditability and Command Center filtering.

### 21.1 Order type (LOCKED)

All reservations, orders (POs), and deal_orders MUST carry an `order_type`:

- `full`
- `sample`

**Rule (LOCKED):** `order_type` MUST be filterable and badgeable in both Command Centers and list views.

### 21.2 Sample kinds (LOCKED)

If `order_type='sample'`, then each line MUST include `sample_kind`:

- `tape` (bant)
- `a4` (A4 kağıt)
- `half_meter` (yarım metre)
- `custom_meters`

And MUST include:
- `sample_notes` (nullable text)
- For `custom_meters`: `sample_meters` (NUMERIC(12,2)) is REQUIRED
- For `half_meter`: `sample_meters` MUST default to 0.50 unless explicitly overridden
- For `tape` and `a4`: `sample_pieces` (INT) is REQUIRED (default 1 if not provided)

### 21.3 Cutting behavior (LOCKED)

Samples may require cutting. Cutting may also be used for full orders in exceptional cases.

- Permission: `inventory:cut_roll`
- Any cut action MUST be audited with: `cut_reason` + `cut_by` + `cut_at`
- Contract invariant remains: **A PO is never partially shipped.** Partiality is modeled by splitting into a new reservation/PO.

### 21.4 Invoicing options for samples (LOCKED)

Samples go through the SAME shipment lifecycle events as full orders.

At invoicing stage, user may choose:
- **Invoice** (normal)
- **Free sample** (records `invoiced_at` with `invoice_type='free_sample'`)

**Rule (LOCKED):** Regardless of invoicing method, `order.invoiced` MUST occur before `order.fulfilled`.

## 22. Payment Gating (NEW)

**Goal:** prevent shipments until payment is confirmed for **cash / prepaid** scenarios, without introducing new lifecycle statuses.

### 22.1 Customer payment mode (CRM-owned, LOCKED)

CRM MUST store on customer (or customer profile):
- `payment_mode` in (`credit`, `cash`)
- optional: `credit_limit` numeric
- optional: `credit_used` numeric (or computed)

### 22.2 Per-PO payment gate (LOCKED)

Payment confirmation applies **per PO candidate** (per `deal_orders` row / `crm_po_id`). There is **no deal-level “unlock all future POs”**.

Each PO candidate MUST carry:
- `payment_required_before_ship` BOOLEAN DEFAULT false
- `payment_status` in (`not_required`, `pending`, `confirmed`)
- `payment_confirmed_at` TIMESTAMPTZ (nullable)
- `payment_confirmed_by` UUID (nullable)
- `payment_note` TEXT (nullable)

**Rule (LOCKED):**
- If `payment_required_before_ship = true`, then `shipment.approved` MUST NOT be sent unless `payment_status='confirmed'` **OR** an override is used (see below).
- `payment_status='confirmed'` may be set only via Sales Manager action (permissions below).

### 22.3 Who can confirm payment (LOCKED)

- Only **Sales Manager** role(s) may confirm payment.
- Bulk confirmation MUST be supported (multi-select in CRM Approval Inbox / Command Center).
- Bulk confirmation MUST write one audit record per PO candidate.

Required permissions:
- `payments:confirm`
- `payments:confirm:bulk_confirm`

### 22.4 Override behavior (LOCKED)

Overrides are allowed in **both systems**:
- **CRM Sales Manager override**: CRM may send `shipment.approved` even if payment is not confirmed, but MUST set `override_used=true` and include `override_reason` + audit fields.
- **WMS Manager override**: WMS may create PO/Order without CRM approval as already defined, and MUST also record override audit fields.

**Important (LOCKED):** Any override that bypasses payment gating MUST be visible in both Command Centers and must set:
- `reservations.action_required_reason='override_used'` (if pre-PO)
- `orders.override_used=true` (post-PO)

### 22.5 Event: `payment.confirmed` (CRM → WMS) (LOCKED)

CRM MUST emit `payment.confirmed` for the specific PO candidate (preferred) or reservation (pre-PO) when payment is confirmed.

Payload MUST include:
- `crm_deal_id`
- one of: `crm_po_id` (preferred) OR `wms_reservation_id`
- `payment_confirmed_at`
- `payment_confirmed_by`
- optional `payment_note`

WMS MUST:
- mirror payment fields on the matching reservation/order record
- unblock shipment approval queues where applicable
- include payment fields in Command Center filters

### 22.6 Required schema changes for payment gating (LOCKED)

**CRM: customers**
```sql
ALTER TABLE customers ADD COLUMN payment_mode TEXT DEFAULT 'credit';
ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(14,2);
ALTER TABLE customers ADD COLUMN credit_used NUMERIC(14,2);
```

**CRM: deal_orders (per-PO fields; REQUIRED)**
```sql
ALTER TABLE deal_orders ADD COLUMN payment_required_before_ship BOOLEAN DEFAULT false;
ALTER TABLE deal_orders ADD COLUMN payment_status TEXT DEFAULT 'not_required';
ALTER TABLE deal_orders ADD COLUMN payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE deal_orders ADD COLUMN payment_confirmed_by UUID;
ALTER TABLE deal_orders ADD COLUMN payment_note TEXT;
```

**WMS: reservations (pre-PO mirror; REQUIRED)**
```sql
ALTER TABLE reservations ADD COLUMN payment_required_before_ship BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN payment_status TEXT DEFAULT 'not_required';
ALTER TABLE reservations ADD COLUMN payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN payment_confirmed_by UUID;
ALTER TABLE reservations ADD COLUMN payment_note TEXT;
```

**WMS: orders (post-PO mirror; REQUIRED)**
```sql
ALTER TABLE orders ADD COLUMN payment_required_before_ship BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'not_required';
ALTER TABLE orders ADD COLUMN payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN payment_confirmed_by UUID;
ALTER TABLE orders ADD COLUMN payment_note TEXT;
```

## 18. Permissions & Human Gating

- Standard RBAC applies.
- **Bulk approval (LOCKED):** Permission `approvals:shipment:bulk_approve` allows bulk approval actions on Shipment Approval queues (CRM and WMS).
- **Payment confirmation (LOCKED):** Permission `payments:confirm` allows marking payment as confirmed.
- **Bulk payment confirmation (LOCKED):** Permission `payments:confirm:bulk_confirm` allows bulk payment confirmation.
- **Role constraint (LOCKED):** Only **Sales Manager** role(s) may hold `payments:confirm` / `payments:confirm:bulk_confirm`.

## 23. Contract Lock Checklist

- [ ] Samples are badgeable + filterable (`order_type='sample'`) across both Command Centers
- [ ] Payment gating is enforced when `payment_required_before_ship=true`
- [ ] Only Sales Manager can confirm payment (including bulk) via `payments:confirm*` permissions
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
- [ ] Shipment approval for ON-HAND reservations REQUIRES allocation_state=allocated via warehouse confirmation (lot/roll + meters per roll) OR manager override
- [ ] `arrived_soft` is displayed as "Arrived (Soft)" in UI
- [ ] Override requires reason code + audit logging

---

## 24. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.15 | 2026-01-21 | TOC/section cleanup; moved Permissions section; added payment.confirmed to CRM→WMS events table; clarified CRM read-only Warehouse Confirmation tab; added /credit required page; fixed ON-HAND validation wording. |
| 1.0.13 | 2026-01-21 | Add suggested-next-action UX in CRM shipment approvals; clarify INCOMING-BACKED lot/roll unknown until allocation; add carrier fields + lifecycle timestamps to WMS orders schema; require shipment/delivery/invoice payload fields |
| 1.0.12 | 2026-01-21 | Add mandatory ON-HAND warehouse confirmation (lot/roll + meters per roll) via reservation allocation before shipment approval; add `needs_warehouse_confirmation`; add derived stages for awaiting warehouse confirmation; update auto-reservation rule on deal.won and lock checklist |
| 1.0.11 | 2026-01-20 | Tighten Payment Gating: Sales Manager-only (bulk capable), per-PO only (no deal-level unlock), add `payment.confirmed` to CRM→WMS events + idempotency, require payment fields on CRM deal_orders + WMS reservations/orders, and require shipment.approved payload to carry payment + override fields |
| 1.0.10 | 2026-01-20 | Add carrier fields + lifecycle timestamps to WMS orders; lock invoicing gate (invoiced before fulfilled); add bulk shipment approval permission; add Sample Orders (order_type + sample_kind/tape/a4/half_meter/custom + notes + cutting audit); add Payment Gating (cash/credit) with payment.confirmed event; clarify CRM /fulfillment required and add filters |
| 1.0.9 | 2026-01-20 | Lock Command Center stage set and aggregation rules; require auto-reservation attempt on `deal.won`; define derived stage ordering (Delivered before Invoiced); define deal-level stage as OPEN until last PO fulfilled/closed |
| 1.0.8 | 2026-01-20 | Add CRM `/fulfillment` and WMS `/po-command-center` command center dashboards; lock Derived UI stages as computed-only (no new canonical statuses); clarify pre-PO anchoring on reservation id; reinforce shipment events as canonical |
| 1.0.7 | 2026-01-20 | Fix shipment.approved gating to support ON-HAND reservations (requires allocation_state=allocated); clarify Partaj applies only to INCOMING-BACKED reservations; lock "Arrived (Soft)" UI label; rename shipment approvals as universal gate; add manufacturing_orders linkage via supply_requests.manufacturing_order_id |
| 1.0.6 | 2026-01-20 | Add `customer_reference_po` to `deal_orders`; require WMS line mapping with `crm_deal_line_id` on reservation/order lines; require line arrays in `order.created` and `reservation.allocated` payloads |
| 1.0.5 | 2026-01-19 | Lock PO number as primary identifier; lock single-PO full fulfillment; lock shipment.approved trigger; expand override reasons; lock supply request ownership (CRM) + WMS mirroring; lock Partaj reservation-first allocation + soft arrival; lock required pages + notifications |

---
## 25. Lock Statement

Any change to this contract requires:
1) Bumping version
2) Updating Last Updated
3) Adding Version History entry
4) Updating BOTH repos
5) Coordinating deployment timing

This contract is LOCKED.


---

## 24. Org Grants, Identifiers, and CRM-Only Deal Enhancements (ADDENDUM, LOCKED)

> This section adds **governance/UI rules** that do **not** change the existing page structure and do not alter the core WMS↔CRM integration contract logic. It exists to prevent future spaghetti.

### 24.1 Org model (LOCKED)

- Two legal entities/orgs exist (e.g., `MOD`, `JTR`).
- Users are shared (single login); data is strictly **org-scoped** for commercial records.
- Access is granted via **user ↔ org ↔ role** grants (per-org role possible).
- Warehouse roles may be granted **both orgs** for operational continuity, while the UI can hide org labels by role.

### 24.2 Global customer identity + per-org commercial profile (LOCKED)

- `customers` is **global identity** (name, contacts, addresses defaults).
- `customer_org_profile` is **org-scoped commercial**:
  - credit limits per currency, payment_mode, terms, account owner, waiver flags, etc.
  - `status` enum: `active | inactive`

**Visibility / safety rule (LOCKED):**
- Users with access only to Org-A must not be able to infer Org-B exists.
- Therefore RLS hides all org rows not granted.
- Multi-org roles can view multi-org breakdowns.

**Inactive behavior (LOCKED):**
- Salespeople can still **see and sell** to inactive profiles (you chose NOT to hard-hide); however:
  - any shipment/payment/credit gate still applies.
  - Sales Manager/Admin can activate/deactivate and owns governance.

### 24.3 Supply Requests: requested_for_org_id (LOCKED)

- `supply_requests.requested_for_org_id` is **MANDATORY**.
- It is **metadata-only** in v1:
  - Never blocks allocation, reservation, shipment approval, or PO creation.
  - Never triggers intercompany accounting.
  - Used only for reporting/audit and future costing work.

### 24.4 Human identifiers: Deal code vs PO code (LOCKED)

To avoid confusion and keep identifiers non-guessable:

- `deal_code` format: `{ORG}{8_BASE32}` (example: `MOD8F3K2Q7A`)
- `po_number` format: `{ORG}{8_BASE32}` (example: `JTR9K1M0P2D`)

Rules:
- `deal_code` and `po_number` are **different** fields and **never the same**.
- `po_number` is the **customer anchor** in shipment communications.
- Admin can edit org prefix values for **future** codes only (no retroactive renaming).

Collision safety:
- DB unique constraint per field (`deal_code` unique, `po_number` unique).
- On collision, regenerate (practically impossible).

### 24.5 Quality scope (GLOBAL/MOD/JTR) (LOCKED)

Catalog items are shared, but you also have rare org-specific items.

- Add `quality_scope` enum on catalog items: `GLOBAL | MOD | JTR`
- Visibility:
  - If user has org grant MOD → see `GLOBAL` + `MOD`
  - If user has org grant JTR → see `GLOBAL` + `JTR`
  - If granted both → see all
- Pricing remains org-scoped.

### 24.6 CRM Deal Approval workflow (Sales Manager) (CRM-only, LOCKED)

**Intent:** Sales Manager approves the *deal correctness*; customer confirmation still drives `deal.won`.

Deal internal states (CRM-only):
- `draft` → `submitted` → (`approved` | `reworked` | `rejected`)
- Rework (`reworked`) returns deal to **draft** and requires manager notes.
- Reject (`rejected`) is a terminal state for that version; salesperson can clone to a new draft version later.

**Approve means (LOCKED):**
- Approve deal fully (pricing + terms + lines) → allows salesperson to mark `deal.won` when customer confirms.
- It does **not** auto-reserve or create POs.

**Edits while pending approval (LOCKED):**
- If salesperson edits qty/color/lines after submit but before manager action:
  - System auto-reverts deal to `draft`
  - logs “changed after submit” (audit)
  - requires resubmission

**Copy / related deals (CRM-only, LOCKED):**
- “Copy from previous deal” copies:
  - line items (quality/color/uom/qty) + last approved prices for that customer
  - and stores `copied_from_deal_id` (and displays won/lost state)
- “Related” is explicit linking (manual), plus automatic relation when copied.

### 24.7 UOM support for KG-selling qualities (WMS+CRM readiness, LOCKED)

Define `uom` (Unit of Measure): `m` (meters) or `kg` (kilograms).

Catalog must provide allowed UOM per quality:
- `uom_mode`: `METERS_ONLY | KG_ONLY | BOTH`

Deal lines and reservation lines must include:
- `uom` + `qty`

v1 constraints:
- No automatic conversion between kg↔meters.
- KG qualities can be added later without breaking flows.

### 24.8 Printing/design assets (CRM-only, LOCKED)

- Designs are stored in **CRM** storage (Supabase bucket).
- Create CRM-only entities:
  - `design_assets` (file + metadata)
  - `print_requests` (links design_asset → deal_line; print specs + contractor notes)
- Printing is an **attribute** of the deal/line, not a WMS supply trigger in v1.

### 24.9 Cash customer pack: Proforma + Contract draft (CRM-only gates, LOCKED)

For cash/proforma customers:

- On `deal.won`, CRM generates:
  - Proforma invoice PDF (download + send)
  - Contract draft PDF (download + send), unless contract waived

**Contract waiver (LOCKED):**
- Waiver is a per-customer-per-org setting (typically for credit customers).
- Waiver changes require Sales Manager/Admin note + audit.

Shipment approval rule for cash customers:
- `shipment.approved` is blocked unless:
  - payment confirmed (per PO), AND
  - contract requirement satisfied (signed_received) OR waived

Proforma numbering (LOCKED):
- `MOD{YYYY}PI{deal_code}` (example: `MOD2026PIMOD8F3K2Q7A`)
- (Numeric-only constraint can be applied later if needed; do not block v1.)



---

# Addendum (v1.0.21) — Org Grants, Order Form, Abra Checks, Proforma Balance Gate, Post-PO Rework, and Costing

**Effective date:** 2026-01-26 (Europe/Istanbul)  
**Status:** LOCKED (agent-proof)

This addendum extends v1.0.18 without changing existing page structure. If any earlier clause conflicts, this addendum wins.

## A. Multi-Org Model (2 legal entities, shared users & (partly) shared customers)

### A.1 Definitions
- **Org / Company**: legal entity that owns deals/POs/pricing/credit/payments/documents (e.g., **MOD** vs **JTR**).
- **Customer (global)**: one identity record shared across orgs.
- **Customer Org Profile**: per-org commercial record (credit terms, balances, owners, etc.).
- **Org Grants**: user permissions to see/act within an org, without separate logins.

### A.2 Core data model (required)
**Global**
- `customers` (identity): name, contacts, default addresses, tax refs (if any), etc.

**Per-org**
- `customer_org_profiles` (commercial):  
  `org_id`, `customer_id`, `status` (active|inactive), `payment_mode`, `default_terms_days`, `credit_limits_by_currency`, `account_owner_user_id`, `primary_org` (bool), risk flags, waiver flags, etc.

**Rule: auto-create profiles without leakage**
- A `customer_org_profile` MAY exist for both orgs.
- **RLS hides non-granted org rows completely** (a user with only Org-A should not see Org-B exists).
- Multi-org roles can see breakdown across orgs (including zero balances).

### A.3 customer_org_profile.status behavior (LOCKED)
- If `status=inactive` for an org:
  - **Salespeople** in that org: **cannot search/see** the customer under that org; **cannot create deals**.
  - **Sales Manager/Admin** (with grant) can see inactive and can activate (single click + audit log).
- Multi-org users can see inactive profiles (for oversight only).

### A.4 Org Granting model (LOCKED)
- Granting is **user↔org + role per org** (a user may be Sales in Org-A, Viewer in Org-B).
- Default for new user: **no org grants** (sees nothing until granted).
- Org grants can be managed by: **Sales Manager + Admin**.
- Warehouse roles: may be granted **both orgs** (RLS-wise) but UI can de-emphasize org.

### A.5 Active Org + Multi-Org scope (LOCKED)
- App supports a **Hybrid org scope**:
  - Most roles operate in **single Active Org** mode by default.
  - Sales Manager/Accounting/Pricing can switch scope to **All Orgs** (combined table with org column; filterable).
- Active Org is stored per user preference:
  - default = the first org assigned at user creation
  - can be changed by user (if granted)

## B. Identifiers (non-sequential, org-prefixed, collision-safe)

### B.1 Code format (LOCKED)
- **Deal code** (CRM-facing): `{ORG3}DL{CODE8}`  
  Example: `MODDL8F3K2Q7A` (no dashes)
- **PO/Order code** (WMS-facing anchor): `{ORG3}P{CODE8}`  
  Example: `MODP8F3K2Q7A`
- `CODE8` is Base32 (A–Z, 2–7) or equivalent; generated randomly.
- Database enforces **UNIQUE** per code; on collision regenerate (practically never collides).

### B.2 Prefix management (LOCKED)
- Org prefix is admin-configurable for **future** codes only (never retroactively renames historical codes).

### B.3 Deal vs PO relationship (LOCKED)
- Deal code ≠ PO code.  
  A deal can produce multiple POs; PO code is the fulfillment anchor.

## C. Catalog scope (GLOBAL / MOD / JTR) and visibility

### C.1 Catalog scope field (LOCKED)
Replace/standardize catalog scoping as:
- `scope` enum: `GLOBAL | MOD | JTR` (mandatory)
- Visibility:
  - If user granted MOD: sees `GLOBAL + MOD`
  - If user granted JTR: sees `GLOBAL + JTR`
  - If granted both: sees all

### C.2 Ownership & inventory accounting
- `scope` also implies **inventory book ownership** by default:
  - `scope=MOD` → inventory owned by MOD
  - `scope=JTR` → inventory owned by JTR
  - `scope=GLOBAL` → shared sellability; inventory ownership uses `inventory_owner_org_id` (config, default JTR)

## D. Proforma “Balance Check” gate (before download/send)

### D.1 Purpose
Before generating/sending a proforma, CRM must show:
- Total Open (exposure) in org + currency
- Overdue (hard block)
- Available Limit
- Requested New Proforma amount

### D.2 Behavior (LOCKED)
- Overdue > 0: already hard-blocks shipment; proforma can still be generated but must include a warning line.
- Non-overdue open balance: proforma generation is allowed but email/PDF must include:
  - “Order will not be fulfilled unless overdue is paid” (editable email draft)
- Proforma can be generated/sent by **salesperson**; shipment/payment confirmations remain manager-controlled.

### D.3 State correctness (clarification)
If you track `proforma_status`, enforce:
- `paid_confirmed` requires:
  - payment ledger entry AND
  - Sales Manager payment confirmation event (prevents false “paid” states)

## E. Central Stock (Abra) Check Workflow (LOCKED)

**Goal:** ensure “central stock vs manufacturing” decisions are based on an acknowledged Abra check, with structured outcomes (no WhatsApp chaos), without adding unnecessary gates elsewhere.

### E.1 When Abra check is required (WMS-enforced)

Abra check is required **only** when WMS is about to mark a PO/reservation line as **cannot be fulfilled from on-hand** and wants to “send back / mark shortage / return to CRM for decision”.

**LOCKED rule:** In WMS, the “Send back (No On-Hand / Shortage)” action MUST hard-block unless the user records an Abra check result for the affected line(s).

(There is no Abra gate on Deal submission, Deal won, or shipment approval—only on the WMS no-on-hand send-back path.)

### E.2 Granularity (LOCKED)

Abra check is **per line** (quality + color [+ optional lot preference]):

- `central_stock_check_lines` keyed by (`po_id` OR `reservation_id`, `line_id`)

### E.3 Required fields (LOCKED)

Each check line MUST store:

- `checked_at`, `checked_by`
- `result` in: `found_in_abra` | `not_in_abra` | `uncertain`
- `available_qty` (nullable numeric; required if `found_in_abra`)
- `proposed_next_step` in:
  - `import_from_central` (ETA bucket default 2–3 weeks)
  - `manufacture` (ETA bucket default 4–5 weeks)
  - `needs_central_confirmation` (uncertain)
- `eta_text` (nullable; free text) + `eta_bucket` (optional enum)

### E.4 Events (WMS → CRM)

When WMS completes (or updates) a check line, WMS MUST emit:

- `central_stock_check.completed` (or `.updated`), payload includes fields above + identifiers.

CRM MUST render this result on the Deal/PO context so Sales can respond consistently.

### E.5 Outcome usage (policy)

Abra results are **metadata** and MUST NOT auto-block or auto-create manufacturing/import records by themselves.

They exist to:
- standardize ETAs and next-step proposals
- drive consistent customer messaging
- provide auditability of “we checked Abra”


## F. Order Form (customer self-service) — tokenized, one-time, non-editable

### F.1 Link mechanics (LOCKED)
- Generated by sales/sales manager: `/order-form/<token>`
- Token:
  - `expires_at` configurable
  - `max_submissions=1`
  - can be **regenerated/unexpired** by internal user for the same request context
- After submission:
  - customer cannot edit (no self-serve edit)
  - internal user can edit and **resend confirmation** (with changed-field diff)

### F.2 Submission behavior (LOCKED)
- Creates a **Deal** in CRM:
  - `submitted_from_form=true`
  - `deal_status=submitted`
- Confirmation email: “we received your request + details below”
  - uses a **public request reference** (not internal deal id)

### F.3 Bulk lines + template upload
- Form supports up to **20 lines**.
- For more lines: customer uses Excel template upload (lines-only, Turkish headers, strict validation).

### F.4 Attachments (LOCKED)
- Customer may upload attachments (pdf/excel/images) stored in CRM bucket.
- Attachments are **internal only**; not auto-shared back to customer.

### F.5 Extra fields (LOCKED)
- Lab work per line (status workflow)  
- Customer carrier preference: “use my carrier” + optional details  
- Optional “lab çalışması” request per line

## G. Post-PO discrepancy loop (WMS → CRM visible, line-level blocking)

### G.1 When WMS can raise an issue (LOCKED)
- Any time after PO created.

### G.2 Scope of block (LOCKED)
- Blocks **affected lines only**; other lines may proceed.

### G.3 Resolution ownership (LOCKED)
- Salesperson can propose resolution; **Sales Manager approves** (or resolves directly).
- Customer communication is auto-drafted (no manual-only mode).

### G.4 Lot change rule (LOCKED)
- Roll swap is operational.
- **Lot swap** is allowed but must be flagged and requires **customer approval** (auto-draft).

## H. Costing & Inventory Valuation (WMS + CRM)

### H.1 Goals
- Capture supplier invoices and landed costs in WMS.
- Support roll-level receipt cost basis (v1A) AND weighted average cost (v1B).
- Provide org-level inventory reporting based on catalog ownership rules (scope/owner).

### H.2 Valuation methods (LOCKED)
- Store receipt cost basis at lot/roll (source of truth).
- Compute:
  - Receipt basis (no averaging) for traceability
  - WAC (TRY base) for reporting
- FIFO readiness: keep receipt lots/rolls so FIFO can be added later without schema breaks.

### H.3 FX handling (LOCKED)
- Supplier invoices may specify an explicit FX rate; user selects/overrides rate per invoice (audited).
- Store:
  - original currency amounts
  - selected FX rate
  - computed TRY amounts
- Profitability reporting must also support FX views (original currency + TRY converted).

### H.4 Org interaction (LOCKED)
- Inventory ownership for accounting/reporting is driven by catalog scope/owner.
- MOD selling JTR-owned goods is handled commercially as JTR→MOD sale (see Section I below), not as free “transfer”.

## I. MOD as customer of JTR (intercompany reality, no special rules)

### I.1 Principle (LOCKED)
MOD is treated as a **regular credit customer** of JTR.
No free inventory transfers.

### I.2 Automation (LOCKED)
If an external deal is in org=MOD and consumes JTR-owned catalog items:
- At **shipment approval time**, CRM auto-creates a linked internal **JTR→MOD deal/order** (no extra human gate).
- Default internal pricing is **suggested/copied** from the external MOD deal price; Sales Manager can adjust.

### I.3 Gating (LOCKED)
Shipment approval must also respect:
- MOD’s credit/overdue status as a customer in JTR (regular credit rules).
If overdue/overlimit, shipment approval is blocked unless manager override (shown in the same approval screen).

