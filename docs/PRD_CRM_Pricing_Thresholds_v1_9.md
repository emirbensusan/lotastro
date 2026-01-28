# CRM PRD — Pricing Engine + Thresholds + Payments + FX (v1.9)

**Applies to:** CRM (Lovable app)  
**Depends on:** Integration Contract v1.0.17 (fulfillment + samples + payments + warehouse confirmation gate)
**Owner:** CRM is source of truth for pricing, credit, payment rules, FX rates  
**Non-goals:** Margin engine, automated invoicing, WMS cost-based pricing, ERP sync

---

## Multi-Company (Multi-Org) Requirements (LOCKED)

You have multiple legal entities (“organizations”) using the same CRM/WMS stack:

- Same employees (single login)
- Shared WMS catalog + shared physical stock
- Deals/POs/payments/credit/pricing must be strictly **separated per organization**

### Locked rules

1) **Grant-based access**
- Users can only see data for orgs they are explicitly granted.
- Grant is **per user + per org + per org role** (e.g., Sales in Org-A, Viewer in Org-B).

2) **Active Org + Multi-Org view (Hybrid)**
- Most users operate in **single-org mode** (Active Org).
- Multi-org roles (Sales Manager / Accounting / Pricing / Admin) can switch to **All Orgs** view; tables show an `Org` badge/column + filter.
- Active Org preference is stored per user.

3) **Global customer identity + per-org commercial profile**
- One global `customers` record (identity + contacts).
- Per org, `customer_org_profiles` stores: status (active/inactive), owner, payment mode, credit limits by currency, terms, and per-org billing/shipping overrides.

4) **No leakage**
- If a user is not granted Org-B, they must not be able to infer Org-B data exists (RLS hides it completely).
- Only multi-org users with grants can see “same customer, two org ledgers” breakdowns.

5) **Org-scoped ledgers**
All these are scoped by `organization_id`:
- list prices, customer prices
- FX rates
- credit limits/exposure/overdue snapshots
- payments ledger entries
- deals, deal lines, reservations, POs

6) **Warehouse roles**
- Warehouse roles should have grants to all orgs to avoid operational misses.
- Org labeling is minimized in WMS UI (small badge for managers; hidden for warehouse staff).

7) **Identifiers**
- Human codes are org-prefixed and **non-sequential** (e.g., `MODP8F3K2Q7A…`), and prefix is admin-editable (future-only).



## 0) Core principles (must hold)

1. **Ease of use:** Sales sees only sellable, priced items. Manager has a single command center.
2. **Human gating:** Any discount, currency exception, stale revalidation, credit override, payment confirmation requires explicit manager action.
3. **Auditability:** Every approval/override has who/when/why and is immutable.
4. **No flow break:** WMS does not calculate pricing, credit, or payments. PO creation remains triggered by CRM shipment approval (or WMS override already in contract).
5. **Stock-aware governance:** Prices are revalidated only for **in-stock** items.

---

## 1) Definitions

- **Quality**: catalog item (quality_code) synced from WMS.
- **List Price**: base price per quality (per currency) owned by CRM.
- **Customer Price**: customer+quality override (single currency by default; second currency allowed only via manager approval).
- **Quoted Price**: deal line final unit price (after discount) used to sell.
- **Snapshot**: immutable record of prices/totals at key gates (deal approved/won and PO shipment approval).
- **Staleness**: list/customer price last approved older than **X days** (default 180, configurable per quality). Staleness is enforced **only if in stock**.
- **Exposure**: multi-currency customer balance for credit control:
  - open POs (not fulfilled) + fulfilled-but-unpaid
  - reduced globally by payments ledger
- **Overdue**: any overdue amount is a **hard block** (after due_date + grace_days).

---

## 2) Users & permissions (minimum)

### Roles (examples)
- **sales_owner**
- **sales_manager**
- **pricing_role**
- **admin**
- **accounting** (optional later; currently manager confirms payments)

### Permission rules
- Sales can:
  - create inquiries/deals
  - request discount / currency exception
  - view own deals and customer summaries
- Sales Manager / Pricing / Admin can:
  - set list prices
  - set customer prices
  - approve discounts
  - approve currency exceptions
  - approve stale confirmations
  - confirm payments (bulk + single)
  - approve credit overrides
  - set FX rates
  - set grace days and limits

**Hard rule:** Sales **cannot** set final prices nor approve discounts/currency exceptions.

---

## 3) Data model (CRM tables)

> Naming can be adjusted to your existing schema, but fields/behavior must match.

### 3.1 Catalog mirror (from WMS)
**catalog_items**
- `quality_code` (PK)
- `quality_name` (optional)
- `is_active` boolean
- timestamps

### 3.2 List prices
**quality_list_prices**
- `id` uuid
- `organization_id` uuid
- `quality_code` text (FK catalog_items)
- `currency` text (TRY|USD|EUR)
- `list_unit_price` numeric
- `last_approved_at` timestamptz
- `last_approved_by` uuid
- timestamps

**Rule:** A quality becomes sellable when at least **one** list price exists (any currency).  
**Visibility:** If quality is in-stock and list price is stale => hidden from sales until reconfirmed.

### 3.3 Quality pricing policy
**quality_pricing_policy**
- `quality_code` text (FK catalog_items)
- `staleness_days` int default 180 (nullable → use default)
- `enforce_stale_when_in_stock` boolean default true

### 3.4 Customer price overrides
**customer_quality_prices**
- `id` uuid
- `organization_id`
- `customer_id`
- `quality_code`
- `currency` (TRY|USD|EUR)
- `unit_price`
- `last_approved_at`
- `last_approved_by`
- `is_active` boolean default true
- timestamps

**Rule:** One currency per customer+quality by default; second currency allowed only after manager approval (see approvals).

### 3.5 Deal lines (extend existing)
Ensure deal lines store:
- `quality_code`
- `currency`
- `meters`
- `list_unit_price` (copied at pricing time)
- `customer_unit_price` (copied at pricing time if exists)
- `discount_percent` (nullable)
- `final_unit_price` (quoted)
- `pricing_state` enum: `draft`, `pending_manager`, `approved`
- `pricing_approved_by`, `pricing_approved_at`

### 3.6 Deal and PO price snapshots (immutable)
**deal_price_snapshots**
- `id`
- `deal_id`
- `snapshot_type` (approved|won)
- `snapshot_json` (lines + totals + currency)
- `created_at`, `created_by`

**po_price_snapshots**
- `id`
- `crm_po_id` (from deal_orders.po_id)
- `deal_id`
- `snapshot_json`
- `created_at`, `created_by`

### 3.7 Pricing approvals / manager inbox
**pricing_approvals**
- `id`
- `organization_id`
- `approval_type`:
  - `discount_request`
  - `staleness_reconfirm`
  - `currency_exception_request`
  - `missing_list_price_set`
  - `customer_second_currency_exception`
- `scope_type`: `deal_line` | `deal` | `customer_quality` | `quality_list`
- `scope_id`
- `requested_by`, `requested_at`
- `status`: pending|approved|rejected
- `decided_by`, `decided_at`
- `decision_note`

### 3.8 Credit profiles
**customer_credit_profiles**
- `customer_id`
- `organization_id`
- `payment_mode` (cash|credit)
- `grace_days` int default 0 (manager-set)
- `credit_limit_try`, `credit_limit_usd`, `credit_limit_eur` numeric
- timestamps

### 3.9 Payments ledger
**payments**
- `id`
- `customer_id`, `organization_id`
- `paid_at` timestamptz
- `currency` (TRY|USD|EUR)
- `amount` numeric
- `receipt_no` text
- `note` text
- `optional_invoice_no` text (nullable)
- `entered_by` uuid
- timestamps

### 3.10 FX rate book (effective datetime)
**fx_rates**
- `id`
- `organization_id`
- `pair` (USDTRY|EURTRY)
- `rate` numeric
- `effective_from` timestamptz
- `effective_to` timestamptz nullable
- `set_by` uuid
- `set_at` timestamptz
- `note` text nullable

**Rule:** Payment conversion auto-picks the active rate by timestamp.

### 3.11 Credit blocking on deals / POs
Extend **deals**:
- `credit_blocked` boolean default false
- `credit_block_reason` text nullable
- `credit_override_by`, `credit_override_at`, `credit_override_note`

Extend **deal_orders** (PO umbrella in CRM):
- `po_id` (internal visible PO number; already in contract approach)
- `due_date` date
- `currency`
- `total_expected` numeric (from PO snapshot)
- `payment_required_before_ship` boolean
- `payment_confirmed_at`, `payment_confirmed_by` (sales manager)
- `payment_override_at`, `payment_override_by`, `payment_override_note`

---

## 4) Pricing engine behavior (deterministic)

### 4.1 Compute base price for a deal line
Given (customer_id, quality_code, currency):
1) If **customer_quality_prices** exists for exact match (and active) -> base = customer_unit_price
2) Else base = list_unit_price for quality+currency
3) If list_unit_price missing for that currency:
   - create `pricing_approvals` type `currency_exception_request`
   - block line pricing state = `pending_manager`
4) Copy list/customer price into deal line fields for audit.

### 4.2 Discounts
- Sales owner can submit a discount request (percent or final price).
- System creates `pricing_approvals` type `discount_request` referencing the line.
- Manager approves/rejects. On approve: set `discount_percent`, `final_unit_price`, `pricing_state=approved`.

### 4.3 Staleness enforcement
Default staleness_days = 180; override per quality via `quality_pricing_policy`.

Staleness applies to:
- List price record used
- Customer price record used (if exists)

Enforcement triggers:
- If quality is **in stock** and price last_approved_at older than staleness_days:
  - quality becomes hidden from sales (same as missing price)
  - manager must reconfirm via approvals queue
- Weekly, generate a **Stale Prices Review** queue:
  - only qualities with in_stock > 0
  - only those stale beyond staleness_days
  - manager can “Confirm unchanged” which updates last_approved_at/by

### 4.4 Manager approval context panel (must show)
For any approval on a line/quality:
- Last 5 sales for **this customer+quality**
- Last 5 sales for **any customer+quality**
Fields: date, list/customer/discount/final, currency, meters, PO id, deal link, approved_by.

---

## 5) Credit & payment gating behavior

### 5.1 Exposure calculation (per currency)
Exposure per currency includes:
- Open POs (not fulfilled) expected totals (from po snapshots)
- Fulfilled-but-unpaid totals (until payments reduce exposure)

Payments reduce exposure globally:
- Reduce exposure in payment currency directly
- If payment is TRY but exposure is USD/EUR, convert using the active FX rate at payment timestamp (auto-pick) and reduce target currency exposure accordingly (store conversion in audit note).

### 5.2 Overdue is hard block
Any overdue amount (>0) triggers hard block:
- Overdue = today > due_date + grace_days AND remaining exposure > 0

### 5.3 Deal.won credit block
At deal.won:
- If exposure exceeds limit in any currency OR overdue>0:
  - allow won
  - set `deal.credit_blocked=true`
  - block further fulfillment actions until manager override clears it

### 5.4 Payment gating per PO (deal_order)
- payment_mode=cash => `payment_required_before_ship=true` always
- payment_mode=credit:
  - payment required if customer is over limit OR overdue>0 (policy can be refined later)

**Confirm Payment**
- Only sales_manager can confirm (bulk allowed)
- payment confirmation is per PO (no deal-level unlock)

---

## 6) UX pages (simple, command-center style)

### 6.1 Pricing Command Center — `/pricing`
Tabs:
1) **Approvals Inbox**
   - Discount requests
   - Currency exception requests
   - Staleness reconfirm requests
   - Missing list prices
   - Customer second-currency exception requests
   Actions: approve/reject; open deal/line; view last-5 panels
2) **Missing Prices**
   - Qualities with no list prices at all
   - CTA: Set list price
3) **Stale Prices (In Stock)**
   - Weekly-generated queue (or live filtered view)
   - CTA: Confirm unchanged / update price
4) **Quality List Prices**
   - Search by quality; edit per currency; audit trail
5) **Customer Pricing**
   - Select customer; list priced qualities; add/update; bulk import
6) **Price History Search**
   - Search quality; show last deals across any customer

### 6.2 Credit Command Center — `/credit`
- Customers over limit (per currency)
- Customers overdue (any overdue hard block)
- Deals credit_blocked=true
Actions:
- manager override (requires note)
- adjust grace_days
- jump to payments

### 6.3 Payments Ledger — `/payments`
- Add payment
- Bulk import template (v1 basic columns)
- Show exposure changes summary

### 6.4 FX Rates — `/fx-rates`
- Set USDTRY / EURTRY
- show last 20 changes
- effective datetime management

### 6.5 Deal Detail — Pricing tab
- Line-level pricing breakdown
- Discount request button
- Pricing state badges
- “Blocked due to missing/stale price” banner (manager only)

### 6.6 Deal Detail — Credit tab (optional)
- credit_blocked indicator
- exposure summary
- overdue buckets

---

## 7) Acceptance criteria (must pass)

### Pricing governance
- Qualities with no list price are invisible to sales.
- In-stock qualities with stale price (older than policy) are invisible to sales until manager reconfirms.
- Weekly stale review queue includes only in-stock stale qualities.
- Any discount request creates a manager approval item.
- Deal line cannot move to approved pricing state without manager approval when discount/currency exception/stale applies.

### Credit gating
- deal.won sets credit_blocked when overdue>0 or over-limit.
- credit_blocked prevents shipment approvals / PO creation until manager override.
- overdue is hard block (any amount).

### Payment gating
- Cash customers: PO shipment approval blocked until payment confirmed (per PO) or override.
- Manager can bulk confirm payments.
- Payment pending does not create PO or send to WMS.


### Unified Shipment Approval Experience (LOCKED UX)

**Goal:** Sales Manager should not hop between pages. The same screen must show payment + credit context **and** allow the final “Approve Shipment” action that triggers PO creation in WMS.

What the screen must show (per PO candidate / reservation):
- Customer payment mode (cash | credit)
- Credit limits + exposure per currency + overdue per currency
- Payment required flag + payment status (pending/confirmed)
- Suggested next action:
  - cash → “Confirm Payment + Approve Shipment”
  - credit and clean → “Approve Shipment”
  - credit blocked / overdue / over-limit → “Override required” (requires reason)
- Quick links to: last 5 payments, last 5 sales prices used for the same customer+quality, and any active blockers (warehouse confirmation, shortage, ship date)

What the screen must do:
- Confirm Payment (single + bulk) — Sales Manager only
- Approve Shipment (single + bulk) — Sales Manager only
- Override (single) — Sales Manager only, with required reason + note

**Rule:** If payment is pending, PO must not be created in WMS (unless override is used).

### Audit
- All approvals/overrides have who/when/note.
- Price snapshots are immutable and used for exposure.

---

## 8) Bulk templates (v1)

### 8.1 Customer pricing import
Columns:
- customer_id (or customer code)
- quality_code
- currency
- unit_price
- note (optional)

### 8.2 Payments import
Columns:
- customer_id (or code)
- paid_at (datetime)
- currency
- amount
- receipt_no
- note
- optional_invoice_no

### 8.3 List price import (optional)
Columns:
- quality_code
- currency
- list_unit_price


## Catalog sync (pricing usability)
- Run nightly sync of WMS catalog (qualities) into CRM cache.
- Provide **"Sync Catalog Now"** button on `/pricing` (Sales Manager/Pricing/Admin only) for urgent updates.


---

## Addendum A — Multi-Org Granting (CRM) (LOCKED)

### A.1 Entities
- `orgs`: (`MOD`, `JTR`)
- `user_org_roles`: user ↔ org ↔ role mapping (per-org role)
- `customers` global identity
- `customer_org_profiles` org-scoped commercial profile (+ status active/inactive)

### A.2 Page behavior (no new pages)
- Header/filters support **Org Scope**:
  - Most users: single Active Org only
  - Sales Manager/Accounting/Pricing: can switch to **All Orgs** and group by org
- On all command centers, tables include an `org_code` column for multi-org roles only.
- Salespeople default to their primary org; deal creation requires explicit org (default to Active Org).

### A.3 Credit/Exposure (per org + currency)
- Exposure is computed per customer_org_profile and currency.
- Payments reduce exposure only inside the org they are logged under.
- Credit Center shows combined customer identity with breakdown by org/currency for multi-org roles.

## Addendum B — Deal Approval + Deal Command Center actions (CRM-only, LOCKED)

### B.1 Deal state machine
`draft → submitted → (approved | reworked | rejected)`

- Approve = deal fully approved; customer confirmation then allows `deal.won`.
- Rework returns to `draft` and requires manager notes + fields impacted.
- Reject ends that version; salesperson can clone to a new draft later.

### B.2 Pending edits
If salesperson edits qty/color/lines while pending approval:
- Auto revert to `draft`
- Log audit “changed after submit”
- Require resubmission

### B.3 Copy & related deals
- Copy copies lines + last approved prices (customer+quality), and stores `copied_from_deal_id`.
- Manual “related deal” linking supported (repeat order).

## Addendum C — UOM (meters/kg) readiness (LOCKED)

- Deal lines include `uom` + `qty`.
- Catalog includes `uom_mode` (`METERS_ONLY | KG_ONLY | BOTH`).
- No conversion logic in v1; KG qualities can be added later.

## Addendum D — Printing/design assets (CRM-only, LOCKED)

- Store designs in CRM bucket.
- Entities: `design_assets`, `print_requests` (linked to deal_line).
- Printing is tracked for contractor execution, not a WMS supply trigger in v1.

## Addendum E — Cash pack: Proforma + Contract Drafts (LOCKED)

- On `deal.won` (cash customers), CRM:
  - generates Proforma PDF (download + email)
  - generates Contract Draft PDF unless waived (download + email)
- Shipment approval is blocked until:
  - payment confirmed (per PO), AND
  - contract signed_received OR waived

Contract waiver is per customer+org and requires manager note + audit.


---

# Addendum (v1.9) — Org Grants, Order Form, Balance Gate, Abra Checks, Post-PO Rework, UOM & Designs, and Costing

**Effective date:** 2026-01-27  
This addendum extends v1.6. It does not introduce new required pages; it adds tabs/sections within existing command centers.

## 1. Multi-Org (2 legal entities) — Required Data Model

### 1.1 Tables
- `orgs` (seed: MOD, JTR)
- `user_org_grants`  
  `user_id, org_id, role_in_org, is_primary_org, granted_by, granted_at`
- `customers` (global identity)
- `customer_org_profiles` (per-org commercial)  
  includes: `status (active|inactive)`, `payment_mode`, `credit_limits_by_currency`, `account_owner_user_id`, `primary_org`, `contract_waived` (credit customers default), etc.

### 1.2 RLS / visibility rules (agent-proof)
- Users only see rows where `org_id` is in their grants.
- Global tables (customers, catalog GLOBAL rows) are visible by any granted org user.
- Inactive org profiles:
  - sales roles cannot see/create deals
  - manager/admin can view + activate

### 1.3 Org scope UX (no page redesign)
- Header selector: `Active Org` (single-org) or `All Orgs` (if multi-org role).
- Tables show an `org` column when scope = All Orgs.

### 1.4 Customer onboarding gate (LOCKED)

All new customers are created as `customers.review_status = pending_review` by default (cash or credit).

Before the **first order can be marked Won**, the system must require **either**:
- onboarding questions completed **and** `review_status = approved`, **or**
- Sales Manager/Admin override with required reason note (audited).

Default onboarding questions (editable in settings):
1) Company established year  
2) Monthly lining/pocketing order amount (numeric + UOM: MT/KG)  
3) Forecasted purchase amount from our company (numeric + UOM: MT/KG)

A bulk queue must exist (tab in `/credit` or Manager Inbox):
- Customers Pending Review
- Credit Requests Pending Approval

## 2. Identifiers
- Deal code: `ORG3 + "DL" + CODE8`
- PO code: `ORG3 + "P" + CODE8`
- Proforma code: `ORG3 + YYYY + "PI" + CODE8` (no separators)

## 3. Pricing, Credit, Payments — Org-scoped
All pricing, credit exposure, overdue, payments ledger are **org-scoped** and computed per org and currency.

### 3.1 Credit Center
- `/credit` includes tab: **Balances Grid**
  - paginated grid: customer × org × currency
  - multi-org users see both orgs even if zero
  - single-org users see only their org

## 4. Proforma + Balance Check Gate
### 4.1 New gate
Before proforma “Download / Send” is enabled:
- show Total Open, Overdue, Available Limit, Requested New amount
- require acknowledgement
- if overdue exists, proforma email must include warning line (editable draft)

### 4.2 Proforma state
- `proforma_status: drafted|sent|paid_confirmed`
- `paid_confirmed` requires payment ledger entry + manager payment confirmation

## 5. Abra Central Stock Check (WMS “no on-hand send-back” requirement) (LOCKED)

### 5.1 Goal
If WMS cannot fulfill from on-hand, the system must force an acknowledged Abra check and send a **structured** outcome back to CRM so Sales can respond consistently.

### 5.2 Where it is enforced (WMS)
In WMS, the action **“Send back (No On-Hand / Shortage)”** must hard-block unless an Abra check exists for each affected line.

This is intentionally **not** enforced on:
- deal submission
- deal won
- shipment approval

Only on the WMS no-on-hand send-back path.

### 5.3 Granularity
Per PO line (quality+color):

- `central_stock_check_lines` keyed by (`po_id`, `po_line_id`)

### 5.4 Required outcome fields
Each check line must store and sync:

- checked_at, checked_by
- result: `found_in_abra` | `not_in_abra` | `uncertain`
- available_qty (required if found_in_abra)
- proposed_next_step:
  - `import_from_central` (default ETA helper: 2–3 weeks)
  - `manufacture` (default ETA helper: 4–5 weeks)
  - `needs_central_confirmation` (uncertain)
- eta_text (optional free text)

### 5.5 Sync back to CRM
WMS emits `central_stock_check.completed/updated` → CRM renders on the related deal/fulfillment panel.

No automatic manufacturing/import creation is triggered; this is structured decision support + audit.

## 6.
## 6. Order Form (self-service) + Excel lines upload
### 6.1 Public route
- `/order-form/:token` (served by CRM app on a separate subdomain if desired)

### 6.2 Token rules
- one-time, expirable, regeneratable/unexpirable by internal users
- prefill if customer exists; supports new customers with `pending_review=true`

### 6.3 Submission
- creates Deal in `submitted_from_form=true`
- customer receives confirmation email (no internal deal id; uses public request reference)
- internal team receives same details

### 6.4 Edits after submission
- customer cannot edit
- internal edits allowed; resend confirmation email with:
  - “Before → After” table for changed fields (header + line level)

### 6.5 Attachments
- customer can upload files; stored in CRM bucket; internal-only; optional notes field.

### 6.6 Carrier preference
- “Use my carrier” toggle + optional fields; stored on deal header; WMS still captures final carrier.

### 6.7 Lab work (per line)
- status: requested → in_progress → sent_to_customer → approved/rejected
- sales can update; approval/rejection is manager-only.

### 6.8 Bulk lines
- up to 20 lines in UI
- Excel template download/upload for lines-only (Turkish headers; strict validation; success indicator).

## 7. Post-PO Discrepancy Loop (WMS → CRM)
### 7.1 Reasons
- insufficient meters, wrong lot, damaged roll, mismatch

### 7.2 Behavior
- WMS can raise issue any time after PO created
- blocks affected lines only
- CRM shows issue in fulfillment timeline + manager inbox
- resolution proposed by salesperson; manager approves
- customer email auto-drafted when qty/lot changes impact the promise

## 8. UOM (meters/kg) — readiness without breaking v1
### 8.1 Catalog
- quality supports UOM metadata:
  - `uom_primary = MT|KG`
  - `uom_allowed = MT_ONLY|KG_ONLY|BOTH`
- v1: no conversions required.

### 8.2 Deal lines
- require `uom` + `qty`
- WMS validates allowed UOM

## 9. Printed design ordering (CRM-only)
- designs stored in CRM bucket
- visible to sales + sales manager
- linked to deal lines; optionally shared via secure, expiring links with contractors (later)

## 10. Costing module (WMS + CRM)
### 10.1 WMS: supplier invoices + landed cost components
- store invoice header (org, supplier, currency, selected FX rate)
- store invoice lines tied to receipts/lots
- allow later adjustments (freight/duty corrections) with full audit

### 10.2 CRM: overhead + profitability reporting (later phase)
- store overhead pools per org
- profitability reporting can be introduced later; not a v1 gate

### 10.3 Inventory valuation v1A + v1B
- v1A: receipt basis per lot/roll stored
- v1B: WAC computed in TRY base, while preserving original currency and selected FX
---

## Addendum: Customer Order Status Emails (WMS milestones → CRM emails)

### Scope (LOCKED)
- **WMS does not email customers.** WMS only emits lifecycle events and carrier fields.
- **CRM sends customer-facing status emails** using org-specific templates + branding and customer contact data.
- Email sending is **configurable per org** and respects customer opt-out.

### Default Status Emails
- Picking started (default OFF)
- Prepared / packed (default OFF)
- Shipped (default ON)
- Delivered (default ON)
- Ship-date scheduled/updated (default OFF)

### Data Inputs
Triggered by WMS events / mirror updates:
- `po_number`, `deal_number`
- timestamps: `picking_started_at`, `prepared_at`, `shipped_at`, `delivered_at`
- carrier fields on shipped: `carrier_type`, `carrier_name`, `tracking_id`

### Hard Rules
- For shipped emails: include tracking fields if present.
- Idempotent sending (do not send duplicates if event is re-delivered).
- “From Name” + signature/footer must be driven by `org_id`.
