# Agent Checklist — Pricing, Thresholds, Warehouse Confirmation (v1.10)

## Multi-Org Access Grants (LOCKED)

- Users authenticate once, but **data access is per org grant** (`user_org_roles`).
- Grant is **per user + per org + per org role**.
- Store an **Active Org** per user (`user_active_org_preferences`).
- RLS MUST ensure: users cannot infer other orgs exist unless granted.

**Required behaviors**
- Sales roles: default single-org view (Active Org).
- Sales Manager / Accounting / Pricing / Admin: can toggle “All Orgs”; tables show `Org` column/badge + filter.
- Warehouse roles: SHOULD be granted all orgs (to avoid operational misses); org labels are minimized in WMS UI.

**Customer identity**
- `customers` is global identity.
- `customer_org_profiles` is org-scoped commercial profile with `status` (active/inactive) and per-org overrides for billing/shipping.

**Identifiers**
- Deal/PO codes are org-prefixed and non-sequential (random/ULID base32). Prefix changes apply to future codes only.



## 1) Roles & where they work (no bouncing between apps)

### CRM roles
- **Sales Owner:** creates deals, requests discount/override, requests shipment approval (cannot approve).
- **Sales Manager / Pricing role / Admin:** approves pricing, confirms payments (bulk), approves shipments, clears credit blocks, handles shortage decisions.
- **Accounting (optional later):** can be granted payments import, but **not required** for v1.

### WMS roles
- **Warehouse Staff:** physical picking/packing; confirms lot/roll/meters allocation in WMS UI.
- **WMS Ops:** runs allocation entry for incoming supply, creates/updates carrier fields at shipment.
- **WMS Manager:** can **override** shipment gate (create PO / push ship) with reason codes.

**Rule:** Warehouse never logs into CRM. Sales never allocates lots/rolls in WMS. Managers approve in CRM; operations confirm allocation in WMS.

---

## 2) CRM must implement

### Pages
- `/fulfillment` (Command Center)  
  - Stage cards + Universal table  
  - Human Gates tabs: Warehouse Confirmation (ON-HAND), Payment Confirmation, Shipment Approval, Ship Date Required, Shortage Decisions
- `/supply-tracking`
- `/pricing`
- `/payments`
- `/fx-rates`
- `/deals/:id` (Fulfillment + Pricing tabs)

### Data
- Pricing tables (list price per currency, customer price single currency)
- Payments ledger (reduces exposure globally; multi-currency limits)
- FX ratebook (effective datetime USDTRY/EURTRY)
- Mirror/cache: `reservation_mirrors`, `order_mirrors`, `stock_by_quality_cache`

### Hard locks
- **deal.won** requires all lines `pricing_state='approved'`
- Overdue amount > 0 => hard block (needs manager override)
- Cash customers => payment required before shipment approval
- Credit customers => payment required if over-limit OR overdue

### Events (CRM → WMS)
- deal.won
- supply_request.created / updated milestones (eta_confirmed, in_transit, arrived_soft)
- shipment.approved (only after gates pass OR manager override)
- shipment.cancelled (if needed)
- payment.confirmed is internal CRM only (no WMS event)

### Notifications (min)
- Weekly stale-in-stock list to Sales Manager/Pricing
- Credit/overdue block alerts in `/fulfillment` shipment approval tab
- Shipment approved → WMS Ops notification

---

## 3) WMS must implement

### Pages
- `/po-command-center`
- `/approvals/shipment` (override queue)
- `/supply-requests`
- `/allocation-planning` (incoming-backed only)
- `/allocation-entry` (incoming-backed only)
- `/picking`
- `/shipments` (carrier capture)
- `/orders/:id`

### Data
- orders: carrier fields + lifecycle timestamps + order_type
- reservation_lines/order_lines: sample fields + cutting audit fields
- Handle `needs_warehouse_confirmation` as action_required_reason
- Enforce ON-HAND requires allocation_state=allocated before accepting shipment.approved

### Events (WMS → CRM)
- stock.changed (aggregate by quality)
- reservation.created / updated (allocation_state, action_required_reason)
- order.created (after shipment.approved or override)
- order.status_changed (picking/prepared/shipped/delivered/invoiced/fulfilled)
- shipment.posted (carrier fields)
- shortage.detected (routes to CRM shortage decision tab)

---

## 4) Shared invariants (must not break)
- **Single PO full fulfilment:** a PO is not partially shipped. Partial ship = split into a new PO.
- **Soft arrival:** supply can be marked arrived without inventory increase until allocated.
- **On-hand warehouse confirmation:** allocation_state must be allocated with lot/roll/meters before shipment approval.
- **Fulfilled requires invoiced** (invoice may be 0 for free_sample).


---

## Org Grants & No-Leakage Tests (ADD, LOCKED)

### CRM
- [ ] user_org_roles exists (user↔org↔role)
- [ ] A user with only MOD grant cannot:
  - [ ] see JTR records in lists/search
  - [ ] infer JTR exists (no zero-balance rows, no totals)
- [ ] Multi-org Sales Manager can:
  - [ ] switch Org Scope = All
  - [ ] see customer exposure breakdown per org & currency (including zeros)
- [ ] Deal creation requires explicit org_id (defaults to Active Org)

### WMS
- [ ] Warehouse roles granted both orgs can pick/ship all POs but org badge is hidden unless role permits.
- [ ] Manager role sees org badge on lists/details.

## Deal Approval Command Center (CRM-only)
- [ ] Deal states: draft/submitted/approved/reworked/rejected
- [ ] Rework returns to draft and requires manager notes + field impacts
- [ ] Reject ends version; salesperson can clone
- [ ] Editing after submit auto-reverts to draft + audit

## UOM readiness
- [ ] Catalog has uom_mode; Deal lines include uom+qty; WMS enforces allowed uom.
- [ ] No kg↔m conversion required in v1.

## Printing/design (CRM-only)
- [ ] design_assets + print_requests tables; file stored in CRM bucket; link to deal_line.

## Cash pack (CRM-only)
- [ ] On deal.won (cash), generate Proforma + Contract Draft (unless waived)
- [ ] shipment.approved blocked until payment confirmed AND contract signed_received or waived


---

# Addendum (v1.10) — New Capabilities Checklist (Org Grants, Order Form, Abra, Balance Gate, Post-PO Issues, Costing)

## CRM MUST implement
### Org & RLS
- [ ] `orgs`, `user_org_grants` (user↔org + role_in_org)
- [ ] Hybrid org scope selector (Active Org / All Orgs where permitted)
- [ ] RLS: hard isolate org-scoped tables; hide non-granted org existence
- [ ] `customer_org_profiles.status` enforcement (inactive hidden from sales roles)

### Identifiers
- [ ] Deal code generator: `ORG3DL+CODE8` (unique)
- [ ] Proforma code generator: `ORG3YYYYPI+CODE8`
- [ ] Prefix config (future-only)

### Balance Check Gate (Proforma)
- [ ] Balance panel: Total Open, Overdue, Available Limit, Requested New
- [ ] Proforma disabled until acknowledgement
- [ ] Editable email draft inserts “settle outstanding X” line
- [ ] `paid_confirmed` requires payment ledger entry + manager payment confirmation

### Central Stock Check (Abra)
- [ ] Display central stock check results received from WMS on the deal/fulfillment panel
- [ ] Enforce/reflect: WMS cannot “Send back (No On-Hand/Shortage)” without completed check lines
- [ ] Weekly digest email support (configurable recipients)

### Order Form
- [ ] Public route `/order-form/:token` (subdomain optional)
- [ ] Token: expirable, one-time, regeneratable/unexpirable
- [ ] Submission creates deal `submitted_from_form=true`
- [ ] No customer edits after submit; internal edits trigger resend with diff table
- [ ] Up to 20 lines UI; Excel template upload lines-only (Turkish headers; strict validation + success indicator)
- [ ] Attachments upload (internal-only) + attachment notes

### Lab work
- [ ] Per-line lab workflow: requested → in_progress → sent_to_customer → approved/rejected
- [ ] Manager-only approve/reject

### Carrier preference
- [ ] “Use my carrier” toggle + optional fields; prefill WMS carrier capture

### Post-PO discrepancy loop
- [ ] Display WMS-raised issues in CRM timeline
- [ ] Block affected lines only in fulfillment view
- [ ] Auto-draft customer email for qty/lot changes; manager approval required

### Costing (CRM side)
- [ ] Receive cost mirrors from WMS (supplier invoices + landed cost components)
- [ ] Store overhead pools per org (no profitability gating in v1)

## WMS MUST implement
### Central Stock Checks UI
- [ ] `/central-stock-checks` queue
- [ ] Update result: found_in_abra / not_in_abra / uncertain + available_qty + proposed_next_step + ETA
- [ ] Emit completion event to CRM

### UOM readiness
- [ ] Validate order lines respect catalog `uom_allowed`
- [ ] Store order/reservation line uom + qty

### Invoice control (NEW)
- [ ] `invoice_status`: not_issued/issued and upload/attach invoice export payload
- [ ] `invoice_control_status`: pending_control/passed/failed
- [ ] Bulk queue with pagination + excel export (invoice control queue)
- [ ] Only WMS Ops (or configured management role) can pass/fail; failure requires note

### Post-PO discrepancy reporting
- [ ] Ability to flag issue on PO lines any time after PO created
- [ ] Line-level blocking state + reason
- [ ] Sync to CRM via events

### Costing (WMS)
- [ ] Supplier invoice capture (header + lines)
- [ ] Select/override FX rate per invoice (audited)
- [ ] Allocate landed cost to receipts/lots
- [ ] Support later cost adjustments with audit
- [ ] Compute WAC in TRY while retaining original currency + FX used

## Shared “No Spaghetti” acceptance tests
- [ ] A user with only MOD grant cannot see JTR rows or even org existence (search/export)
- [ ] Multi-org manager sees both orgs with org column; can filter and bulk approve across orgs
- [ ] WMS “Send back (No On-Hand/Shortage)” is blocked unless central stock checks are completed per affected line
- [ ] Order form token cannot be reused; regeneration creates a new valid token
- [ ] Proforma cannot be marked paid_confirmed without payment ledger entry + manager confirmation

## Customer Status Emails (NEW, CRM-owned)
- ✅ CRM MUST implement customer-facing status emails triggered by WMS lifecycle events (no WMS-to-customer emailing).
- ✅ Default ON: Shipped, Delivered. Default OFF: Picking started, Prepared/packed, Ship-date updates.
- ✅ Must respect customer opt-out + org-specific branding.
- ✅ Must be idempotent (no duplicate emails on event retries).

---

## APPENDED — v1.0.23 Alignment Addendum (Non-breaking)
**Date appended:** 2026-01-30  
**Contract authority:** `integration_contract_v1_0_23(1)(1).md` is the locked single source of truth.  
**Rule:** If anything in this document conflicts with Contract v1.0.23, Contract v1.0.23 wins. No schema/event/idempotency drift is permitted.

### v1.0.23 Checklist additions (append-only)

#### A) Contract authority
- Verify the agent is implementing against Contract v1.0.23 (`integration_contract_v1_0_23...md`) and not older versions.

#### B) Role intent (no accidental salesperson approvals)
- Confirm shipment approval / payment confirmation / pricing approvals are **not** enabled for salesperson by default.
- Confirm explicit-permission exception is supported (grantable) but not implied.

#### C) stock.changed dependency
- Confirm `stock.changed` drives `stock_by_quality_cache` and any UI that depends on “in stock” (stale queue, missing prices queue, shortage decisions context).

#### D) Ordering/sequence safety
- If inbound payload includes a monotonic sequence field, enforce “ignore out-of-order” logic and log warnings.

#### E) Email idempotency + defaults
- Ensure customer emails are CRM-owned, idempotent, logged, and conservative by default.
