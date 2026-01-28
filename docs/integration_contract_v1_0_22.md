# CRM ↔ WMS Integration Contract — v1.0.22 (LOCKED)

**Status:** LOCKED (canonical)  
**Date:** 2026-01-28  
**Supersedes:** v1.0.21 (LOCKED)

## How to read this document

This v1.0.22 contract is **v1.0.21 + a strictly-scoped change set**.

- **All clauses, schemas, rules, and event definitions in v1.0.21 remain LOCKED and unchanged**, except where this document explicitly overrides them.
- If there is any conflict between v1.0.21 and this v1.0.22 change set, **v1.0.22 wins**.
- All idempotency keys **MUST** continue to follow v1.0.21 Section 6:  
  `source_system:entity:entity_id:action:v#` (**exactly 5 segments; no timestamps**).

---

## Change Log (v1.0.21 → v1.0.22)

### Added (WMS → CRM Events)
1) **order.status_changed** — a composite “lifecycle snapshot” event (required by Checklist and Appendix).  
2) **shortage.detected** — a formal shortage notification event (required by Checklist).

> Note: v1.0.22 does **not** remove or deprecate any existing v1.0.21 granular events.  
> **WMS MUST continue emitting the v1.0.21 events as-is**; these two events are **additive**.

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
| 16 | stock.changed | unchanged |
| 17 | inventory.low_stock | unchanged |
| 18 | supply_request.status_updated | unchanged |
| 19 | order.status_changed | **NEW (v1.0.22)** |
| 20 | shortage.detected | **NEW (v1.0.22)** |

---

## New Event Definition: order.status_changed (v1.0.22)

### Purpose
A **single composite event** that gives CRM the current order status and a full lifecycle timestamp snapshot, without requiring CRM to reconstruct it from multiple granular events.

### Emission rule (WMS)
WMS MUST emit `order.status_changed` whenever any of the following happens:
- order transitions into a lifecycle milestone (picking_started, prepared, shipped, delivered, invoiced, fulfilled, cancelled)
- carrier fields change after shipping (if applicable)

This event is **additive**; WMS continues to emit the underlying granular events (v1.0.21).

### Payload (JSON)
```json
{
  "wms_order_id": "uuid",
  "po_number": "string",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "status": "picking|prepared|shipped|delivered|invoiced|fulfilled|cancelled",
  "previous_status": "string|null",

  "lifecycle": {
    "picking_started_at": "timestamptz|null",
    "prepared_at": "timestamptz|null",
    "shipped_at": "timestamptz|null",
    "delivered_at": "timestamptz|null",
    "invoiced_at": "timestamptz|null",
    "fulfilled_at": "timestamptz|null",
    "cancelled_at": "timestamptz|null"
  },

  "carrier": {
    "carrier_type": "internal|external|null",
    "carrier_name": "string|null",
    "tracking_id": "string|null"
  },

  "changed_at": "timestamptz",
  "changed_by": "uuid|null",

  "status_seq": 1
}
```

### Required invariants
- `status_seq` is a **monotonic per-order** integer incremented each time WMS emits `order.status_changed`.
- `cancelled` spelling is canonical (see v1.0.21 Section 17.2).
- If `status` is `shipped` or later, `carrier.carrier_type` MUST be present; if `external`, `carrier_name` and `tracking_id` MUST be present (align with Appendix D).

### Idempotency key (LOCKED format)
- **Entity:** `order_status`
- **Entity ID:** `{wms_order_id}-{status_seq}` (single segment; no extra colons)
- **Action:** `changed`

Example:
`wms:order_status:2f6b...-7:changed:v1`

---

## New Event Definition: shortage.detected (v1.0.22)

### Purpose
A **formal** shortage signal so CRM can route work to shortage resolution (pricing/import/manufacture) without inferring from allocation_planned details.

### Emission rule (WMS)
WMS MUST emit `shortage.detected` when:
- allocation planning or availability check determines **insufficient on-hand** for one or more deal lines in an active reservation, and
- the reservation requires a shortage decision (`action_required=true` with shortage semantics).

This event is **compatible** with the v1.0.21 shortage encoding inside `reservation.allocation_planned`; it does not replace it.

### Payload (JSON)
```json
{
  "shortage_detection_id": "uuid",
  "wms_reservation_id": "uuid",
  "crm_deal_id": "uuid",
  "crm_organization_id": "uuid",

  "shortage_lines": [
    {
      "crm_deal_line_id": "uuid",
      "quality_code": "string",
      "color_code": "string|null",
      "requested_meters": 123.45,
      "available_meters": 10.00,
      "shortage_meters": 113.45,
      "uom": "MT|KG"
    }
  ],

  "suggested_actions": ["manufacture", "import_from_central", "partial_ship", "cancel_line"],

  "detected_at": "timestamptz",
  "detected_by": "uuid|null"
}
```

### Idempotency key (LOCKED format)
- **Entity:** `shortage_detection`
- **Entity ID:** `{shortage_detection_id}`
- **Action:** `detected`

Example:
`wms:shortage_detection:8b3a...:detected:v1`

---

## Implementation Notes (Non-normative)

- If WMS already has an Outbox/Event table with a stable UUID per emitted event, you may set:
  - `shortage_detection_id = outbox_event_id`  
  - `status_seq` stored on `orders` as `order_status_seq` and incremented at emission time
- Do not use **any** time-derived strings (date, hour, timestamp) in idempotency keys.

---

## Adoption Checklist

1) Add this file to both repos as:
   - `docs/integration_contract_v1_0_22.md`
2) Update any “source-of-truth” references from v1.0.21 → v1.0.22.
3) Update event dispatcher/receiver mappings:
   - WMS emits events #19 and #20 in addition to v1.0.21 events
   - CRM ingests events #19 and #20 and wires to UI/notifications/work queues as per Checklist
