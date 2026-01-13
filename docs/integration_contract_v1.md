# Integration Contract v1.0.3

> **Status:** CANONICAL (Locked)
> **Applies To:** CRM Phase 6, WMS Batch F
> **Last Updated:** 2026-01-13
> **Contract Identifier:** integration_contract_v1

**This file must be byte-identical in both CRM and WMS repositories.**

---

## Table of Contents

1. [Canonical Entities](#1-canonical-entities)
2. [Canonical Event Names](#2-canonical-event-names)
3. [Canonical Status Dictionaries](#3-canonical-status-dictionaries)
4. [Event to Status Transition Table](#4-event-to-status-transition-table)
5. [Idempotency Key Standard](#5-idempotency-key-standard)
6. [Partial Flows and Backorder Modeling](#6-partial-flows-and-backorder-modeling)
7. [Cancellation Rules](#7-cancellation-rules)
8. [Picking Behavior Requirements](#8-picking-behavior-requirements)
9. [Pricing and Cost Ownership](#9-pricing-and-cost-ownership)
10. [Required Schema Changes](#10-required-schema-changes)
11. [API and Webhook Contracts](#11-api-and-webhook-contracts)
12. [Secrets Required](#12-secrets-required)
13. [Implementation Note for WMS](#13-implementation-note-for-wms)
14. [Contract Lock Checklist](#14-contract-lock-checklist)
15. [Version History](#15-version-history)
16. [Lock Statement](#16-lock-statement)

---

## 1. Canonical Entities

| Entity | Owner | CRM Column | WMS Column | Notes |
|--------|-------|------------|------------|-------|
| Customer | CRM | `id` | `crm_customer_id` | CRM is source of truth |
| Deal | CRM | `id` | `crm_deal_id` | CRM is source of truth |
| Organization | CRM | `organization_id` | `crm_organization_id` | Multi-tenant isolation |
| Reservation | WMS | `wms_reservation_id` | `id` | WMS is source of truth |
| Order | WMS | `wms_order_id` | `id` | WMS is source of truth |
| Shipment | WMS | `wms_shipment_id` | `id` | WMS is source of truth |
| Inquiry | WMS | — | `id` | WMS-only, optional CRM ref |
| Inventory | WMS | — | `id` | CRM sees masked availability only |

---

## 2. Canonical Event Names

### 2.1 CRM to WMS Events (7 events)

| Event | Description |
|-------|-------------|
| `customer.created` | New customer created in CRM |
| `customer.updated` | Customer details updated in CRM |
| `deal.approved` | Management approved deal (before customer offer) |
| `deal.accepted` | Customer accepted the offer |
| `deal.won` | Deal finalized, ready for WMS fulfillment |
| `deal.cancelled` | Deal cancelled by CRM |
| `deal.lines_updated` | Deal line items modified |

### 2.2 WMS to CRM Events (15 events)

| Event | Description |
|-------|-------------|
| `inquiry.created` | New inquiry created in WMS |
| `inquiry.converted` | Inquiry converted to reservation |
| `reservation.created` | Stock reserved for deal |
| `reservation.released` | Reservation released (see release_reason) |
| `reservation.converted` | Reservation converted to order |
| `order.created` | Order created from reservation |
| `order.picking_started` | Warehouse began picking |
| `order.prepared` | Warehouse finished picking and packing |
| `shipment.posted` | Shipment dispatched |
| `shipment.delivered` | Shipment delivered to customer |
| `order.invoiced` | Invoice created (manual WMS action) |
| `order.fulfilled` | Order fully completed (closure state) |
| `order.cancelled` | Order cancelled in WMS |
| `stock.changed` | Inventory levels changed |
| `inventory.low_stock` | Stock below threshold alert |

### 2.3 Removed Events

The following event names are NOT canonical and must NOT be used:

- `deal.confirmed` — REMOVED, use `deal.won` instead

---

## 3. Canonical Status Dictionaries

### 3.1 CRM Status: deals.fulfillment_status

| Value | Description |
|-------|-------------|
| `pending` | Default, no WMS action yet |
| `reserved` | Reservation created in WMS |
| `picking` | Picking started or prepared |
| `shipped` | Shipment posted |
| `delivered` | Shipment delivered |
| `cancelled` | Deal cancelled |

### 3.2 WMS Status: orders.status

| Value | Description |
|-------|-------------|
| `draft` | Manual WMS-only orders |
| `confirmed` | Order confirmed |
| `reserved` | Stock reserved |
| `picking` | Picking in progress |
| `shipped` | Shipment posted |
| `delivered` | Delivery confirmed |
| `invoiced` | Invoice created |
| `fulfilled` | Closed and completed |
| `cancelled` | Cancelled |

### 3.3 WMS Status: reservations (two-field model)

**Column: reservations.status**

| Value | Description |
|-------|-------------|
| `active` | Reservation is active |
| `released` | Reservation has been released |

**Column: reservations.release_reason** (only when status is released)

| Value | Description |
|-------|-------------|
| `expired` | TTL exceeded |
| `cancelled` | User or system cancelled |
| `converted` | Converted to order |

### 3.4 WMS Status: orders.fulfillment_blocker_status

| Value | Description |
|-------|-------------|
| `none` | No blockers |
| `backordered` | Waiting for stock |
| `awaiting_incoming` | Stock expected from supplier |
| `needs_central_check` | Requires central warehouse review |
| `production_required` | Needs manufacturing |
| `rejected` | Rejected from fulfillment |

### 3.5 WMS Status: orders.fulfillment_outcome

| Value | Description |
|-------|-------------|
| `complete` | Fully fulfilled |
| `partial_closed` | Partially fulfilled then closed |
| `cancelled` | Cancelled |

---

## 4. Event to Status Transition Table

**Note:** `orders.status` is NOT set to `reserved` by reservation events; reservation state is tracked only in the `reservations` table.

| Event | CRM fulfillment_status | WMS orders.status | Notes |
|-------|------------------------|-------------------|-------|
| `deal.won` | pending | — | WMS receives, shows as pending |
| `deal.cancelled` | cancelled | cancelled | WMS sets action_required=true, requires soft-close |
| `reservation.created` | reserved | — | Updates reservations.status=active |
| `reservation.released` | conditional | — | See rules below |
| `reservation.converted` | no change | — | Continue from order flow |
| `order.created` | no change | confirmed | Order shell created |
| `order.picking_started` | picking | picking | CRM shows picking |
| `order.prepared` | picking | picking | Same CRM status |
| `shipment.posted` | shipped | shipped | In transit |
| `shipment.delivered` | delivered | delivered | Customer received |
| `order.invoiced` | no change | invoiced | WMS internal milestone |
| `order.fulfilled` | no change | fulfilled | Closure state |
| `order.cancelled` | cancelled | cancelled | Both systems mark cancelled |

### 4.1 reservation.released Transition Rules

- If `release_reason` is `cancelled` or `expired` AND reservation was NOT converted: CRM reverts to `pending` (if currently `reserved`)
- If `release_reason` is `converted`: Do NOT revert CRM status; continue from order flow

The `reservation.released` webhook payload MUST include `release_reason` with allowed values: `expired`, `cancelled`, or `converted`.

**Example Payload:**

```json
{
  "event_type": "reservation.released",
  "idempotency_key": "wms:reservation:ghi789:released:v1",
  "payload": {
    "wms_reservation_id": "ghi789",
    "crm_deal_id": "def456",
    "release_reason": "converted",
    "released_meters": 150.00
  }
}
```

### 4.2 order.invoiced Ordering Rules

- `order.invoiced` is REQUIRED before `order.fulfilled`
- `order.invoiced` may occur after `shipment.posted`
- `order.invoiced` may occur before OR after `shipment.delivered` (policy-dependent)
- `order.fulfilled` is always the final closure state

---

## 5. Idempotency Key Standard

### 5.1 Format (LOCKED)

```text
<source_system>:<entity>:<entity_id>:<action>:v1
```

### 5.2 Standard Examples

```text
crm:customer:abc123:created:v1
crm:customer:abc123:updated:v1
crm:deal:def456:approved:v1
crm:deal:def456:accepted:v1
crm:deal:def456:won:v1
crm:deal:def456:cancelled:v1
wms:reservation:ghi789:created:v1
wms:reservation:ghi789:released:v1
wms:reservation:ghi789:converted:v1
wms:order:jkl012:created:v1
wms:order:jkl012:picking_started:v1
wms:order:jkl012:prepared:v1
wms:order:jkl012:invoiced:v1
wms:order:jkl012:fulfilled:v1
wms:order:jkl012:cancelled:v1
wms:shipment:mno345:posted:v1
wms:shipment:mno345:delivered:v1
```

### 5.3 Repeating Actions

For actions that may repeat (like line updates), use revision counter:

```text
crm:deal:<deal_id>:lines_updated:rev<increment>:v1
```

Example:

```text
crm:deal:def456:lines_updated:rev1:v1
crm:deal:def456:lines_updated:rev2:v1
crm:deal:def456:lines_updated:rev3:v1
```

### 5.4 Stock Events

Stock events use compound entity ID with pipe separator. NO TIMESTAMPS.

```text
wms:stock_item:FABRIC-A|BLUE-001:changed:v1
wms:stock_item:FABRIC-A|BLUE-001:low_stock:v1
wms:stock_item:SILK-B|RED-042:changed:v1
```

---

## 6. Partial Flows and Backorder Modeling

### 6.1 Partial Reservations

- Track at line level: `reserved_meters` vs `requested_meters`
- Compute `is_partial` flag when `reserved_meters < requested_meters`
- Order remains open until all lines completed

### 6.2 Partial Shipments

- Track at line level: `shipped_meters` vs `ordered_meters`
- Multiple shipments per order are allowed
- Do NOT create extra CRM statuses like `partially_shipped`
- CRM shows line-level progress meters

### 6.3 Backorder View

- Use `fulfillment_blocker_status` to filter orders in WMS
- Dedicated Backorders view shows orders where `fulfillment_blocker_status != 'none'`
- Does NOT corrupt lifecycle status

---

## 7. Cancellation Rules

### 7.1 CRM Cancellation After Reservation Exists

1. CRM sends `deal.cancelled` event
2. WMS does NOT hard delete automatically
3. WMS sets `orders.status = 'cancelled'` and `action_required = true`
4. WMS user performs soft-close or soft-delete (logged in audit)
5. CRM customer page shows cancelled orders historically

### 7.2 Cancellation After Picking Started

Setting: `allow_cancel_after_picking_started`

| Value | Behavior |
|-------|----------|
| `false` (default) | Require manager override to cancel |
| `true` | Allow cancel with warning |

---

## 8. Picking Behavior Requirements

When picking starts in WMS:

1. Picker records actual lot, roll, and meters picked
2. Order content may change based on:
   - **Single-lot preference**: Customer prefers one lot, may reduce meters
   - **Allowed variance**: 5 to 10 percent higher than requested allowed
   - **Substitutions**: Require approval (permission-gated)

These are line-level adjustments, not status changes.

---

## 9. Pricing and Cost Ownership

| Aspect | Owner | Notes |
|--------|-------|-------|
| Sales quote prices | CRM | Deal lines include unit_price |
| Price approvals | CRM | Discount approval workflow |
| Inbound stock costs | WMS | Customs, supplier costs |
| COGS calculation | WMS | Based on actual lots picked |
| Landed cost | Future | Pricing Engine app (WIP) |
| Margin calculation | Future | Pricing Engine app (WIP) |

### 9.1 Future Pricing Engine

A separate Pricing Engine app will compute prices using WMS costs and market data, feeding calculated prices to CRM for quotes. This is not yet implemented and documented for reference only.

---

## 10. Required Schema Changes

### 10.1 CRM Database: deals Table

```sql
ALTER TABLE deals ADD COLUMN wms_reservation_id TEXT;
ALTER TABLE deals ADD COLUMN wms_order_id TEXT;
ALTER TABLE deals ADD COLUMN wms_shipment_id TEXT;
ALTER TABLE deals ADD COLUMN fulfillment_status TEXT DEFAULT 'pending';
ALTER TABLE deals ADD COLUMN shipped_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN tracking_number TEXT;
```

### 10.2 CRM Database: deal_lines Table

```sql
CREATE TABLE deal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  quality_code TEXT NOT NULL,
  color_code TEXT,
  requested_meters NUMERIC(12,2) NOT NULL,
  reserved_meters NUMERIC(12,2),
  shipped_meters NUMERIC(12,2),
  delivered_meters NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  line_notes TEXT,
  wms_reservation_line_id TEXT,
  wms_order_line_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 10.3 WMS Database: reservations Table

```sql
ALTER TABLE reservations ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE reservations ADD COLUMN release_reason TEXT;
ALTER TABLE reservations ADD COLUMN crm_deal_id TEXT;
ALTER TABLE reservations ADD COLUMN crm_customer_id TEXT;
ALTER TABLE reservations ADD COLUMN crm_organization_id TEXT;
```

### 10.4 WMS Database: orders Table

```sql
ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'confirmed';
ALTER TABLE orders ADD COLUMN fulfillment_blocker_status TEXT DEFAULT 'none';
ALTER TABLE orders ADD COLUMN fulfillment_outcome TEXT;
ALTER TABLE orders ADD COLUMN action_required BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN crm_customer_id UUID;
ALTER TABLE orders ADD COLUMN crm_deal_id UUID;
```

Allowed values for `status` are exactly as defined in Section 3.2: `draft`, `confirmed`, `reserved`, `picking`, `shipped`, `delivered`, `invoiced`, `fulfilled`, `cancelled`.

---

## 11. API and Webhook Contracts

### 11.1 CRM Exposes

| Endpoint | Purpose |
|----------|---------|
| `POST /crm-get-customer` | Customer lookup |
| `POST /crm-search-customers` | Customer search |
| `POST /crm-integration-api` | Webhook receiver (HMAC validated) |

### 11.2 WMS Exposes

| Endpoint | Purpose |
|----------|---------|
| `POST /api-get-inventory` | Stock query (masked or full) |
| `POST /api-get-catalog` | Catalog items |
| `POST /api-create-order` | Order creation from CRM |

### 11.3 HMAC Signing

| Parameter | Value |
|-----------|-------|
| Header | `X-Signature`, `X-Timestamp` |
| Algorithm | HMAC-SHA256 |
| Payload | `JSON.stringify(body) + timestamp` |
| Window | 5 minutes |

---

## 12. Secrets Required

| Secret | CRM | WMS | Purpose |
|--------|-----|-----|---------|
| `WMS_API_KEY` | Yes | — | Auth to WMS |
| `WMS_API_URL` | Yes | — | WMS endpoint |
| `WMS_WEBHOOK_SECRET` | Yes | — | Validate incoming WMS webhooks |
| `CRM_API_KEY` | — | Yes | Auth to CRM |
| `CRM_API_URL` | — | Yes | CRM endpoint |
| `CRM_WEBHOOK_SECRET` | — | Yes | Validate incoming CRM webhooks |

---

## 13. Implementation Note for WMS

### 13.1 Spelling Normalization

Canonical spelling in contract and all outbound events is:

```text
cancelled
```

However, WMS currently has a legacy internal enum value:

```text
canceled
```

**Required Actions:**

- WMS MUST normalize any internal `canceled` value to `cancelled` in outbound webhook payloads and any CRM-facing displays
- Internal DB migration to canonical spelling may be scheduled later
- Normalization is mandatory immediately

This note exists in the contract to ensure CRM and WMS copies remain byte-identical.

---

## 14. Contract Lock Checklist

Before copying to WMS repo, verify:

- [ ] Filename is EXACT: `docs/integration_contract_v1.md`
- [ ] Contract content will be copied byte-for-byte into WMS repo
- [ ] `deal.confirmed` appears ONLY in Section 2.3 (Removed Events); zero occurrences elsewhere in repo docs & code
- [ ] Idempotency examples conform to locked format (no timestamps)
- [ ] All status dictionaries match between sections
- [ ] CRM to WMS event count is 7
- [ ] WMS to CRM event count is 15
- [ ] Total canonical events is 22

---

## 15. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.3 | 2026-01-13 | Fix checklist so deal.confirmed can exist only in Removed Events section |
| 1.0.2 | 2026-01-13 | Add missing WMS orders.status schema change |
| 1.0.1 | 2026-01-13 | Clarified reservation.released payload requires release_reason |
| 1.0.0 | 2026-01-13 | Initial canonical contract |

---

## 16. Lock Statement

**Any change to this contract requires:**

1. Bumping Version to v1.0.4 or higher
2. Updating the Last Updated date
3. Adding entry to Version History
4. Updating BOTH CRM and WMS repositories
5. Coordinating deployment timing between teams

This contract is now LOCKED. Do not modify without version bump.
