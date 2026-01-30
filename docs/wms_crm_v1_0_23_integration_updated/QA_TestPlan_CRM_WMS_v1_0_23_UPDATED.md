# CRM ↔ WMS Integration QA Test Plan (v1.0.21)

**Date:** 2026-01-26  
**Scope:** Validates the integration contract v1.0.21 + PRD v1.9 + Checklist v1.9 + WMS Appendix v1.0.21.  
**Goal:** Production-ready confidence without “org leakage”, broken gates, or inconsistent states.

---

## 0. Test Data & Roles

### 0.1 Seed Orgs
- ORG: `MOD`
- ORG: `JTR`

### 0.2 Users (minimum)
- U1: Sales Owner (MOD only)
- U2: Sales Owner (JTR only)
- U3: Sales Manager (MOD + JTR)
- U4: Pricing (MOD + JTR)
- U5: Accounting (MOD + JTR)
- U6: Warehouse Staff (both org grants, org UI de-emphasized)
- U7: Warehouse Manager (both org grants)
- U8: Admin (all)

### 0.3 Customers
- C1: Shared customer (global) with active profiles in MOD + JTR
- C2: Customer active in MOD, inactive in JTR
- C3: Customer inactive in MOD, active in JTR
- MOD-as-customer-of-JTR: “MODASTAR” as a customer under JTR org profile (credit customer)

### 0.4 Catalog / Qualities
- QG1: scope=GLOBAL, inventory_owner=JTR, uom_allowed=MT_ONLY
- QJ1: scope=JTR, uom_allowed=MT_ONLY
- QM1: scope=MOD, uom_allowed=MT_ONLY
- QK1: scope=MOD, uom_allowed=KG_ONLY (infrastructure-ready; no conversion)

---

## 1. Org Grants & RLS (No Leakage)

### RLS-01 — Non-granted org invisibility
**Pre:** U1 has only MOD grant.  
**Steps:**  
1) Search customers, deals, credit, pricing, fulfillment lists.  
2) Attempt direct URL access to a known JTR deal ID.  
**Expected:** No JTR rows visible; direct URL returns 404/permission denied; no hints that JTR exists.

### RLS-02 — Multi-org user combined view
**Pre:** U3 has MOD+JTR.  
**Steps:** Switch org scope to All Orgs; open `/fulfillment`, `/credit`, `/pricing`.  
**Expected:** Combined tables include `org` column and show both org rows (including zeros).

### RLS-03 — customer_org_profile.status enforcement
**Pre:** C2 is inactive in JTR. U2 has JTR sales role only.  
**Steps:** Search C2 in JTR; attempt create deal.  
**Expected:** Cannot see customer; cannot create deal.  
**Control:** U3 (manager) can see and activate.

---

## 2. Identifiers (Deal/PO/Proforma)

### ID-01 — Deal code format
**Steps:** Create a deal in MOD.  
**Expected:** `deal_code` starts with `MODDL` and ends with CODE8; unique constraint enforced.

### ID-02 — PO code format (WMS)
**Steps:** Approve shipment to create PO.  
**Expected:** `po_number` starts with `MODP` and ends with CODE8; unique.

### ID-03 — Prefix future-only change
**Pre:** Admin changes MOD prefix to `MSX`.  
**Steps:** Create new deal/PO.  
**Expected:** New codes use MSX*; old codes unchanged.

---

## 3. Deal Command Center (Approve / Rework / Reject)

### DEAL-01 — Approve semantics
**Pre:** Deal submitted, pricing approved.  
**Steps:** Sales manager approves deal.  
**Expected:** Deal becomes “approved”; does NOT become won until customer confirmation.

### DEAL-02 — Rework returns to draft + reason
**Steps:** Manager clicks Rework with note referencing fields.  
**Expected:** Deal returns to Draft; sales sees reason; audit log records manager note.

### DEAL-03 — Reject + resubmit as new version
**Steps:** Manager rejects. Sales creates a new version/resubmits.  
**Expected:** Old rejected remains searchable (archived); new submission allowed.

### DEAL-04 — Edit after submit triggers auto-rework
**Steps:** After submit but before manager action, salesperson edits qty/color.  
**Expected:** Deal auto-flips to Draft; logs “changed after submit”.

---

## 4. Pricing & Staleness

### PRC-01 — Org-specific list prices
**Steps:** Set different list prices for same quality in MOD and JTR.  
**Expected:** Pricing UI shows correct per-org values; no cross-org leak.

### PRC-02 — Missing customer price behavior
**Pre:** Customer price exists in MOD, missing in JTR. Deal in JTR.  
**Steps:** Attempt approve pricing.  
**Expected:** System suggests JTR list price; manager must approve; it creates a JTR customer price going forward.

### PRC-03 — Deal won blocked unless all pricing_state approved
**Steps:** Attempt mark won with a pending pricing line.  
**Expected:** Blocked with clear validation message.

---

## 5. Credit / Payments / Balances Grid

### CRD-01 — Balances grid per org/currency
**Steps:** Open `/credit` tab “Balances Grid” as U3.  
**Expected:** Shows customer rows for MOD and JTR even if zero.

### CRD-02 — Single-org user sees only their org
**Pre:** U1 only MOD grant.  
**Expected:** Only MOD rows visible.

### PAY-01 — Payments ledger import requires org
**Steps:** Import payments without org column.  
**Expected:** Hard validation error.

---

## 6. Proforma + Balance Check Gate

### PRO-01 — Balance panel required before proforma download
**Steps:** Open proforma panel for cash customer deal.  
**Expected:** Balance panel visible; Download/Send disabled until acknowledgement.

### PRO-02 — Overdue messaging insertion (editable)
**Pre:** Customer has overdue in same org/currency.  
**Steps:** Generate proforma; review email draft.  
**Expected:** Draft includes “order will not be fulfilled unless overdue is paid”; user can edit.

### PRO-03 — proforma_status correctness
**Steps:** Attempt set `paid_confirmed` without payment ledger entry.  
**Expected:** Denied.  
**Then:** Add payment ledger entry; manager confirms payment.  
**Expected:** `paid_confirmed` allowed.

### PRO-04 — Salesperson can send proforma
**Expected:** Salesperson can send email; shipment/payment confirmations remain gated.

---

## 7. Order Form (Public Token) + Excel Upload

### OF-01 — Token expiry and one-time use
**Steps:** Open order form link; submit once; attempt re-open + submit again.  
**Expected:** Second submission blocked as “used”.

### OF-02 — Regenerate/unexpire token
**Steps:** Sales regenerates/unexpires token; customer resubmits.  
**Expected:** New token works; previous token invalid; deal updated.

### OF-03 — Customer cannot edit after submit
**Steps:** After submit, customer attempts edit.  
**Expected:** Not allowed; shows instruction to contact sales.

### OF-04 — Internal edit triggers resend with diff
**Steps:** Sales edits deal lines/header and clicks “Resend confirmation”.  
**Expected:** Email includes Before→After table for changed fields + full updated request summary.

### OF-05 — Bulk lines limit (20)
**Steps:** Add 21st line in UI.  
**Expected:** Block with prompt to use template upload.

### OF-06 — Excel template upload (lines-only, TR headers)
**Steps:** Upload template with one invalid line.  
**Expected:** Hard-block; error list; nothing submitted.  
**Then:** Upload valid file.  
**Expected:** Success indicator; grid populated.

### OF-07 — Attachments upload stored internal-only
**Steps:** Customer attaches files; submit.  
**Expected:** Files stored in CRM bucket; internal users can view; not auto-emailed back.

### OF-08 — “Use my carrier” optional fields
**Steps:** Toggle; fill carrier fields; submit.  
**Expected:** Saved on deal header; visible internally; WMS still captures final carrier fields later.

### OF-09 — Lab work workflow
**Steps:** Set lab work per line; progress through statuses; manager approves/rejects.  
**Expected:** Only manager can approve/reject; timeline updated.

---

## 8. Abra Central Stock Check (Manufacturing gate)

### ABR-01 — Manufacturing submit blocked until checks completed
**Steps:** Deal line is shortage/no-on-hand → attempt submit manufacturing request.  
**Expected:** Blocked; requires central stock check completion for that line.

### ABR-02 — Create central stock check request to WMS
**Expected:** WMS queue receives request; CRM shows “pending check”.

### ABR-03 — WMS completes check and syncs back
**Steps:** WMS sets in_Abra_yes/no + qty + ETA; posts completion.  
**Expected:** CRM shows result; manufacturing request can proceed.

### ABR-04 — Per-line repetition
**Steps:** Change quality/color on a line; ensure prior check doesn’t satisfy new line.  
**Expected:** Requires new check for changed line.

---

## 9. Fulfillment / Shipment Approval / WMS Integration

### FUL-01 — Shipment approval creates PO (and enforces warehouse confirmation)
**Steps:** Approve shipment for on-hand lines.  
**Expected:** If allocation_state not allocated, blocked until WMS confirms.

### FUL-02 — Bulk shipment approvals across orgs
**Pre:** U3 in All Orgs.  
**Steps:** Bulk approve multiple rows across orgs.  
**Expected:** Allowed; audit logs per row include org_id.

---

## 10. Post-PO Discrepancy Loop (WMS → CRM)

### DPO-01 — WMS can raise issue anytime after PO created
**Steps:** Raise shortage issue before picking starts.  
**Expected:** Allowed; syncs to CRM.

### DPO-02 — Line-level block only
**Steps:** Multi-line PO: flag issue on one line.  
**Expected:** Other lines proceed; blocked line requires resolution.

### DPO-03 — Resolution proposed by salesperson, approved by manager
**Steps:** Sales proposes reduced qty; manager approves.  
**Expected:** Auto-draft email created; send; timeline updated.

### DPO-04 — Lot swap flagged + requires customer approval
**Steps:** WMS changes lot while keeping qty.  
**Expected:** Flag visible in CRM; customer approval email drafted.

---

## 11. MOD as Customer of JTR (Auto-linked internal deal)

### IC-01 — Auto-create internal JTR→MOD deal on shipment approval
**Pre:** External deal in MOD consumes JTR-owned quality.  
**Steps:** Approve shipment.  
**Expected:** CRM auto-creates linked internal deal/order in JTR with customer=MODASTAR; suggested price copied.

### IC-02 — Internal credit rules apply (MOD overdue blocks shipment)
**Pre:** MODASTAR has overdue/overlimit under JTR.  
**Steps:** Attempt shipment approval.  
**Expected:** Blocked unless manager override; message shown in same approval screen.

---

## 12. Costing & Inventory Valuation (WMS + CRM)

### CST-01 — Supplier invoice capture with selected FX (audited)
**Steps:** Create invoice in USD; select FX rate; post.  
**Expected:** Stores original currency + FX + TRY computed; audit trail.

### CST-02 — Receipt basis per roll/lot stored
**Steps:** Receive stock; tie receipt to invoice line.  
**Expected:** Roll/lot has unit cost basis.

### CST-03 — WAC computed in TRY
**Steps:** Multiple receipts at different costs; compute WAC.  
**Expected:** WAC reflects weighted average; available to CRM via mirrors.

### CST-04 — Cost adjustment after receipt
**Steps:** Add duty/freight later; allocate to remaining stock.  
**Expected:** Re-cost remaining stock; audit entry created; WAC updates.

### CST-05 — Org-level inventory reporting by catalog ownership
**Steps:** Report inventory value split by owner org (scope/owner).  
**Expected:** Correct attribution (JTR-owned vs MOD-owned).

### CST-06 — FX profitability reporting readiness
**Expected:** Reports can show original currency amounts + TRY conversions used.

---

## 13. Notifications (Recipient Configuration)

### NTF-01 — Per-org recipients per email type
**Steps:** Configure recipients; trigger each email type.  
**Expected:** Sent to configured list; logged in audit/events.

### NTF-02 — Weekly digest variants
**Steps:** Verify weekly digest for manufacturing/import/central-check/shortage events.  
**Expected:** Digest contains correct items and org separation.

---

## 14. Regression / Safety
- [ ] Idempotency keys for cross-system events (no duplicate PO creation)
- [ ] Audit log entries for every gate action and override
- [ ] Export/reporting respects org scope
- [ ] Performance: mirrors prevent N+1 calls in command centers
---

## Customer Status Email Notifications (WMS → CRM)

### TC-EMAIL-01 Shipped email (default ON)
- Precondition: customer_org_profile.status_emails_enabled=true
- Action: WMS marks order shipped and emits `shipment.posted` with carrier fields + `shipped_at`
- Expected:
  - CRM sends exactly one “Shipped” email to customer (no duplicates on retry)
  - Email includes org branding (From Name + signature/footer), `po_number`, `tracking_id`
  - Email event logged on Deal timeline

### TC-EMAIL-02 Delivered email (default ON)
- Action: WMS marks delivered and emits delivered event / updates `delivered_at`
- Expected: CRM sends “Delivered” email once; logs timeline; respects opt-out

### TC-EMAIL-03 Opt-out enforcement
- Precondition: customer has opted out (per org)
- Action: shipped + delivered events occur
- Expected: CRM does NOT send customer emails; internal log still recorded

### TC-EMAIL-04 Optional statuses OFF by default
- Action: WMS emits picking_started/prepared events
- Expected: CRM does NOT send unless org config enables those types

### TC-EMAIL-05 Idempotency / retry
- Action: replay same `shipment.posted` event twice (same idempotency key)
- Expected: only one customer email sent


---

# Additional Test Coverage (v1.0.21)

## 1) Identifier formats (Deal / PO / Proforma)

**TC-ID:** ID-01  
**Scenario:** Deal number format is `{ORG}DL{CODE8}`  
**Steps:** Create a new deal in MOD and JTR org scopes.  
**Expected:** Deal number matches `^([A-Z]{3})DL([0-9A-Z]{8})$` and is unique.  

**TC-ID:** ID-02  
**Scenario:** PO number format is `{ORG}P{CODE8}`  
**Steps:** Approve shipment to create PO in WMS.  
**Expected:** PO number matches `^([A-Z]{3})P([0-9A-Z]{8})$` and is unique.  

**TC-ID:** ID-03  
**Scenario:** Prefix changes apply future-only  
**Steps:** Change org prefix in settings, create new deal + PO.  
**Expected:** Old records unchanged; new records use new prefix.  

## 2) Customer onboarding gate (first-order Won)

**TC-ID:** CUST-01  
**Scenario:** New customer defaults to pending_review  
**Steps:** Create customer via order form or CRM create.  
**Expected:** `customers.review_status = pending_review`.  

**TC-ID:** CUST-02  
**Scenario:** Deal cannot be Won for pending_review customer  
**Steps:** Create deal for pending_review customer → attempt set deal to Won.  
**Expected:** Hard block with clear message: onboarding questions incomplete OR approval required.  

**TC-ID:** CUST-03  
**Scenario:** Completing onboarding + manager approves allows Won  
**Steps:** Fill the 3 onboarding questions → Sales Manager sets `review_status=approved` → set deal to Won.  
**Expected:** Deal can transition to Won.  

**TC-ID:** CUST-04  
**Scenario:** Manager override allows Won without onboarding completion  
**Steps:** Without onboarding completion, Sales Manager applies override with reason note.  
**Expected:** Deal can transition to Won; override is audit-logged.  

## 3) WMS “No On-Hand send-back” requires Abra check

**TC-ID:** ABRA-01  
**Scenario:** WMS cannot “Send back (No On-Hand/Shortage)” without Abra check  
**Steps:** In WMS, attempt send-back on a line with insufficient on-hand; do not complete Abra check.  
**Expected:** Hard block; user prompted to record Abra check result.  

**TC-ID:** ABRA-02  
**Scenario:** Abra check outcomes are structured and synced to CRM  
**Steps:** Complete Abra check with each result type:
- found_in_abra + available_qty + proposed_next_step=import_from_central
- not_in_abra + proposed_next_step=manufacture
- uncertain + proposed_next_step=needs_central_confirmation  
**Expected:** CRM shows the structured outcome and ETA text; audit trail exists.  

## 4) Invoice export + invoice control gate

**TC-ID:** INV-01  
**Scenario:** Invoice-ready export payload exists and is settings-configurable  
**Steps:** After packing/shipping, generate export payload.  
**Expected:** Payload downloads/exports successfully; mapping config is editable in settings (non-hardcoded).  

**TC-ID:** INV-02  
**Scenario:** Fulfilled/Closed requires invoice control passed  
**Steps:** Mark invoice issued → leave invoice_control_status=pending_control → attempt close/fulfilled.  
**Expected:** Blocked.  

**TC-ID:** INV-03  
**Scenario:** Bulk invoice control queue works  
**Steps:** Open invoice control queue → paginate → export to Excel → mark multiple as passed.  
**Expected:** All actions succeed; status updates persist; user returns to same grid state.  

## 5) Customer-facing WMS status notifications (phased rollout)

**TC-ID:** NOTIF-01  
**Scenario:** Customer notifications are OFF by default  
**Steps:** Create shipment → mark shipped/delivered.  
**Expected:** No external email is sent until toggled on per customer/org or global settings.  

**TC-ID:** NOTIF-02  
**Scenario:** Only Shipped + Delivered are enabled (Prepared OFF)  
**Steps:** Toggle customer notifications ON → run Prepared → Shipped → Delivered.  
**Expected:** Emails only for Shipped and Delivered.  

**TC-ID:** NOTIF-03  
**Scenario:** “Tracking changed” does not auto-email  
**Steps:** After shipped email, edit tracking number in WMS.  
**Expected:** No automatic corrected email; internal UI shows updated tracking.  

## 6) Delivered email with signed delivery note photos (next-day batch)

**TC-ID:** POD-01  
**Scenario:** Signed irsaliye photos are uploaded and included in Delivered email (next-day) when enabled  
**Steps:** Upload signed delivery note photos → set delivered → run next-day batch/digest.  
**Expected:** Delivered email includes attachments; stored internally; only sent if notifications enabled.

---

## APPENDED — v1.0.23 Alignment Addendum (Non-breaking)
**Date appended:** 2026-01-30  
**Contract authority:** `integration_contract_v1_0_23(1)(1).md` is the locked single source of truth.  
**Rule:** If anything in this document conflicts with Contract v1.0.23, Contract v1.0.23 wins. No schema/event/idempotency drift is permitted.

### Addendum Test Suite — v1.0.23 alignment (append-only)

#### A) Contract authority / drift prevention
1. Verify the running system references Contract v1.0.23 as the single source of truth:
   - Event names and payload fields match exactly.
   - Idempotency keys are 5 segments and end with `:v1`.
2. Any event payload field not present in the contract must be rejected (or logged and ignored) per the contract’s strictness rules.

#### B) Idempotency key format validation (DB + Edge)
**DB**
- `validate_idempotency_key('wms:order:abc123:created:v1')` → TRUE
- Keys with segment count ≠ 5 → FALSE
- Suffix ≠ v1 → FALSE
- Empty entity_id (segment 3) → FALSE

**Edge**
- Inbound webhook with invalid idempotency key → HTTP 400
- Inbound webhook with valid key + valid HMAC → HTTP 200 and exactly one inbox row created

#### C) Inbox retry semantics (Appendix D.3)
1. Duplicate key + existing status=processed/ignored → 200, no change
2. Duplicate key + status=pending/processing → 200, no change
3. Duplicate key + status=failed → 200, existing row set to pending, attempt_count increments, last_error cleared (except drift warning)
4. Payload hash drift on failed re-ingest:
   - Do **not** overwrite `payload_json`
   - Append `[DRIFT] ...` to `last_error`

#### D) RLS: “no null-org leak” rule (Appendix D.2)
1. As non-admin authenticated user:
   - `SELECT * FROM crm_event_inbox` → denied
   - `SELECT * FROM crm_event_outbox` → denied
2. As admin:
   - SELECT is allowed
3. Confirm there is **no** policy containing `OR organization_id IS NULL` on `crm_event_inbox`.

#### E) stock.changed (Contract v1.0.23) — cache correctness + scope keys
1. Replaying the same `transaction_batch_id` twice must not create duplicate side effects.
2. Null-dimension scope key behavior:
   - Null `crm_organization_id` → org_scope_key sentinel is used in uniqueness
   - Null/blank `color_code` → `__NULL__` sentinel
   - Null `warehouse_id` → UUID sentinel
3. Verify UPSERT uniqueness uses scope keys (org/color/warehouse) exactly, so nulls never break unique constraints.

#### F) Ordering / sequence handling (monotonic seq)
If any inbound payload includes `org_access_seq` (and `status_seq` where present in the contract baseline):
1. Receive seq=10 then seq=9:
   - seq=10 applied
   - seq=9 ignored and warning logged
2. Receive seq=10 then seq=10:
   - duplicate ignored (idempotency + seq guard)

#### G) Permission intent regression tests (User Stories #17–#18)
1. Default role permissions:
   - salesperson cannot approve shipments / confirm payments / approve pricing
   - sales_manager can approve shipments / confirm payments / approve pricing
2. Explicit grant exception:
   - grant `approvals.shipment.approve` to a specific salesperson → that user can approve shipments
   - without the grant → cannot

#### H) Email idempotency (customer-facing + digests)
1. Shipped/Delivered email must send **exactly once** per `shipment_id`/`order_id` key (as defined in email routing spec).
2. Optional status emails (picking/prepared) are OFF by default; toggling ON must still remain idempotent on retries.
