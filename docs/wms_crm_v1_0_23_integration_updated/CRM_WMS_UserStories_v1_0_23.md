# CRM ↔ WMS User Stories — v1.0.23 (Canonical)

**Date:** 2026-01-30  
**Contract authority:** `integration_contract_v1_0_23(1)(1).md` (LOCKED)  
**Rule:** No drift in event names, payload schemas, idempotency formats, or appendices referenced by Contract v1.0.23.

---

## Non‑negotiable principles (condensed)

- **[Contract]** The CRM↔WMS integration must follow locked Contract v1.0.23 as the single source of truth (no drift in schemas/field names).
- **[Idempotency]** Every inbound event and every outbound email must be idempotent with unique keys so retries never duplicate side effects.
- **[Org/RLS]** A user with only MOD access must not see or infer JTR data anywhere (lists, search, exports, totals, even “zero rows”).
- **[Org UX]** Multi-org managers can switch Org Scope (Active Org vs All) and see per-org exposure breakdowns where permitted.
- **[Org Data Model]** Deal creation requires explicit `org_id` (defaults to Active Org), preventing silent cross-org contamination.
- **[No-Spaghetti Acceptance]** No cross-org leakage, correct gating (central checks, proforma paid proof), and tokens cannot be reused.

---

## Numbered user stories (one sentence each)

1. As a CRM admin, I need org grants + RLS so a user with only MOD access cannot see or even infer JTR data exists. 
2. As a multi-org Sales Manager, I need an Org Scope toggle (Active Org vs All) so I can view exposure across orgs and currencies when permitted. 
3. As a CRM system, I need deal creation to require explicit org_id (defaulting to Active Org) to prevent mis-scoped deals. 
4. As CRM, I need customer identity global but commercial profile org-scoped via customer_org_profiles so billing/shipping can vary by org. 
5. As CRM, I must enforce customer_org_profiles.status so inactive customers are hidden from sales roles. 
6. As CRM, I need org-prefixed, non-sequential identifiers so deal/PO/proforma codes are not guessable. 
7. As CRM, I need a deal code generator using ORG3DL+CODE8 so every deal has a unique org-scoped code. 
8. As CRM, I need a proforma code generator using ORG3YYYYPI+CODE8 so proformas are uniquely traceable. 
9. As CRM, I need a /fulfillment command center so managers can run the end-to-end closure without bouncing between apps. 
10. As a Sales Manager, I need Human Gates tabs (Warehouse Confirmation/Payment Confirmation/Shipment Approval/Ship Date Required/Shortage Decisions) on /fulfillment. 
11. As CRM, I need /supply-tracking so supply milestones can be managed and visible operationally. 
12. As CRM, I need a /pricing command center with approval inbox + stale/missing prices so pricing governance is centralized. 
13. As CRM, I need a /payments ledger so payments can be recorded and reduce exposure (including bulk import). 
14. As CRM, I need /fx-rates to set USDTRY/EURTRY with effective datetime and audit history. 
15. As CRM, I need to store pricing/credit/payments org-scoped and per currency so exposure is computed correctly. 
16. As CRM, I need mirrors/caches (reservation_mirrors, order_mirrors, stock_by_quality_cache) so command centers don’t do N+1 calls. 
17. As a Sales Owner, I need to create deals and request approvals but must not be able to approve shipments/pricing myself. 
18. As a Sales Manager/Pricing/Admin, I need to approve pricing, confirm payments (bulk), approve shipments, clear credit blocks, and decide shortage outcomes. 
19. As warehouse staff, I need to handle physical picking/packing and lot/roll/meters confirmation in WMS (not CRM). 
20. As a WMS Manager, I need to override shipment gates with reason codes when operationally required. 
21. As CRM, I must enforce: warehouse never logs into CRM and sales never allocates rolls/lots in WMS. 
22. As CRM pricing governance, I need qualities with no list price to be invisible to sales to prevent random pricing. 
23. As CRM pricing governance, I need in-stock qualities with stale price to be invisible to sales until reconfirmed by manager. 
24. As a Sales Manager, I need a weekly stale review queue that includes only in-stock stale qualities. 
25. As a Sales Owner, I need a “discount request” action that always creates a manager approval item. 
26. As CRM, I must block a deal line from reaching “approved pricing” unless manager approval exists for discount/currency exception/stale cases. 
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
40. As CRM, I need a “Cash pack” behavior so on cash deal.won we generate Proforma + Contract Draft unless waived. 
41. As CRM, shipment approval must be blocked until payment confirmed AND contract signed_received (or waived) for cash deals. 
42. As CRM, before proforma download/send is enabled I need a Balance Check Gate showing Total Open/Overdue/Available Limit/Requested New and requiring acknowledgement. 
43. As CRM, if overdue exists then the proforma email draft must include an editable warning line (e.g., “settle outstanding X”). 
44. As CRM, proformas must have a lifecycle state drafted|sent|paid_confirmed. 
45. As CRM, paid_confirmed must require a payment ledger entry plus manager payment confirmation. 
46. As CRM, I need an Abra central stock check display on deal/fulfillment panel showing check results received from WMS. 
47. As WMS, I must hard-block “Send back (No On-Hand / Shortage)” unless an Abra check exists for each affected line. 
48. As WMS, this Abra enforcement must apply only on the “no-on-hand send-back” path (not on deal submission/won/shipment approval). 
49. As the Abra check line, I must store checked_at/by, result, available_qty (if found), proposed_next_step, and optional ETA text. 
50. As WMS, I must emit central_stock_check.completed/updated and CRM must render it on the related fulfillment panel. 
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
72. As QA/regression, I need idempotency so cross-system retries never create duplicate POs and every gate action/override is audited. 
73. As an org with cross-ownership (JTR stock sold to MOD), shipment approval must auto-create an internal JTR→MOD linked deal/order with suggested price copied. 
74. As JTR finance rules, MOD overdue/overlimit under JTR must block shipment approval unless manager override in the same approval screen. 
75. As costing, I need supplier invoice capture with selected FX (audited) and TRY computed value stored. 
76. As costing, I need receipts tied to invoice lines so each roll/lot has receipt-basis unit cost stored. 
77. As costing, I need WAC computed in TRY across multiple receipts and available to CRM via mirrors. 
78. As costing, I need post-receipt adjustments (duty/freight) that re-cost remaining stock, create audit entries, and update WAC. 
79. As costing reporting, I need inventory value split by owner org (e.g., JTR-owned vs MOD-owned) to be correct. 
80. As profitability reporting, I need reports to show original currency amounts plus TRY conversions used for valuation.

---

## Added to remove ambiguity (v1.0.23 alignment)

81. As CRM, I need to ingest `stock.changed` (idempotency `wms:stock:{transaction_batch_id}:changed:v1`) and update caches using scope keys so repeats never duplicate side effects.  
82. As CRM/WMS integration, I need strict 5-segment idempotency key validation so malformed keys are rejected before any state mutation.  
83. As CRM/WMS integration, I need out-of-order protection using monotonic sequence fields (where present) so older updates cannot regress state.
