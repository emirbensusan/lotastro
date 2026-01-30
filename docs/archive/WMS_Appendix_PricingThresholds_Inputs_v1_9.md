# WMS Appendix — Inputs for CRM Pricing/Thresholds (v1.0.21)
**Aligned with:** Integration Contract v1.0.17

This appendix clarifies what WMS must provide so CRM can run pricing staleness + thresholds without querying inventory or costs in real-time.

---

## A) Catalog (qualities)
WMS is source of truth for catalog items.

### Required fields
- `quality_code`
- `quality_name`
- `org_id` (nullable; if NULL the item is shared across orgs; if set, item is org-specific)
- `active` (bool)
- `active` (bool)

### Sync method
- **Nightly sync** from WMS → CRM (recommended)
- Optional: **"Sync Catalog Now"** button in CRM triggers an on-demand pull (implementation detail)

---

## B) Stock awareness (aggregate, not roll-level)
CRM only needs **“is this quality in stock?”** and **approx on-hand meters** to enforce “stale prices in stock”.

### Preferred mechanism (required)
- WMS emits **`stock.changed`** events containing aggregate `quality_code → on_hand_meters` deltas or snapshots.
- CRM maintains `stock_by_quality_cache`.

### Optional helper (nice-to-have, not required)
- A backfill endpoint (for initial cache bootstrap), e.g. `api-get-stock-by-quality` returning snapshots.

---

## C) No pricing, no credit, no payments in WMS
WMS must **not** compute:
- list/customer prices
- discounts
- credit exposure
- payment confirmation

WMS receives **executable POs only** after CRM shipment approval (or WMS manager override).

---

## D) Shipment carrier + lifecycle fields
WMS owns carrier capture and operational timestamps.

### Required on orders
- `carrier_type` ('internal' | 'external')
- `carrier_name` (required if external)
- `tracking_id` (required if external)
- timestamps: `picking_started_at`, `prepared_at`, `shipped_at`, `delivered_at`, `invoiced_at`, `fulfilled_at`

### Required events to CRM
- `shipment.posted` includes carrier fields
- `order.status_changed` includes lifecycle timestamps

## Multi-Org Grants (NEW)

- WMS must enforce org-scoped RLS using `crm_organization_id` and `user_org_grants_mirror`.
- WMS receives org grants from CRM via `org_access.updated` events (or admin seed).
- Warehouse roles can be granted multiple orgs; UI may hide org labels for those roles.


## D) Warehouses (future-proofing; minimal in v1)

WMS SHOULD model physical warehouses separately (stock pools are physically separate). To stay future-ready without changing UI now:

- Add `warehouse_id` to WMS stock, reservations, and orders (default to the user's assigned warehouse).
- In v1, CRM does not manage warehouses; WMS keeps internal assignment.

## E) Supply Requests origin (informational only)

If WMS creates/maintains `supply_requests`, include:

- `requested_for_org_id` (NOT NULL): the org that originated the request (for reporting)
- Allocation consumption is always tracked by reservations/orders (org-scoped).
- v1 does **not** implement inter-company accounting; if supply requested_for_org_id differs from consuming org, log an audit note (no automatic blocking).


---

## Addendum — Multi-Org + Catalog Extensions (LOCKED)

### Catalog fields WMS must expose to CRM
- `quality_code` (global identifier)
- `quality_scope`: `GLOBAL | MOD | JTR`
- `uom_mode`: `METERS_ONLY | KG_ONLY | BOTH`
- `active` flag

### Stock signals
- Stock remains warehouse-scoped (future: warehouse_id), and org-neutral (shared across orgs within a warehouse).
- CRM staleness uses `stock.changed` aggregated by quality_code (per warehouse optional later).

### Org on operational objects
- Orders/reservations remain org-scoped (inherit org from deal/reservation).
- Warehouse roles can operate across orgs; org display can be role-gated.

### Supply Requests
- `requested_for_org_id` is mandatory metadata only; does not gate allocation/ship in v1.


---

# Addendum (v1.0.21 alignment) — Org Scope Catalog, Central Stock Checks, Post-PO Issues, and Costing

## 1) Catalog scope
- Catalog items MUST have `scope` enum: GLOBAL | MOD | JTR (mandatory)
- Visibility: granted org sees GLOBAL + their org.

Optionally keep:
- `inventory_owner_org_id` (mandatory for scope=GLOBAL; default JTR)

## 2) Central stock checks (Abra) — WMS responsibilities (LOCKED)

### 2.1 New queue
Route: `/central-stock-checks`

### 2.2 How checks are created
Checks can be created by either:
- WMS user action when on-hand cannot fulfill and they need to “send back (No On-Hand/Shortage)”, or
- CRM request (optional) — if CRM already has a “request central check” button.

Regardless of creation source, WMS is the execution UI and must complete the result per line.

### 2.3 Required fields on completion
WMS user must set:
- `result`: `found_in_abra` | `not_in_abra` | `uncertain`
- `available_qty` (required if found_in_abra)
- `proposed_next_step`: `import_from_central` | `manufacture` | `needs_central_confirmation`
- `eta_text` (optional)

Then WMS emits completion/updated event to CRM.

### 2.4 Enforcement rule (WMS)
The WMS action **“Send back (No On-Hand/Shortage)”** must hard-block unless each affected line has a completed check result.

## 3) Post-PO discrepancy loop
WMS MUST support:
- Flagging issues after PO creation (line-level)
- Issue reasons: shortage, wrong lot, damaged roll, etc.
- Block only affected lines
- Sync issue + updates to CRM

Lot swap policy:
- roll swap is operational
- lot swap is allowed but must be flagged (CRM will require customer approval)

## 4) UOM readiness
Catalog exposes allowed UOM:
- uom_primary (MT|KG)
- uom_allowed (MT_ONLY|KG_ONLY|BOTH)
Orders/reservations store uom + qty.

## 5) Costing & valuation
WMS captures:
- supplier invoices (org, supplier, currency)
- selected FX rate (audited)
- landed cost components
- lot/roll receipt basis cost
- WAC in TRY base (derived)

WMS should publish mirrors to CRM for reporting (not gating).

## 6) Invoice export + invoice control (LOCKED)
- WMS must support generating an **invoice-ready payload** after packing/shipping.
- Format in v1: simple XML/JSON payload (not full UBL).
- Payload schema must be **configurable** (settings-managed mapping) to align with Logo Tiger/Wings import requirements.
- Pricing truth comes from CRM at `shipment.approved` (locked price snapshot) and is cached on the WMS order.
- WMS stores:
  - `invoice_status`: `not_issued` | `issued`
  - `invoice_control_status`: `pending_control` | `passed` | `failed`
- Order closure/fulfillment should rely on `invoice_control_status='passed'`.
- Provide a bulk queue with pagination + excel export for invoice control.

## Customer Status Email Support (Data Only)
WMS MUST provide enough data for CRM to send customer status emails (WMS does **not** send customer emails):

- lifecycle timestamps on orders: `picking_started_at`, `prepared_at`, `shipped_at`, `delivered_at`
- carrier fields on shipments: `carrier_type`, `carrier_name`, `tracking_id`
- stable identifiers: `po_number`, and linking fields (`deal_number` or `deal_id` reference)
