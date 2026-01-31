# CRM↔WMS User Journeys v1.0.23 — Aggregated Master

**Date:** 2026-01-30  
**Canonical contract reference (wording lock):** integration_contract_v1_0_23(1).md (LOCKED)  

## How to use this file
- This document aggregates **(A)** role-based journeys (owner-provided) and **(B)** the granular numbered journeys previously shared with the agent.
- Content is **not deleted**; duplicates may exist across sections on purpose.
- If you add new scope, append it in both sections to prevent drift.

## Drift locks (carry into every plan)
- Any mention of Contract v1.0.22 is a legacy typo; normalize wording everywhere to **v1.0.23**.
- Scope: UOM readiness, Design/Printing, Lab workflow, Carrier preference are **IN v1.0.23**.
- Email defaults (v1 rollout): **all customer-facing emails default OFF** per org; enable gradually via routing rules.
- Order-form attachments: **customer can view/download their own uploads only until submit; after submit, internal-only forever**.
- Authority: Post-PO Issues and Invoice Control are **WMS authoritative**; CRM mirrors + blocks CRM-side actions based on WMS status.

## Open-item check (explicitly decide to prevent drift)
- **Returns / return-flagging / return processing**: still not explicitly specified in the uploaded v1.0.23 doc set; if IN v1.0.23, add journeys + map to stories/batches.


---

# Role-based User Journeys (Provided by Owner) — v1.0.23

## 1) As an Admin

- As an Admin, I create orgs (MOD, JTR) so all commercial records are org-scoped under RLS and cannot leak across orgs.
- As an Admin, I create user↔org↔role grants so users can only view rows for granted orgs and cannot infer other orgs exist.
- As an Admin, I update org scope settings (Active Org / All Orgs) so multi-org users can switch scopes and see org columns only in “All Orgs”.
- As an Admin, I create and enforce RLS policies (SELECT/INSERT/UPDATE/DELETE split with WITH CHECK) so cross-org writes are impossible.
- As an Admin, I update grant expirations so access is time-boxed (expires_at enforced).
- As an Admin, I set the locked integration contract path (docs/integration_contract_v1.md) so both apps share a single source-of-truth.
- As an Admin, I update contract versions only via version bump + history entry, so contract changes are auditable.
- As an Admin, I copy the contract into both repos byte-for-byte so CRM and WMS cannot drift silently.
- As an Admin, I enforce idempotency key standards (source:entity:entity_id:action:v#) so retries never double-apply.
- As an Admin, I create webhook secrets and API keys so CRM↔WMS events are verified (HMAC) and secure.
- As an Admin, I create/update email templates per org + email type so all outbound comms are consistent and auditable.
- As an Admin, I enforce recipient resolution rules (poc_email → primary/billing contact → skip+log) so automation never “guesses” recipients.
- As an Admin, I configure fallback recipients so missing contacts never cause silent email failures.
- As an Admin, I delete deprecated email config tables/columns so only one system governs outbound emails.
- As an Admin, I create/update invoice mapping configuration so exports match ERP/accounting formats without code changes.

## 2) As a Salesperson (Sales Owner)

### Customer onboarding & governance
- As a Salesperson, I create a new customer and update onboarding answers so the customer can be reviewed/approved.
- As a Salesperson, I view the customer/org commercial profile (terms, mode, limits) before I attempt shipment approvals.
- As a Salesperson, I cannot mark a deal as WON unless the customer approval gate is satisfied (or manager override exists).

### Deal creation & pricing workflow
- As a Salesperson, I create a deal with a non-guessable deal code (ORG prefix + CODE8).
- As a Salesperson, I create/update deal lines (qty + UOM) with validation only (no conversion logic v1).
- As a Salesperson, if I update a deal after submit, the system auto-reverts it to draft and logs “changed after submit”.
- As a Salesperson, I create a copy of a deal (lines + last approved prices) and the system stores copied_from_deal_id for traceability.
- As a Salesperson, I link related deals to preserve commercial context for repeat orders.
- As a Salesperson, I request discounts/special terms via approvals instead of directly editing locked/compliant fields.

### From WON → reservation → fulfillment visibility
- As a Salesperson, I mark a deal WON and the system attempts auto-reservation so the order does not sit “won-without-reservation”.
- As a Salesperson, I view CRM /fulfillment as the command center showing derived stages (Needs Allocation Plan / Needs Roll Entry / Needs Ship Date).
- As a Salesperson, I initiate shipment approval knowing shipment approval is a universal human gate.
- As a Salesperson, I view shortage / exceptions coming from WMS as actionable items without editing WMS operational truth.
- As a Salesperson, I create customer-facing comms drafts for post-PO issues (qty change / lot swap) and store evidence in CRM.
- As a Salesperson, I create and send a public order form token so the customer can confirm lines/attachments without CRM login.
- As a Salesperson, I can trigger “send now” customer emails (if I have permission) for time-sensitive comms.

### Cash-pack (proforma + contract)
- As a Salesperson, on deal.won I trigger cash-pack generation so the system generates Proforma PDF and (unless waived) Contract Draft PDF.
- As a Salesperson, I send the proforma/contract through CRM (CRM owns outbound emails; WMS only provides data).

## 3) As a Sales Manager

### Governance overrides
- As a Sales Manager, I approve/override customer onboarding with a required reason note when speed is needed.
- As a Sales Manager, I approve/reject pricing exceptions via the Unified Approval Center.
- As a Sales Manager, I approve shipment approvals (single/bulk) when granted approvals:shipment:bulk_approve, with reason codes on overrides.
- As a Sales Manager, I confirm payments (single/bulk) using payments:confirm, because only my role can unlock payment gates.
- As a Sales Manager, I waive contract requirements per customer+org with a manager note and audit trail.
- As a Sales Manager, I approve/override post-PO resolutions when customer impact is high, and the decision is audit logged.

### Multi-org supervision
- As a Sales Manager with MOD+JTR, I view combined dashboards (/fulfillment, /credit, /pricing) in “All Orgs” scope with org column visible.
- As a Sales Manager, I enforce that Sales cannot infer other orgs exist when scoped to a single org (including via URL guessing).

## 4) As a Pricing User (Pricing / Finance)

- As Pricing, I view discount/threshold exceptions and approve/reject through the unified approval process.
- As Pricing/Finance, I view WAC values (TRY basis) mirrored from WMS costing events to inform margin checks and future pricing decisions.

## 5) As Warehouse Staff (WMS Operator)

### Operational dashboards & execution
- As Warehouse Staff, I view /po-command-center to work derived queues (planned → allocated → picking → shipped → delivered → invoiced).
- As Warehouse Staff, I update supply requests in /supply-requests (manufacturing/import milestones) including in_transit and arrived_soft.
- As Warehouse Staff, I update allocation planning in /allocation-planning to mark reservations as planned.
- As Warehouse Staff, I update allocations in /allocation-entry by entering lot/roll/meters and marking allocated.
- As Warehouse Staff, I update picking in /picking by PO number and mark picking complete.
- As Warehouse Staff, I update shipments in /shipments with carrier details, mark shipped, and later record delivery evidence (POD).
- As Warehouse Staff, I view /orders/:id to see full order detail + status history to resolve issues.

### Integration duties (events & traceability)
- As Warehouse Staff, I ensure allocations store crm_deal_line_id so line-level traceability is preserved end-to-end.
- As Warehouse Staff, I emit operational status changes (picking_started, shipment_posted, shipment_delivered, order_invoiced) so CRM mirrors remain accurate.
- As Warehouse Staff, I trigger shortage detection and expect it to appear in CRM as line-level exceptions (not blocking unrelated lines).
- As Warehouse Staff, I run central stock checks and expect results to sync back to CRM.

### Costing & invoice control
- As Warehouse Staff, I capture supplier invoices + FX selection at capture time to preserve costing audit trail.
- As Warehouse Staff, I mark orders invoiced which opens invoice control gating instead of allowing immediate closure.
- As Warehouse Staff, I export invoice-ready payloads after packing/shipping for accounting/ERP invoicing.

## 6) As a Warehouse Manager

- As a Warehouse Manager, I override ON-HAND validation with a reason code when exceptions are necessary, and audit logging captures it.
- As a Warehouse Manager, I enforce that post-PO issues block only impacted lines so operations can progress safely on unaffected lines.

## 7) As Accounting

- As Accounting, I view credit limits and overdue exposure by org/currency and ensure sales cannot bypass credit gates.
- As Accounting, I view costing mirrors (invoice posted, receipt linked, adjustments, WAC updates) for reporting visibility.
- As Accounting, I perform invoice control checks and update invoice_control.passed/failed to unblock or block fulfillment closure.

## 8) As a Customer

- As a Customer, I view the public order form via token without logging into CRM.
- As a Customer, I create a submission confirming line items and uploading attachments.
- As a Customer, once I submit, I cannot edit (evidence is locked for compliance) and sales follows the “resend with diff” process if changes are needed.

## 9) As the System (Automation + Integration)

- As the System, I emit/consume canonical events exactly per the locked contract so CRM and WMS remain consistent.
- As the System, I enforce idempotency so retries never duplicate PO creation, approvals, or emails.
- As the System, I mirror WMS events into CRM caches (stock cache, order/reservation mirrors) to power CRM command centers without changing WMS truth.
- As the System, I enforce payment/contract/invoice-control gates so shipment approval and fulfillment closure cannot bypass controls.
- As the System, I run scheduled jobs (digests, checks, queues) via Supabase scheduled edge functions.
- As the System, CRM owns outbound customer emails and WMS provides data only, ensuring one authoritative comms pipeline.

## 10) As QA/Owner (You)

- As QA, I seed role test users across MOD+JTR to validate RLS, permissions, and non-leakage.
- As QA, I execute test flows proving: no org leakage, correct IDs, correct gates (payment/contract/invoice-control), consistent events, idempotent retries.


---

# Granular Numbered Journeys (Canonical One-Sentence List) — v1.0.23

## Categorized journeys (one sentence each)


### Identity, Org Scope, RLS (Multi-Org Foundation)

1. As a CRM admin, I need org grants + RLS so a user with only MOD access cannot see or even infer JTR data exists.
2. As a multi-org Sales Manager, I need an Org Scope toggle (Active Org vs All) so I can view exposure across orgs and currencies when permitted.
3. As a CRM system, I need deal creation to require explicit org_id (defaulting to Active Org) to prevent mis-scoped deals.
4. As CRM, I need customer identity global but commercial profile org-scoped via customer_org_profiles so billing/shipping can vary by org.
5. As CRM, I must enforce customer_org_profiles.status so inactive customers are hidden from sales roles.
6. As CRM, I need org-prefixed, non-sequential identifiers so deal/PO/proforma codes are not guessable.
7. As CRM, I need a deal code generator using ORG3DL+CODE8 so every deal has a unique org-scoped code.
8. As CRM, I need a proforma code generator using ORG3YYYYPI+CODE8 so proformas are uniquely traceable.

### Core Command Centers & Ops Pages

9. As CRM, I need a /fulfillment command center so managers can run the end-to-end closure without bouncing between apps.
10. As a Sales Manager, I need Human Gates tabs (Warehouse Confirmation/Payment Confirmation/Shipment Approval/Ship Date Required/Shortage Decisions) on /fulfillment.
11. As CRM, I need /supply-tracking so supply milestones can be managed and visible operationally.
12. As CRM, I need a /pricing command center with approval inbox + stale/missing prices so pricing governance is centralized.
13. As CRM, I need a /payments ledger so payments can be recorded and reduce exposure (including bulk import).
14. As CRM, I need /fx-rates to set USDTRY/EURTRY with effective datetime and audit history.

### Data Model, Mirrors & Performance

15. As CRM, I need to store pricing/credit/payments org-scoped and per currency so exposure is computed correctly.
16. As CRM, I need mirrors/caches (reservation_mirrors, order_mirrors, stock_by_quality_cache) so command centers don’t do N+1 calls.

### Roles, Permissions, Segregation

17. As a Sales Owner, I need to create deals and request approvals but must not be able to approve shipments/pricing myself.
18. As a Sales Manager/Pricing/Admin, I need to approve pricing, confirm payments (bulk), approve shipments, clear credit blocks, and decide shortage outcomes.
19. As warehouse staff, I need to handle physical picking/packing and lot/roll/meters confirmation in WMS (not CRM).
20. As a WMS Manager, I need to override shipment gates with reason codes when operationally required.
21. As CRM, I must enforce: warehouse never logs into CRM and sales never allocates rolls/lots in WMS.

### Pricing Governance

22. As CRM pricing governance, I need qualities with no list price to be invisible to sales to prevent random pricing.
23. As CRM pricing governance, I need in-stock qualities with stale price to be invisible to sales until reconfirmed by manager.
24. As a Sales Manager, I need a weekly stale review queue that includes only in-stock stale qualities.
25. As a Sales Owner, I need a “discount request” action that always creates a manager approval item.
26. As CRM, I must block a deal line from reaching “approved pricing” unless manager approval exists for discount/currency exception/stale cases.

### Credit, Overdue, Exposure & Gates

27. As CRM, I need /credit to list customers over limit and customers overdue, and show deals with credit_blocked=true.
28. As CRM, I need overdue to be a hard block when overdue amount is > 0 (policy based on due_date + grace_days).
29. As CRM, on deal.won I must set credit_blocked=true when overdue>0 or any currency is over-limit.
30. As CRM, I must prevent shipment approvals/PO creation while credit_blocked=true unless manager override clears it.
31. As CRM, for cash customers I must always require payment confirmation before shipment approval per PO.
32. As CRM, for credit customers I must require payment before ship when customer is over-limit or overdue (v1 rule).
33. As CRM, only Sales Manager can confirm payment and this confirmation must be per PO (not deal-level unlock).
34. As CRM, payment pending must block PO creation and must not send anything to WMS unless override is used.
35. As CRM, I need a unified shipment approval screen that shows payment + credit context and enables the final “Approve Shipment” action.
36. As the unified shipment approval screen, I must display payment mode, credit limits/exposure/overdue, payment status, and suggested next action.
37. As the unified shipment approval screen, I must support confirm payment (single/bulk), approve shipment (single/bulk), and override with reason (single).
38. As CRM, I must log every approval/override with who/when/note and store immutable price snapshots used for exposure.
39. As CRM, I need bulk templates for customer pricing import and payments import with defined columns.

### Proforma, Contract, Cash Pack

40. As CRM, I need a “Cash pack” behavior so on cash deal.won we generate Proforma + Contract Draft unless waived.
41. As CRM, shipment approval must be blocked until payment confirmed AND contract signed_received (or waived) for cash deals.
42. As CRM, before proforma download/send is enabled I need a Balance Check Gate showing Total Open/Overdue/Available Limit/Requested New and requiring acknowledgement.
43. As CRM, if overdue exists then the proforma email draft must include an editable warning line (e.g., “settle outstanding X”).
44. As CRM, proformas must have a lifecycle state drafted|sent|paid_confirmed.
45. As CRM, paid_confirmed must require a payment ledger entry plus manager payment confirmation.

### Abra Central Stock Check

46. As CRM, I need an Abra central stock check display on deal/fulfillment panel showing check results received from WMS.
47. As WMS, I must hard-block “Send back (No On-Hand / Shortage)” unless an Abra check exists for each affected line.
48. As WMS, this Abra enforcement must apply only on the “no-on-hand send-back” path (not on deal submission/won/shipment approval).
49. As the Abra check line, I must store checked_at/by, result, available_qty (if found), proposed_next_step, and optional ETA text.
50. As WMS, I must emit central_stock_check.completed/updated and CRM must render it on the related fulfillment panel.

### Order Form

51. As CRM, I need an Order Form public route /order-form/:token so customers can submit requests self-service.
52. As CRM, order-form tokens must be one-time, expirable, regeneratable, and optionally unexpirable.
53. As CRM, order form submission must create a deal with submitted_from_form=true.
54. As CRM, the order form must support new customers with pending_review=true when customer doesn’t already exist.
55. As CRM, once the customer submits the order form, the customer must not be able to edit the submission further.
56. As CRM, when internal edits are made after submission, I need a “resend” flow that sends the customer a diff table of changes.
57. As the order form UI, I need to allow up to 20 line items and also support an Excel “lines-only” upload with strict validation and a success indicator.
58. As CRM, order form must allow attachments upload (internal-only) with attachment notes.
59. As CRM, on order form submission I must send a customer confirmation email (without exposing internal deal ID) and notify internal team.
60. As CRM, I need a bulk queue for Customers Pending Review and Credit Requests Pending Approval (manager inbox or /credit tab).

### Email System & Notifications

61. As CRM, I need email routing rules so customer emails send only when enabled per email type and policy allows it.
62. As CRM, I must never auto-email customers for tracking changes, and “prepared” customer emails must be OFF in v1.
63. As CRM, I need customer status emails for shipped and delivered that send exactly once and log to the deal timeline.
64. As CRM, shipped email must include org branding, po_number, and tracking_id (from carrier fields).
65. As CRM, I must enforce opt-out so customers who disabled status emails do not receive shipped/delivered emails.
66. As CRM, optional status emails (picking_started/prepared) must be OFF by default unless org config enables them.
67. As CRM, I need per-org recipient configuration per email type, and those emails must be logged/audited.
68. As CRM, I need weekly digest variants that separate org data and include manufacturing/import/central-check/shortage items as defined.
69. As CRM, I need internal digest emails (pending approvals, stale prices weekly, central stock check digest) with routing-rule recipients and org-admin fallback.
70. As CRM, I need internal ops emails (override_used, shipment_approval_needed, new_customer_pending_review, supply_request_created, eta_near, soft_arrival_confirmed, credit_request_submitted).
71. As CRM/WMS ops, I need a “Cost Control Daily Pack” email sent by a scheduled Edge Function including delivered orders and attached docs (irsaliye/invoice reference/etc.).

### Reliability, Idempotency, Regression

72. As QA/regression, I need idempotency so cross-system retries never create duplicate POs and every gate action/override is audited.

### Cross-Ownership

73. As an org with cross-ownership (JTR stock sold to MOD), shipment approval must auto-create an internal JTR→MOD linked deal/order with suggested price copied.
74. As JTR finance rules, MOD overdue/overlimit under JTR must block shipment approval unless manager override in the same approval screen.

### Costing & Profitability Reporting

75. As costing, I need supplier invoice capture with selected FX (audited) and TRY computed value stored.
76. As costing, I need receipts tied to invoice lines so each roll/lot has receipt-basis unit cost stored.
77. As costing, I need WAC computed in TRY across multiple receipts and available to CRM via mirrors.
78. As costing, I need post-receipt adjustments (duty/freight) that re-cost remaining stock, create audit entries, and update WAC.
79. As costing reporting, I need inventory value split by owner org (e.g., JTR-owned vs MOD-owned) to be correct.
80. As profitability reporting, I need reports to show original currency amounts plus TRY conversions used for valuation.

### Additional v1.0.23 journeys (present in doc set; must be mapped into the implementation plan before build)

81. • [UOM Readiness] Catalog items must declare allowed UOM mode, deal lines must store uom+qty, and WMS must enforce allowed UOM with no conversion logic in v1.
82. • [Design/Printing] CRM must support design_assets and print_requests linked to deal_line, with files stored in CRM bucket.
83. • [Lab Workflow] Each deal line can have lab workflow states (requested → in_progress → sent_to_customer → approved/rejected) with manager-only approve/reject.
84. • [Carrier Preference] CRM must allow “Use my carrier” plus optional carrier fields and prefill WMS carrier capture where relevant.
85. • [Post-PO Issues Visibility] CRM must display WMS-raised post-PO discrepancy issues in the CRM timeline and fulfillment panel.
86. • [Line-Level Blocking] Post-PO discrepancies must block only affected lines in fulfillment view while allowing other lines to proceed.
87. • [Auto-Draft Customer Email] For qty/lot changes, the system must auto-draft the customer email and require manager approval to proceed.
88. • [Cost Mirrors Receive] CRM must receive costing mirrors from WMS (supplier invoices + landed cost components) for reporting (not gating profitability in v1).
89. • [Overhead Pools] CRM must store overhead pools per org to support later profitability reporting without blocking operational flows.
90. • [WMS Invoice Status] WMS must track invoice_status (not_issued/issued) and store/upload invoice export payloads per order.
91. • [WMS Invoice Control Gate] WMS must implement invoice_control_status (pending_control/passed/failed) and block fulfillment closure unless it is passed.
92. • [Invoice Control Queue] WMS must provide a bulk invoice control queue with pagination and Excel export, and failures must require notes.
93. • [WMS Post-PO Flagging] WMS must allow issues to be flagged on PO lines at any time after PO creation and sync those issues to CRM.
94. • [Customer Status Emails Ownership] Customer-facing shipment status emails must be CRM-owned and triggered by WMS lifecycle events (WMS must not email customers).
95. • [Unified Email System] CRM must use a unified email system with templates per org per email type and scheduled edge functions for digests/automation.
96. • [Permissions] Sensitive actions must be permission-gated (e.g., deals.close, postpo.*, email.send_now) and not runnable by roles lacking explicit grants.
97. • [Scheduling] Automations (digests/queues) must run via Supabase scheduled edge functions with controlled defaults and safe retry behaviors.
98. • [“Defaults OFF” Principle] Customer-facing email routing/notifications should be conservative by default (avoid surprise emails) and turn on only what’s explicitly intended.
99. • [No-Spaghetti Acceptance] The system must pass “no spaghetti” acceptance tests: no cross-org leakage, correct gating (stock check completion, proforma paid confirm proof), and one-time tokens that cannot be reused.

## Open item check (potential drift)

- **Returns / return-flagging / return processing**: I did not find an explicit requirement in the current v1.0.23 docs you uploaded; if returns are in v1, we should add a short requirement section + map it to an existing story/batch (or explicitly tag POST-v1).