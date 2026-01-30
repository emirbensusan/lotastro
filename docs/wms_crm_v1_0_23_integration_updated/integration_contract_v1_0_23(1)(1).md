# CRM ↔ WMS Integration Contract — v1.0.23 (LOCKED)

**Status:** LOCKED (canonical)  
**Date:** 2026-01-29  
**Supersedes:** v1.0.22 (LOCKED)

## How to read this document

This v1.0.23 contract is **v1.0.22 + a strictly-scoped, additive change set**.

- **All clauses, schemas, rules, and event definitions in v1.0.21 and v1.0.22 remain LOCKED and unchanged**, except where this document explicitly overrides them.
- If there is any conflict between v1.0.21 / v1.0.22 and this v1.0.23 change set, **v1.0.23 wins**.
- All idempotency keys **MUST** follow v1.0.21 Section 6:  
  `source_system:entity:entity_id:action:v#` (**exactly 5 segments; no timestamps; entity_id is a single segment with no extra colons**).

---

## Change Log (v1.0.22 → v1.0.23)

### Added / Clarified (Canonical schemas and events)
1) **stock.changed** — canonical payload schema + canonical idempotency key (previously listed but not defined in any doc)  
2) **central_stock_check.completed** — WMS → CRM event + payload schema  
3) **post_po_issue.created / updated / resolved** — WMS → CRM events + payload schemas  
4) **costing.invoice_posted / receipt_linked / adjustment_posted / wac_updated** — WMS → CRM events + payload schemas  
5) **invoice_control.passed / failed** — WMS → CRM events + payload schemas  
6) **org_access.updated** — CRM → WMS event + payload schema (snapshot grants with monotonic sequence)

> Note: v1.0.23 does **not** remove or deprecate any existing v1.0.21/v1.0.22 events.  
> All items above are **additive** or **schema clarifications**.

---

## Override: Section 3.2 — WMS → CRM Events (Canonical List)

**WMS → CRM Events** (Contract Section 3.2)

| # | Event | Notes |
|---:|---|---|
| 1 | inquiry.created | unchanged |
| 2 | inquiry.converted | unchanged |
| 3 | reservation.created | unchanged |
| 4 | reservation.released | unchanged |
| 5 | reservation.converted | unchanged |
| 6 | reservation.allocation_planned | unchanged |
| 7 | reservation.allocated | unchanged |
| 8 | order.created | unchanged |
| 9 | order.picking_started | unchanged |
| 10 | order.prepared | unchanged |
| 11 | shipment.posted | unchanged |
| 12 | shipment.delivered | unchanged |
| 13 | order.invoiced | unchanged |
| 14 | order.fulfilled | unchanged |
| 15 | order.cancelled | unchanged |
| 16 | stock.changed | **SCHEMA CLARIFIED (v1.0.23)** |
| 17 | inventory.low_stock | unchanged |
| 18 | supply_request.status_updated | unchanged |
| 19 | order.status_changed | unchanged (v1.0.22) |
| 20 | shortage.detected | unchanged (v1.0.22) |
| 21 | central_stock_check.completed | **NEW (v1.0.23)** |
| 22 | post_po_issue.created | **NEW (v1.0.23)** |
| 23 | post_po_issue.updated | **NEW (v1.0.23)** |
| 24 | post_po_issue.resolved | **NEW (v1.0.23)** |
| 25 | costing.invoice_posted | **NEW (v1.0.23)** |
| 26 | costing.receipt_linked | **NEW (v1.0.23)** |
| 27 | costing.adjustment_posted | **NEW (v1.0.23)** |
| 28 | costing.wac_updated | **NEW (v1.0.23)** |
| 29 | invoice_control.passed | **NEW (v1.0.23)** |
| 30 | invoice_control.failed | **NEW (v1.0.23)** |

---

## Override: Section 3.1 — CRM → WMS Events (Canonical List)

**CRM → WMS Events** (Contract Section 3.1)

| # | Event | Notes |
|---:|---|---|
| 1 | customer.created | unchanged |
| 2 | customer.updated | unchanged |
| 3 | deal.approved | unchanged |
| 4 | deal.accepted | unchanged |
| 5 | deal.won | unchanged |
| 6 | deal.cancelled | unchanged |
| 7 | deal.lines_updated | unchanged |
| 8 | supply_request.created | unchanged |
| 9 | shipment.approved | unchanged |
| 10 | payment.confirmed | unchanged |
| 11 | org_access.updated | **NEW (v1.0.23)** |

---

# Canonical Schema Clarifications / New Event Definitions (v1.0.23)

## Canonical Payload Definition: stock.changed (v1.0.23)

### Purpose
A canonical inventory snapshot event so CRM can maintain an **aggregate cache** by org + quality + color (+ optional warehouse), without depending on internal WMS stock movement details.

### Emission rule (WMS)
WMS MUST emit `stock.changed` when inventory for any `(quality_code, color_code, warehouse_id)` changes, including:
- receipts, fulfillments, adjustments, transfers, counts

WMS MAY batch multiple item changes into one event using a stable `transaction_batch_id`.

### Payload (JSON)
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

### Required invariants
- `items[]` MUST include **snapshot** values: `on_hand_meters`, `reserved_meters`, `available_meters`.
- `delta_meters` is OPTIONAL; if present, CRM MUST treat it as informational and still trust snapshot fields.
- `uom` MUST be `MT` or `KG` only (uppercase).
- `transaction_batch_id` MUST be stable per emission batch (do not derive from time).

### Idempotency key (LOCKED format)
- **Entity:** `stock`
- **Entity ID:** `{transaction_batch_id}`
- **Action:** `changed`

Example:
`wms:stock:9c1f...:changed:v1`

---

## New Event Definition: central_stock_check.completed (v1.0.23)

### Purpose
Reports the result of a central stock (Abra) check for a deal line so CRM can route next steps (import/manufacture/confirmation).

### Emission rule (WMS)
WMS MUST emit when a central stock check is completed and the result is finalized for one or more lines.

### Payload (JSON)
```json
{
  "event": "central_stock_check.completed",
  "idempotency_key": "wms:central_stock_check:{check_id}:completed:v1",

  "check_id": "uuid",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "lines": [
    {
      "crm_deal_line_id": "uuid",
      "quality_code": "string",
      "color_code": "string|null",

      "result": "found_in_abra|not_in_abra|uncertain",
      "available_qty": 100.00,

      "proposed_next_step": "import_from_central|manufacture|needs_central_confirmation",
      "eta_text": "string|null"
    }
  ],

  "checked_at": "timestamptz",
  "checked_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `central_stock_check`
- **Entity ID:** `{check_id}`
- **Action:** `completed`

Example:
`wms:central_stock_check:12ab...:completed:v1`

---

## New Event Definition: post_po_issue.created (v1.0.23)

### Purpose
Signals a discrepancy/issue detected **after PO/order creation**, so CRM can coordinate resolution, approvals, and customer communication.  
This event name family is canonical: `post_po_issue.*` (do not use `po_discrepancy.*`).

### Emission rule (WMS)
WMS MUST emit when a post-PO discrepancy is first raised.

### Payload (JSON)
```json
{
  "event": "post_po_issue.created",
  "idempotency_key": "wms:post_po_issue:{issue_id}:created:v1",

  "issue_id": "uuid",
  "wms_order_id": "uuid",
  "po_number": "string",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "issue_type": "shortage|wrong_lot|damaged_roll|quality_mismatch|color_mismatch|lot_swap|other",
  "description": "string",

  "affected_lines": [
    {
      "crm_deal_line_id": "uuid",
      "wms_order_line_id": "uuid|null",
      "issue_type": "shortage|wrong_lot|damaged_roll|quality_mismatch|color_mismatch|lot_swap|other",
      "reason_note": "string|null",

      "original_meters": 100.00,
      "affected_meters": 25.00,

      "lot_swap_flagged": false,
      "original_lot_id": "string|null",
      "proposed_lot_id": "string|null"
    }
  ],

  "requires_customer_approval": true,
  "detected_at": "timestamptz",
  "created_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `post_po_issue`
- **Entity ID:** `{issue_id}`
- **Action:** `created`

Example:
`wms:post_po_issue:44de...:created:v1`

---

## New Event Definition: post_po_issue.updated (v1.0.23)

### Purpose
Updates the state of an existing post-PO issue (proposed, manager_review, etc.) and any notes.

### Emission rule (WMS)
WMS MUST emit whenever the issue status or resolution proposal materially changes.

### Payload (JSON)
```json
{
  "event": "post_po_issue.updated",
  "idempotency_key": "wms:post_po_issue:{issue_id}:updated:v1",

  "issue_id": "uuid",
  "wms_order_id": "uuid",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "status": "open|proposed|manager_review|resolved|rejected|override",
  "update_note": "string|null",

  "updated_at": "timestamptz",
  "updated_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `post_po_issue`
- **Entity ID:** `{issue_id}`
- **Action:** `updated`

Example:
`wms:post_po_issue:44de...:updated:v1`

---

## New Event Definition: post_po_issue.resolved (v1.0.23)

### Purpose
Final resolution details for a post-PO issue.

### Emission rule (WMS)
WMS MUST emit when the issue reaches a terminal resolved state.

### Payload (JSON)
```json
{
  "event": "post_po_issue.resolved",
  "idempotency_key": "wms:post_po_issue:{issue_id}:resolved:v1",

  "issue_id": "uuid",
  "wms_order_id": "uuid",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "resolution": "qty_reduced|lot_swapped|cancelled|other",
  "resolution_note": "string|null",

  "customer_approval_required": false,
  "customer_approved_at": "timestamptz|null",

  "resolved_at": "timestamptz",
  "resolved_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `post_po_issue`
- **Entity ID:** `{issue_id}`
- **Action:** `resolved`

Example:
`wms:post_po_issue:44de...:resolved:v1`

---

## New Event Definition: costing.invoice_posted (v1.0.23)

### Purpose
Mirrors supplier invoice and FX selection into CRM for reporting, auditability, and profitability analysis.

### Emission rule (WMS)
WMS MUST emit when a supplier invoice is posted/finalized (not draft).

### Payload (JSON)
```json
{
  "event": "costing.invoice_posted",
  "idempotency_key": "wms:costing_invoice:{invoice_id}:posted:v1",

  "invoice_id": "uuid",
  "crm_organization_id": "uuid",

  "invoice_number": "string",
  "supplier_name": "string|null",
  "invoice_date": "date",

  "original_currency": "TRY|USD|EUR|GBP",
  "original_amount": 50000.00,

  "selected_fx_rate": 32.500000,
  "fx_rate_source": "manual|tcmb|api",
  "try_amount": 1625000.00,

  "inventory_owner_org_id": "uuid|null",

  "posted_at": "timestamptz",
  "posted_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `costing_invoice`
- **Entity ID:** `{invoice_id}`
- **Action:** `posted`

Example:
`wms:costing_invoice:aa19...:posted:v1`

---

## New Event Definition: costing.receipt_linked (v1.0.23)

### Purpose
Links a posted supplier invoice (or cost basis) to specific received lots/rolls for unit-cost auditability.

### Emission rule (WMS)
WMS MUST emit when a receipt/cost basis is linked to one or more lots/rolls.

### Payload (JSON)
```json
{
  "event": "costing.receipt_linked",
  "idempotency_key": "wms:costing_receipt:{receipt_id}:linked:v1",

  "receipt_id": "uuid",
  "invoice_id": "uuid|null",
  "crm_organization_id": "uuid",

  "links": [
    {
      "lot_id": "uuid|null",
      "roll_id": "uuid|null",
      "quality_code": "string",
      "color_code": "string|null",
      "uom": "MT|KG",
      "unit_cost_try": 97.5000
    }
  ],

  "linked_at": "timestamptz",
  "linked_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `costing_receipt`
- **Entity ID:** `{receipt_id}`
- **Action:** `linked`

Example:
`wms:costing_receipt:bb21...:linked:v1`

---

## New Event Definition: costing.adjustment_posted (v1.0.23)

### Purpose
Mirrors landed cost or post-receipt adjustments (freight/duty/etc.) for audit and reporting.

### Emission rule (WMS)
WMS MUST emit when an adjustment is posted and affects one or more inventory items.

### Payload (JSON)
```json
{
  "event": "costing.adjustment_posted",
  "idempotency_key": "wms:costing_adjustment:{adjustment_id}:posted:v1",

  "adjustment_id": "uuid",
  "crm_organization_id": "uuid",

  "component_type": "freight|customs_duty|insurance|handling|other",
  "amount_original": 1000.00,
  "currency": "TRY|USD|EUR|GBP",
  "fx_rate_used": 32.500000,
  "amount_try": 32500.00,

  "applies_to": [
    { "lot_id": "uuid|null", "roll_id": "uuid|null" }
  ],

  "posted_at": "timestamptz",
  "posted_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `costing_adjustment`
- **Entity ID:** `{adjustment_id}`
- **Action:** `posted`

Example:
`wms:costing_adjustment:cc31...:posted:v1`

---

## New Event Definition: costing.wac_updated (v1.0.23)

### Purpose
Mirrors Weighted Average Cost (WAC) changes to CRM for margin calculations.

### Emission rule (WMS)
WMS MUST emit when WAC is recalculated for a `(quality_code, color_code, warehouse_id)` scope.

### Payload (JSON)
```json
{
  "event": "costing.wac_updated",
  "idempotency_key": "wms:wac:{quality_code}-{wac_update_id}:updated:v1",

  "wac_update_id": "uuid",
  "crm_organization_id": "uuid|null",

  "quality_code": "string",
  "color_code": "string|null",
  "warehouse_id": "uuid|null",

  "previous_wac_try": 95.0000,
  "new_wac_try": 97.5000,

  "total_meters": 5000.00,
  "total_cost_try": 487500.00,

  "trigger": "invoice_posted|adjustment|receipt",
  "calculated_at": "timestamptz"
}
```

### Required invariants
- Idempotency entity_id MUST be a **single segment**; use `{quality_code}-{wac_update_id}` (dash) not `{quality_code}:{wac_update_id}` (colon).

### Idempotency key (LOCKED format)
- **Entity:** `wac`
- **Entity ID:** `{quality_code}-{wac_update_id}`
- **Action:** `updated`

Example:
`wms:wac:QUALITY001-7f2a...:updated:v1`

---

## New Event Definition: invoice_control.passed (v1.0.23)

### Purpose
Communicates the invoice control outcome so CRM can gate “fulfilled/closed” workflows.

### Emission rule (WMS)
WMS MUST emit when invoice control is completed with a PASS outcome for an order.

### Payload (JSON)
```json
{
  "event": "invoice_control.passed",
  "idempotency_key": "wms:invoice_control:{wms_order_id}:passed:v1",

  "wms_order_id": "uuid",
  "po_number": "string",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "invoice_control_status": "passed",
  "passed_at": "timestamptz",
  "passed_by": "uuid|null",
  "note": "string|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `invoice_control`
- **Entity ID:** `{wms_order_id}`
- **Action:** `passed`

Example:
`wms:invoice_control:2f6b...:passed:v1`

---

## New Event Definition: invoice_control.failed (v1.0.23)

### Purpose
Communicates invoice control failure and reason.

### Emission rule (WMS)
WMS MUST emit when invoice control is completed with a FAIL outcome for an order.

### Payload (JSON)
```json
{
  "event": "invoice_control.failed",
  "idempotency_key": "wms:invoice_control:{wms_order_id}:failed:v1",

  "wms_order_id": "uuid",
  "po_number": "string",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "invoice_control_status": "failed",
  "failed_at": "timestamptz",
  "failed_by": "uuid|null",
  "failure_reason": "string"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `invoice_control`
- **Entity ID:** `{wms_order_id}`
- **Action:** `failed`

Example:
`wms:invoice_control:2f6b...:failed:v1`

---

## New Event Definition: org_access.updated (CRM → WMS) (v1.0.23)

### Purpose
Synchronizes user-to-organization access grants from CRM to WMS so WMS can enforce multi-org RLS.

### Emission rule (CRM)
CRM MUST emit `org_access.updated` whenever user org grants change:
- user added/removed from an org
- user role changes within an org

**Payload is a snapshot**: `grants[]` is the full current set of active grants for that user.

### Payload (JSON)
```json
{
  "event": "org_access.updated",
  "idempotency_key": "crm:org_access:{user_id}-{org_access_seq}:updated:v1",

  "user_id": "uuid",
  "org_access_seq": 42,

  "grants": [
    {
      "crm_organization_id": "uuid",
      "role_in_org": "sales_owner|sales_manager|pricing|accounting|admin",
      "is_active": true
    }
  ],

  "updated_at": "timestamptz",
  "updated_by": "uuid|null"
}
```

### Required invariants
- `org_access_seq` MUST be monotonic per user (increment on every change).
- Idempotency key MUST remain 5 segments; embed the sequence into entity_id as `{user_id}-{org_access_seq}` (dash), not an extra `:{seq}` segment.

### Idempotency key (LOCKED format)
- **Entity:** `org_access`
- **Entity ID:** `{user_id}-{org_access_seq}`
- **Action:** `updated`

Example:
`crm:org_access:1a2b...-42:updated:v1`

---

## Implementation Notes (Non-normative)

- Do not use any time-derived strings (date, hour, timestamp) in idempotency keys.
- WMS SHOULD treat `crm_organization_id` as nullable for cross-org aggregates; CRM SHOULD still store it if present.
- CRM SHOULD implement a durable outbox for CRM → WMS emissions (recommended) to avoid missing org access updates.

---

## Adoption Checklist

1) Add this file to both repos as:
   - `docs/integration_contract_v1_0_23.md`
2) Replace your canonical contract reference file with v1.0.23 content:
   - Set `docs/integration_contract_v1.md` = v1.0.23 (this file’s content)
3) Archive the previous canonical contract content:
   - `docs/integration_contract_v1_0_22.md` (historical)
4) Update event dispatcher/receiver mappings:
   - WMS emits events #21–#30 (in addition to v1.0.21/v1.0.22 events)
   - CRM ingests events #16 and #21–#30 using the schemas above
   - CRM emits event #11 (org_access.updated) to WMS
5) Update any idempotency key generator helpers to obey “exactly 5 segments”:
   - Use dashes inside `entity_id` when you need a sequence (e.g., `{user_id}-{seq}`)


APPENDIX A — Nullable crm_organization_id Handling (Uniqueness + UPSERT Safety)
A.1 Why this appendix exists

Some WMS→CRM events (e.g., stock.changed, costing.wac_updated, and possibly inventory.low_stock) allow:

crm_organization_id: uuid | null

When crm_organization_id is null, any downstream CRM “mirror/cache” tables that:

include nullable org_id in a UNIQUE constraint, and

rely on UPSERT (ON CONFLICT) for updates

will silently allow duplicates, because in Postgres NULL values do not conflict under UNIQUE constraints.

A.2 Contract requirement (mandatory)

For any CRM table that stores “mirrors/caches” keyed by (org_id, …) and supports nullable org_id, implement one of the following two canonical strategies (A or B). Both are contract-compliant; choose ONE and apply consistently.

A.3 Strategy A (recommended): org_scope_key normalization for deterministic uniqueness

Rule: For uniqueness and UPSERT conflict targets, treat org_id = null as a stable sentinel value.

Canonical sentinel value:

00000000-0000-0000-0000-000000000000 (UUID)

Derived key definition:

org_scope_key := COALESCE(org_id, '00000000-0000-0000-0000-000000000000')

Requirements:

Add an org_scope_key column (or generated expression) to each affected table.

Define UNIQUE constraints / conflict targets using org_scope_key instead of nullable org_id.

When upserting, use org_scope_key as the conflict key.

Tables impacted (minimum):

stock_by_quality_cache

costing_mirrors

any future mirror/cache tables where org_id is nullable and used for uniqueness

Example: stock_by_quality_cache uniqueness (normative example)

Uniqueness key must be:

(org_scope_key, quality_code, color_code, warehouse_id)

Operational behavior:

If crm_organization_id is null, events update the “global/unknown org scope” row for that (quality, color, warehouse).

If later an event arrives with a real crm_organization_id, it updates the org-scoped row independently.

Note: This does not “guess” org. It simply prevents duplicate rows and preserves determinism.

A.4 Strategy B (allowed): Dual uniqueness via partial unique indexes

Rule: Split uniqueness into two cases:

org_id IS NOT NULL → unique includes org_id

org_id IS NULL → unique excludes org_id (global scope uniqueness)

Requirements:

Create one UNIQUE constraint/index for org_id IS NOT NULL using (org_id, ...)

Create one UNIQUE constraint/index for org_id IS NULL using (... without org_id ...)

UPSERT logic must branch:

if org_id != null: conflict target is (org_id, ...)

if org_id == null: conflict target is (... without org_id ...)

Operational behavior:

Guarantees no duplicates in the null-org case

More complex than Strategy A; only use if your stack cannot support Strategy A cleanly

A.5 Inbox idempotency note

crm_event_inbox idempotency is defined on idempotency_key alone (global unique), and organization_id may be null. This is correct per v1.0.23 and does not conflict with Strategy A/B.

APPENDIX B — inventory.low_stock Event (Explicit v1.0.23 Definition)
B.1 Status in v1.0.23

inventory.low_stock remains valid in v1.0.23 and is considered inherited from prior versions; however, to keep the canonical file self-contained, v1.0.23 defines it explicitly here.

B.2 Direction

WMS → CRM

B.3 Idempotency key (LOCKED v1.0.23)

Format (5 segments):

wms:inventory:{quality_code}:low_stock:v1

Notes:

quality_code must be a single segment. Do not include colons.

If a composite is required in the future, it must use dashes (e.g., {quality_code}-{warehouse_id}) and must still remain a single segment.

B.4 Payload schema (LOCKED v1.0.23)
{
  "event": "inventory.low_stock",
  "idempotency_key": "wms:inventory:{quality_code}:low_stock:v1",
  "crm_organization_id": "uuid|null",
  "quality_code": "string",
  "color_code": "string|null",
  "warehouse_id": "uuid|null",
  "uom": "MT|KG",
  "on_hand_meters": 50.00,
  "available_meters": 25.00,
  "threshold_meters": 100.00,
  "reason": "below_threshold|forecast_risk|reservation_pressure|manual_flag",
  "detected_at": "timestamptz",
  "detected_by": "uuid|null"
}

B.5 Semantics (normative)

Event indicates that inventory for quality_code (and optionally color_code, warehouse_id) has crossed or is at risk of crossing a minimum threshold.

on_hand_meters and available_meters must be snapshots at detected_at (not deltas).

If crm_organization_id is null, CRM must still ingest and store the alert deterministically; see Appendix A for uniqueness strategy.

B.6 CRM handling requirements (normative)

CRM must accept the event, verify signature, and log to inbox with idempotency.

CRM should create/update a low-stock alert record or update an existing one keyed by:

(org scope, quality_code, color_code, warehouse_id) using Appendix A Strategy A or B.

This event must never block fulfillment by itself; it is informational/alerting unless explicitly implemented as gating elsewhere.

APPENDIX C — NULL-SAFE UNIQUENESS & RETRY SEMANTICS (FINAL, OVERRIDES WHERE APPLICABLE)
C.1 Purpose

This appendix removes the last “silent duplicate” risks caused by PostgreSQL UNIQUE behavior with NULL, and clarifies retry handling for the inbox pattern. It is implementation-mandatory and does not change event payloads.

C.2 Rule: No NULLs inside any UNIQUE/UPSERT key

PostgreSQL UNIQUE constraints allow multiple rows where any participating column is NULL. Therefore:

Any table that uses UPSERT / UNIQUE for cache or mirror state must normalize every nullable dimension used in the conflict target, not only crm_organization_id.

This applies to (at minimum):

stock_by_quality_cache

low_stock_alerts

costing_mirrors

any future mirror/cache table with nullable fields in its unique identity

C.3 Canonical normalization (“scope keys”) for nullable dimensions

Use the following canonical “scope key” approach:

UUID nullable dimensions (e.g., crm_organization_id, warehouse_id):

Sentinel UUID: 00000000-0000-0000-0000-000000000000

TEXT nullable dimensions (e.g., color_code):

Sentinel text: __NULL__

Generated keys (recommended):

org_scope_key := COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid)

warehouse_scope_key := COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)

color_scope_key := COALESCE(color_code, '__NULL__')

C.4 Required UNIQUE/UPSERT identity keys (authoritative)

Stock cache

Table: stock_by_quality_cache

Required logical identity:

(org_scope_key, quality_code, color_scope_key, warehouse_scope_key)

UPSERT must use this same identity.

Low stock alerts

Table: low_stock_alerts

Required logical identity:

(org_scope_key, quality_code, color_scope_key, warehouse_scope_key, uom)

UPSERT must use this same identity.

Costing mirrors

Table: costing_mirrors

Required logical identity:

(org_scope_key, wms_invoice_id)

If crm_organization_id is null, the row must still upsert deterministically via org_scope_key.

If an implementation chooses not to use generated columns, it must still enforce the same normalized identity in its UNIQUE constraint and UPSERT conflict target.

C.5 Inbox idempotency & retry semantics (authoritative)

Table: crm_event_inbox

Idempotency key is global

UNIQUE(idempotency_key) is the sole dedupe rule (not composite with org).

On duplicate idempotency_key, behavior depends on status

If existing row status is processed → return 200, do not create a new row.

If existing row status is pending or processing → return 200, do not create a new row.

If existing row status is failed → retry is allowed by updating the existing row, not inserting a second row.

Retry update requirements (minimum)
When a duplicate arrives and existing status is failed, the receiver must:

set status back to pending

increment attempt_count

update received_at (and optionally store latest payload_json + payload_hash)

clear last_error, update next_retry_at as appropriate

Implementations MUST NOT use ON CONFLICT DO NOTHING without the above “failed→pending update” retry behavior.

C.6 Compatibility

This appendix is compatible with Appendix A and Appendix B and is intended as the final clarification. Where Appendix A is interpreted as only applying to org_id, Appendix C extends it to all nullable unique dimensions.

APPENDIX D — Inbox Security, Deterministic Retry Semantics, and “Ingestion vs Handling” Clarification (v1.0.23)
D.1 Purpose (Normative)

This appendix is normative and resolves two operational gaps that can cause:

data exposure via NULL-org events, and

incorrect idempotency handling when retrying failed events.

This appendix does not change any event payload schemas or idempotency formats defined elsewhere in v1.0.23.

D.2 Security Model for crm_event_inbox (RLS MUST NOT Leak NULL-org Events)
D.2.1 Principle

crm_event_inbox is an integration transport log, not an end-user feature table. Therefore:

Writes: service role only (Edge Function receiver).

Reads: admin only (or service role only).

Critical: MUST NOT grant any policy that allows broad authenticated reads of rows where organization_id IS NULL. That pattern leaks cross-org data.

D.2.2 Minimum Required RLS (Recommended)

Enable RLS and apply the following baseline:

ALTER TABLE crm_event_inbox ENABLE ROW LEVEL SECURITY;

-- No direct end-user INSERT/UPDATE/DELETE
REVOKE ALL ON TABLE crm_event_inbox FROM authenticated;

-- Admin-only visibility (optional; may be removed to keep service-only)
CREATE POLICY inbox_select_admin_only
ON crm_event_inbox
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


If you prefer service-only access, omit the SELECT policy above and keep inbox access exclusively in service role context.

D.2.3 Optional: Admin “Integration Health View”

If the product needs UI visibility, expose only aggregated status via a separate view (counts by status, last_received_at, last_error) without exposing raw payload_json.

D.3 Deterministic Retry Semantics for crm_event_inbox (Idempotency MUST Support Failed Retries)
D.3.1 Idempotency Anchor (Unchanged)

Idempotency for inbound events remains:

UNIQUE(idempotency_key) on crm_event_inbox

dedupe decision is made on idempotency_key alone

D.3.2 Receiver MUST Implement “Failed → Pending (Update, Not Insert)”

When the webhook receiver inserts into crm_event_inbox, it MUST behave as follows:

On first receipt (no existing row):

INSERT new row with status = pending, attempt_count = 0.

On duplicate idempotency_key:

If existing status is processed or processing → return 200, do not create a new row.

If existing status is pending → return 200 (duplicate delivery), do not create a new row.

If existing status is failed → MUST convert the same row back to pending via UPDATE.

Recommended SQL pattern (one acceptable implementation):

INSERT INTO crm_event_inbox (
  organization_id, idempotency_key, event_name, source,
  payload_json, payload_hash, status, received_at
)
VALUES (
  $1, $2, $3, $4,
  $5, $6, 'pending', now()
)
ON CONFLICT (idempotency_key) DO UPDATE
SET
  -- Retry ONLY if previously failed
  status = CASE
    WHEN crm_event_inbox.status = 'failed' THEN 'pending'
    ELSE crm_event_inbox.status
  END,
  attempt_count = CASE
    WHEN crm_event_inbox.status = 'failed' THEN crm_event_inbox.attempt_count
    ELSE crm_event_inbox.attempt_count
  END,
  last_error = CASE
    WHEN crm_event_inbox.status = 'failed' THEN NULL
    ELSE crm_event_inbox.last_error
  END,
  next_retry_at = CASE
    WHEN crm_event_inbox.status = 'failed' THEN NULL
    ELSE crm_event_inbox.next_retry_at
  END,
  last_attempt_at = CASE
    WHEN crm_event_inbox.status = 'failed' THEN NULL
    ELSE crm_event_inbox.last_attempt_at
  END,
  received_at = now()
WHERE crm_event_inbox.status = 'failed';


Notes:

The WHERE crm_event_inbox.status = 'failed' ensures we only UPDATE on failed-retry.

Receiver returns 200 for duplicate deliveries regardless, but only failed rows are re-queued.

D.4 Payload Hash Drift Rule (Non-Blocking but Must be Logged)

If the same idempotency_key is received with a different payload_hash:

Receiver MUST log a warning (audit log / integration health log).

Receiver MUST NOT create a second inbox row.

If the existing row is failed, the system may re-queue it as pending (per D.3.2) and process the latest payload (implementation choice), but MUST preserve an audit trail that drift occurred.

(Goal: avoid silent overwrites while keeping the integration resilient.)

D.5 Phase Terminology Clarification: “Ingestion vs Business Handling”

Whenever implementation documents say “No events — infrastructure only”, the intended meaning is:

Ingestion is enabled (receiver accepts events, validates HMAC, logs to crm_event_inbox with idempotency).

Business handling is disabled until the relevant batch (no mirror/cache updates, no deal state changes) except inbox logging and transport-level retries.

Recommended wording for plans:

“No business handlers — ingestion/logging only.”

D.6 Acceptance Tests (Minimum)

Valid HMAC → 200, row inserted pending.

Invalid HMAC → 401, no row inserted.

Duplicate key, existing processed → 200, no new row, no status change.

Duplicate key, existing failed → 200, same row updated to pending (no new row).

Admin read policy: non-admin authenticated user cannot read any inbox rows (including organization_id IS NULL).

This Appendix is part of v1.0.23 canonical contract.

No changes to event names, idempotency formats, or payload schemas are allowed without bumping contract version.

