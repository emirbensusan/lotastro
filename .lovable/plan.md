# Plan: Inquiry Gating Feature - Documentation & Phased Implementation

## Overview

This plan creates documentation for the Inquiry Gating feature and updates the roadmap with a phased, incremental implementation approach. The feature introduces mandatory "intent records" (Inquiries) required to view stock for most roles, with full audit traceability and the ability to convert inquiries to orders.

---

## Part 1: Create Inquiry Gating PRD Document

**New file:** `docs/PRD-INQUIRY-GATING.md`

A comprehensive Product Requirements Document containing:

### 1.1 Product Idea Summary
- Problem statement: Stock visibility without accountability
- Solution: Inquiry-gated stock access with full audit trail
- Value: Auditability, accountability, process discipline, conversion tracking
- Success metrics: 100% stock views attributable, inquiry-to-order conversion rate

### 1.2 Roles & Permission Philosophy
| Role | Stock Access | Requires Inquiry | Logged |
|------|-------------|------------------|--------|
| Senior Manager | Full (bypass) | No | Always |
| Sales Rep | Quality+Color summary | Yes | Always |
| Sales Manager | Quality+Color summary | Yes (can supervise) | Always |
| Warehouse Staff | Lot/Roll detail | Yes (unless stock take) | Always |
| Ops/Accounting | Full detail | Yes (unless stock take) | Always |
| Quality | Lot detail | Yes (unless QA task) | Always |
| Admin | Configure only | N/A | Always |

### 1.3 User Stories (8 Journeys)
- A) Senior Manager "view stock anytime"
- B) Sales Rep "customer question / quote check"
- C) Ops/Accounting "stock take mode"
- D) Ops/Accounting "convert inquiry to order"
- E) Warehouse Staff "picking precheck"
- F) Quality "issue investigation"
- G) Admin "configure gating"
- H) Audit Reviewer "trace what happened"

### 1.4 Acceptance Criteria (Gherkin Format)
- Inquiry creation rules
- Gating enforcement
- Stock Take mode
- Inquiry-to-Order conversion
- Logging requirements

### 1.5 Edge Cases & Abuse Prevention
- Unauthorized deep links
- Role changes mid-session
- Inquiry expiration
- Suspicious activity patterns

### 1.6 Non-Functional Requirements
- Backend enforcement (not UI-only)
- Performance targets
- Audit retention (7 years)
- Multi-tenancy support

### 1.7 V1 Definition of Done Checklist

---

## Part 2: Update Roadmap with Phased Implementation

**File:** `docs/ROADMAP.md`

Add new **Batch Q: Inquiry Gating** with 4 phases:

### Phase 1: Foundation (2 days, ~6-8 credits)
Database schema and basic CRUD - no UI gating yet

| Task | Priority | Description |
|------|----------|-------------|
| Create `inquiries` table | P0 | id, inquiry_number, reason, customer_name, salesperson_id, status, created_by, created_at |
| Create `inquiry_lines` table | P0 | inquiry_id, quality, color, requested_meters, scope |
| Create `inquiry_view_logs` table | P0 | inquiry_id, user_id, action, filters_used, timestamp |
| Inquiry number generator function | P0 | INQ-YYYYMMDD-XXX format, non-sequential |
| Basic RLS policies | P0 | Users see own + supervised inquiries |
| Inquiry status enum | P0 | draft, active, converted, expired, cancelled |

### Phase 2: Core Inquiry Flow (2 days, ~8-10 credits)
UI for creating and managing inquiries

| Task | Priority | Description |
|------|----------|-------------|
| InquiryDialog component | P0 | Create inquiry with reason, customer, lines |
| Inquiries list page | P0 | View/filter/search inquiries |
| Inquiry detail view | P1 | Show inquiry with lines, history |
| Stock Take Session mode | P1 | Time-bound bypass with reason logging |
| Inquiry reason enum | P1 | customer_quote, stock_check, management_review, stock_take, qa_investigation |

### Phase 3: Gating Enforcement (1.5 days, ~6-8 credits)
Actually enforce inquiry requirement

| Task | Priority | Description |
|------|----------|-------------|
| useInquiryGating hook | P0 | Check if user needs inquiry to view stock |
| Inventory page gating | P0 | Show "Create Inquiry" prompt if not bypassed |
| API-level enforcement | P0 | Edge functions check inquiry context |
| Manager bypass logging | P0 | Auto-log management_review for bypass users |
| View logging middleware | P1 | Log all stock views with inquiry_id |

### Phase 4: Order Integration (1 day, ~4-6 credits)
Convert inquiries to orders

| Task | Priority | Description |
|------|----------|-------------|
| Convert Inquiry to Order button | P0 | Create order from inquiry lines |
| Link inquiry_id on orders table | P0 | Add inquiry_id FK to orders |
| Inquiry status update on conversion | P0 | Mark as "converted" |
| Audit trail linkage | P1 | Show order in inquiry history |

---

## Part 3: Move Other Items Below the Line

Update "Below the Line" section to include all non-active work except:
- Batch Q: Inquiry Gating (NEW - ACTIVE)
- Batch F: CRM Integration (PENDING user completion)
- Batch I: OCR Pipeline (AFTER CRM)
- Batch P: AI Extraction (AFTER OCR)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `docs/PRD-INQUIRY-GATING.md` | Create (comprehensive PRD) |
| `docs/ROADMAP.md` | Update (add Batch Q with phases) |

---

## Validation Checklist

- [ ] PRD covers all 8 user journeys
- [ ] Acceptance criteria in Gherkin format
- [ ] Edge cases documented
- [ ] Roadmap has 4 clear phases
- [ ] Each phase is independently deployable
- [ ] Phase 1 has no UI dependencies (schema only)
- [ ] Phase 3 can be feature-flagged for gradual rollout

---

## Implementation Order

After documentation is complete:

1. **Start with Phase 1** (Foundation)
   - Create database tables
   - Create inquiry number generator
   - Set up RLS policies
   - No UI changes - backend only

2. **Then Phase 2** (Core Flow)
   - Build InquiryDialog
   - Build Inquiries page
   - Users can create/view inquiries
   - Still no gating enforcement

3. **Then Phase 3** (Enforcement)
   - Add gating hook
   - Wrap inventory views
   - Feature flag for gradual rollout

4. **Finally Phase 4** (Integration)
   - Order conversion
   - Full audit linkage

This incremental approach allows testing each phase before moving to the next, with rollback capability at each step.
