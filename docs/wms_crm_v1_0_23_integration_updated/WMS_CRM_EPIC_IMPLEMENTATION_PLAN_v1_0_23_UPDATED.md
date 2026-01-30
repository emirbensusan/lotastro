# CRM-WMS Integration + Pricing Engine EPIC Implementation Plan

> **Contract Version:** v1.0.22 (FINAL LOCKED)  
> **PRD Version:** v1.9  
> **QA Test Plan:** v1.0.21  
> **Last Updated:** 2026-01-27  
> **Total Estimated Sessions:** 35-45 sessions (17 batches)  
> **Status:** READY FOR IMPLEMENTATION

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Final Patches Applied](#2-final-patches-applied)
3. [Unified Email System](#3-unified-email-system)
4. [Recipient Resolution Rules](#4-recipient-resolution-rules)
5. [Scheduling Mechanism](#5-scheduling-mechanism)
6. [Complete Schema Definitions](#6-complete-schema-definitions)
7. [Complete Permission List](#7-complete-permission-list)
8. [Email Types Catalog](#8-email-types-catalog)
9. [LM-1: Cost Control Daily Pack](#9-lm-1-cost-control-daily-pack)
10. [LM-2: Fulfillment Closure State](#10-lm-2-fulfillment-closure-state)
11. [LM-3: Post-PO Approval Evidence](#11-lm-3-post-po-approval-evidence)
12. [Phase A: Foundation (Batches 1-3)](#12-phase-a-foundation-batches-1-3)
13. [Phase B: Fulfillment Infrastructure (Batches 4-7)](#13-phase-b-fulfillment-infrastructure-batches-4-7)
14. [Phase C: Command Centers (Batches 8-11)](#14-phase-c-command-centers-batches-8-11)
15. [Phase D: Order Form & Advanced (Batches 12-14)](#15-phase-d-order-form--advanced-batches-12-14)
16. [Phase E: Notifications & Control (Batches 15-16)](#16-phase-e-notifications--control-batches-15-16)
17. [Phase F: Wrap-up (Batch 17)](#17-phase-f-wrap-up-batch-17)
18. [Hard Rules Summary](#18-hard-rules-summary)
19. [Session Estimates](#19-session-estimates)
20. [Prerequisites](#20-prerequisites)
21. [Tables to Remove](#21-tables-to-remove)
22. [Lock Statement](#22-lock-statement)

---

## 1. Executive Summary

This document is the **single source of truth** for the CRM-WMS Integration and Pricing Engine implementation. It consolidates all decisions, schema definitions, and implementation details into a granular, session-by-session plan.

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Batches | 17 |
| Total Sessions | 35-45 |
| CRM → WMS Events | 11 |
| WMS → CRM Events | 22 |
| Email Types (V1) | 15 |
| New Tables | 25+ |
| New Permissions | 45+ |

### Guiding Principles

1. **No Spaghetti** — Every decision is documented and locked
2. **Idempotency First** — All emails and events have unique keys
3. **Unified Models** — Single source of truth for email, permissions, approvals
4. **Defaults OFF** — All customer emails and routing rules disabled by default
5. **Manual Triggers** — Deal closure and sensitive actions require explicit user action

---

## 2. Final Patches Applied

| Patch # | Description | Applied Change |
|---------|-------------|----------------|
| 1 | Customer recipient resolution | Defined order: `customers.poc_email` → primary/billing contact → skip+log |
| 2 | invoice_attachment_path | Added to `order_mirrors` schema |
| 3 | Org admin fallback | Defined roles: `admin`, `super_admin` with email != null |
| 4 | Email idempotency | Added `idempotency_key` to `email_send_logs` with uniqueness rule |
| 5 | Scheduling mechanism | Supabase Scheduled Edge Functions (fallback `pg_cron`) |
| 6 | Missing permissions | Added `deals.close`, `postpo.*`, `email.send_now` |
| 7 | Email templates | Each `email_type` requires template record per org |
| A | Naming consistency | Standardized on `customers.poc_email` (existing schema field) |
| B | Contacts role enum | Defined allowed values: `billing`, `shipping`, `sales`, `other` |

---

## 3. Unified Email System

### 3.1 Core Principle: 3 Audiences, 1 Config Model

| Audience | Description | Examples |
|----------|-------------|----------|
| `customer` | External emails to customer contacts | `customer_shipped`, `customer_delivered_docs_digest`, `order_form_confirmation`, `order_form_changes` |
| `internal_digest` | Scheduled batch emails to internal roles/users | `stale_prices_weekly_digest`, `pending_approvals_digest`, `central_stock_check_digest` |
| `internal_ops` | Operational emails to fixed mailboxes | `cost_control_daily_pack`, `override_used`, `shipment_approval_needed`, `new_customer_pending_review` |

**RULE:** Customer digests (e.g., `delivered_docs_digest`) are `customer` audience sent in batch, NOT `internal_digest`.

### 3.2 Table: `email_routing_rules`

```sql
CREATE TABLE email_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  email_type TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('customer','internal_digest','internal_ops')),
  
  enabled BOOLEAN NOT NULL DEFAULT FALSE,          -- phased rollout default OFF
  delivery_mode TEXT NOT NULL DEFAULT 'manual'     -- default manual to prevent spam
    CHECK (delivery_mode IN ('manual','immediate','scheduled_batch')),
  
  -- recipients (used for internal_digest + internal_ops)
  to_roles JSONB NOT NULL DEFAULT '[]',   -- e.g. ["sales_manager","wms_ops"]
  to_users JSONB NOT NULL DEFAULT '[]',   -- array of user_ids
  to_emails JSONB NOT NULL DEFAULT '[]',  -- e.g. ["ceo@x.com","ops@x.com"]
  cc_emails JSONB NOT NULL DEFAULT '[]',
  bcc_emails JSONB NOT NULL DEFAULT '[]',
  
  -- schedule (only for internal_digest or customer batch)
  cron TEXT,  -- e.g. "0 9 * * *"
  
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, email_type)
);

-- RLS
ALTER TABLE email_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation" ON email_routing_rules
  FOR ALL USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

### 3.3 Table: `customer_email_policy`

```sql
CREATE TABLE customer_email_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  mode TEXT NOT NULL DEFAULT 'off'
    CHECK (mode IN ('off','enabled')),
  
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(customer_id, organization_id)
);

-- RLS
ALTER TABLE customer_email_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation" ON customer_email_policy
  FOR ALL USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

**RULE:** This is the ONE AND ONLY customer email toggle. No separate optout table, no `status_emails_enabled` boolean.

### 3.4 Table: `email_send_logs`

```sql
CREATE TABLE email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  
  email_type TEXT NOT NULL,
  audience TEXT NOT NULL,
  
  -- Idempotency (PATCH #4)
  idempotency_key TEXT NOT NULL,
  
  -- Context
  triggered_by UUID,  -- user who triggered (NULL for scheduled)
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled','manual','automatic')),
  entity_type TEXT,   -- 'deal', 'order', 'customer', etc.
  entity_id UUID,
  
  -- Recipients
  to_addresses JSONB NOT NULL,
  cc_addresses JSONB DEFAULT '[]',
  bcc_addresses JSONB DEFAULT '[]',
  
  -- Result
  status TEXT NOT NULL CHECK (status IN ('sent','failed','skipped')),
  failure_reason TEXT,
  
  sent_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uniqueness per org + idempotency key
  UNIQUE(organization_id, idempotency_key)
);

-- RLS
ALTER TABLE email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation" ON email_send_logs
  FOR ALL USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

**Idempotency Key Format:** `{org_id}:{email_type}:{entity_id}:{date_or_index}`

**Examples:**
- Customer delivered docs digest: `{org_id}:customer_delivered_docs_digest:{order_id}:{delivered_date}`
- Cost control pack: `{org_id}:cost_control_daily_pack:{YYYY-MM-DD}:{batch_index}`
- Order form confirmation: `{org_id}:order_form_confirmation:{deal_id}:{submission_id}`

### 3.5 Table: `email_templates`

```sql
CREATE TABLE email_templates_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  email_type TEXT NOT NULL,
  
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  is_system_default BOOLEAN DEFAULT FALSE,
  
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, email_type)
);

-- RLS
ALTER TABLE email_templates_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation" ON email_templates_v2
  FOR ALL USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

**RULE:** Each `email_type` MUST have a template record per org. System provides defaults; admins can edit later.

---

## 4. Recipient Resolution Rules

### 4.1 Customer Recipient Resolution (PATCH #1 + Micro-edit A)

**Resolution Order (first match wins):**

1. `customers.poc_email` (primary email on customer record)
2. `contacts` table where `(is_primary = TRUE OR role = 'billing') AND email IS NOT NULL` for that customer
3. If none found → `email_send_logs.status = 'skipped'` with `failure_reason = 'NO_CUSTOMER_EMAIL'`

```sql
-- Function to resolve customer email
CREATE OR REPLACE FUNCTION resolve_customer_email(p_customer_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- 1. Check customers.poc_email
  SELECT poc_email INTO v_email 
  FROM customers 
  WHERE id = p_customer_id AND poc_email IS NOT NULL;
  
  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;
  
  -- 2. Check contacts (primary or billing role)
  SELECT email INTO v_email
  FROM contacts
  WHERE customer_id = p_customer_id 
    AND email IS NOT NULL
    AND (is_primary = TRUE OR role = 'billing')
  ORDER BY is_primary DESC
  LIMIT 1;
  
  RETURN v_email;  -- NULL if not found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.2 Contacts Role Enum (Micro-edit B)

**Allowed values for `contacts.role`:**
- `billing` — Primary contact for invoices and payment-related communications
- `shipping` — Contact for delivery and logistics
- `sales` — Commercial/purchasing contact
- `other` — General contact

```sql
-- Add role column with check constraint
ALTER TABLE contacts ADD COLUMN role TEXT 
  CHECK (role IN ('billing', 'shipping', 'sales', 'other'));
```

### 4.3 Org Admin Fallback (PATCH #3)

**Fallback Recipient Set:**

```sql
-- Users with admin/super_admin role in the org AND valid email
SELECT u.id, u.email
FROM users u
JOIN user_org_roles uor ON u.id = uor.user_id
WHERE uor.organization_id = p_org_id
  AND uor.org_role IN ('admin', 'super_admin')
  AND u.email IS NOT NULL;
```

**If no admins found:** `email_send_logs.status = 'skipped'` with `failure_reason = 'NO_INTERNAL_RECIPIENTS'`

---

## 5. Scheduling Mechanism

### 5.1 V1 Standard (PATCH #5)

**Primary:** Supabase Scheduled Edge Functions

**Fallback:** `pg_cron` (if Scheduled Edge Functions unavailable)

**No third-party schedulers in V1.**

### 5.2 Implementation

Each scheduled email type has a dedicated Edge Function:
- Schedule configured in `supabase/config.toml` or via Dashboard
- Function reads `email_routing_rules.cron` for timing validation
- All scheduled functions use idempotency keys to prevent duplicates

### 5.3 Scheduled Functions List

| Function Name | Email Type | Default Schedule |
|---------------|------------|------------------|
| `email-customer-delivered-docs` | `customer_delivered_docs_digest` | `0 9 * * *` (9am daily) |
| `email-cost-control-pack` | `cost_control_daily_pack` | `0 18 * * 1-5` (6pm weekdays) |
| `email-pending-approvals` | `pending_approvals_digest` | `0 8 * * 1-5` (8am weekdays) |
| `email-stale-prices` | `stale_prices_weekly_digest` | `0 8 * * 1` (8am Mondays) |
| `email-central-stock-check` | `central_stock_check_digest` | `0 17 * * 1-5` (5pm weekdays) |
| `email-eta-near` | `eta_near` | `0 9 * * *` (9am daily) |

---

## 6. Complete Schema Definitions

### 6.0 RLS Pattern for Multi-Org (CRITICAL)

> **RULE:** Before implementing RLS, read this entire section.

#### 6.0.1 Security Definer Function

```sql
CREATE OR REPLACE FUNCTION public.user_has_org_access(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_org_roles
    WHERE user_id = p_user_id 
      AND organization_id = p_org_id 
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;
```

#### 6.0.2 Org Column Name Rule

**Use `public.user_has_org_access(auth.uid(), <org_column>)` where `<org_column>` is the table's actual org column name. Always verify before copy/paste.**

| Column Name | Tables Using It |
|-------------|-----------------|
| `organization_id` | Most tables: `customers`, `contacts`, `deals`, `deal_lines`, `activities`, `user_org_roles`, etc. |
| `org_id` | `order_mirrors`, `reservation_mirrors` (WMS mirror tables) |

#### 6.0.3 RLS Policy Template (DIRECT ORG-SCOPED)

For tables that have an org column (`organization_id` or `org_id`):

```sql
-- SELECT: USING only
CREATE POLICY "<table>_select_org" ON public.<table>
  FOR SELECT TO authenticated
  USING (public.user_has_org_access(auth.uid(), <org_column>));

-- INSERT: WITH CHECK only
CREATE POLICY "<table>_insert_org" ON public.<table>
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_org_access(auth.uid(), <org_column>));

-- UPDATE: USING + WITH CHECK (both required)
CREATE POLICY "<table>_update_org" ON public.<table>
  FOR UPDATE TO authenticated
  USING (public.user_has_org_access(auth.uid(), <org_column>))
  WITH CHECK (public.user_has_org_access(auth.uid(), <org_column>));

-- DELETE: USING only
CREATE POLICY "<table>_delete_org" ON public.<table>
  FOR DELETE TO authenticated
  USING (public.user_has_org_access(auth.uid(), <org_column>));
```

#### 6.0.4 Special Case: `organizations` Table

The `organizations` table uses `id` (primary key), not `organization_id`:

```sql
-- Special: organizations table uses 'id' (PK) not 'organization_id'
CREATE POLICY "organizations_select_org" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND public.user_has_org_access(auth.uid(), id)
  );

-- INSERT/UPDATE/DELETE for organizations typically restricted to super_admin
-- and managed via separate admin policies
```

#### 6.0.5 RLS Policy Template (JOIN-ACCESSED)

For tables that lack an org column and access org via parent FK:

```sql
-- Example: help_ticket_comments → help_tickets.organization_id
CREATE POLICY "help_ticket_comments_select_org" ON public.help_ticket_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.help_tickets ht
    WHERE ht.id = help_ticket_comments.ticket_id
    AND public.user_has_org_access(auth.uid(), ht.organization_id)
  ));

-- INSERT/UPDATE/DELETE follow same pattern with WITH CHECK where needed
```

#### 6.0.6 Table Categories

**DIRECT ORG-SCOPED (have org column, use template 6.0.3):**
- `customers` (organization_id)
- `contacts` (organization_id)
- `deals`, `deal_lines`, `deal_orders` (organization_id)
- `activities`, `supply_requests` (organization_id)
- `order_mirrors`, `reservation_mirrors` (**org_id** — note different column name!)
- `email_routing_rules`, `customer_email_policy`, `email_send_logs`, `email_templates_v2` (organization_id)
- `quality_list_prices`, `customer_quality_prices`, `pricing_approvals` (organization_id)
- `payments`, `fx_rates` (organization_id)
- `proformas`, `contracts`, `certificates` (organization_id)
- `post_po_issues`, `help_tickets` (organization_id)
- `order_form_tokens`, `order_form_submissions` (organization_id)
- `customer_org_profiles` (organization_id)
- `user_org_roles` (organization_id — special: users can see their own grants)
- All other tables with `organization_id` or `org_id` column

**JOIN-ACCESSED (no org column, use template 6.0.5):**
- `help_ticket_comments` → via `ticket_id` → `help_tickets.organization_id`
- Any future tables without direct org column (document parent FK path)

---

### 6.1 Table: `order_mirrors` (PATCH #2 Applied)

```sql
CREATE TABLE order_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  wms_order_id UUID NOT NULL UNIQUE,
  crm_deal_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL,
  order_type TEXT DEFAULT 'full',
  carrier_type TEXT,
  carrier_name TEXT,
  tracking_id TEXT,
  picking_started_at TIMESTAMPTZ,
  prepared_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  
  -- Invoice control
  invoice_control_status TEXT CHECK (invoice_control_status IN ('pending_control','passed','failed')),
  invoice_control_by UUID,
  invoice_control_at TIMESTAMPTZ,
  invoice_control_note TEXT,
  
  -- Attachments (PATCH #2: invoice_attachment_path added)
  awb_attachment_path TEXT,
  irsaliye_attachment_path TEXT,
  invoice_attachment_path TEXT,
  
  -- Delivered docs digest tracking
  delivered_docs_sent_at TIMESTAMPTZ,
  delivered_docs_sent_by UUID,
  
  last_event_name TEXT,
  last_event_at TIMESTAMPTZ,
  payload JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_order_mirrors_deal ON order_mirrors(crm_deal_id);
CREATE INDEX idx_order_mirrors_status ON order_mirrors(status);
CREATE INDEX idx_order_mirrors_invoice_control ON order_mirrors(invoice_control_status);
```

### 6.2 Table: `organizations` Extensions

```sql
ALTER TABLE organizations ADD COLUMN eta_standard_messages JSONB DEFAULT '{
  "3_days": "ETA in 3 days",
  "1_week": "ETA in 1 week",
  "2_weeks": "ETA in 2 weeks",
  "unknown": "ETA to be confirmed"
}';

ALTER TABLE organizations ADD COLUMN cost_control_settings JSONB DEFAULT '{
  "max_orders_per_email": 7,
  "send_time_cron": "0 18 * * 1-5"
}';
```

### 6.3 Table: `deals` Extensions

```sql
ALTER TABLE deals ADD COLUMN deal_code TEXT;
ALTER TABLE deals ADD COLUMN fulfillment_status TEXT DEFAULT 'pending'
  CHECK (fulfillment_status IN ('pending','reserved','picking','shipped','delivered','cancelled'));
ALTER TABLE deals ADD COLUMN credit_blocked BOOLEAN DEFAULT FALSE;

-- Deal close status (LM-2)
ALTER TABLE deals ADD COLUMN deal_close_status TEXT DEFAULT 'open'
  CHECK (deal_close_status IN ('open','ready_to_close','closed'));
ALTER TABLE deals ADD COLUMN closed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN closed_by UUID REFERENCES users(id);
```

### 6.4 Table: `customers` Extensions

```sql
ALTER TABLE customers ADD COLUMN review_status TEXT DEFAULT 'pending_review'
  CHECK (review_status IN ('pending_review','approved','rejected'));
ALTER TABLE customers ADD COLUMN reviewed_by UUID REFERENCES users(id);
ALTER TABLE customers ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN onboarding_answers JSONB;
```

### 6.5 Table: `user_org_roles`

```sql
CREATE TABLE user_org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  org_role TEXT NOT NULL CHECK (org_role IN ('admin','super_admin','sales_manager','salesperson','wms_ops','pricing','viewer')),
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(user_id, organization_id, org_role)
);

-- Indexes
CREATE INDEX idx_user_org_roles_user ON user_org_roles(user_id);
CREATE INDEX idx_user_org_roles_org ON user_org_roles(organization_id);
```

### 6.6 Table: `customer_org_profiles`

```sql
CREATE TABLE customer_org_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Commercial terms
  payment_terms_id UUID REFERENCES payment_terms(id),
  credit_limit NUMERIC(14,2),
  price_list_id UUID,
  
  -- Operational
  preferred_carrier TEXT,
  shipping_instructions TEXT,
  
  -- Contract
  contract_required BOOLEAN DEFAULT TRUE,
  contract_waived BOOLEAN DEFAULT FALSE,
  contract_waived_by UUID REFERENCES users(id),
  contract_waived_at TIMESTAMPTZ,
  contract_waived_note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(customer_id, organization_id)
);
```

### 6.7 Table: `deal_lines`

```sql
CREATE TABLE deal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Product
  catalog_item_id UUID,
  quality_code TEXT NOT NULL,
  color_code TEXT,
  
  -- Quantities
  requested_meters NUMERIC(12,2) NOT NULL,
  reserved_meters NUMERIC(12,2) DEFAULT 0,
  fulfilled_meters NUMERIC(12,2) DEFAULT 0,
  
  -- Pricing
  list_price NUMERIC(12,2),
  discount_percent NUMERIC(5,2) DEFAULT 0,
  unit_price NUMERIC(12,2),
  line_total NUMERIC(14,2),
  price_approval_status TEXT CHECK (price_approval_status IN ('pending','approved','rejected')),
  price_approval_by UUID,
  price_approval_at TIMESTAMPTZ,
  
  -- Sample
  sample_requested BOOLEAN DEFAULT FALSE,
  sample_sent BOOLEAN DEFAULT FALSE,
  sample_approved BOOLEAN,
  
  -- Lab work
  lab_work_required BOOLEAN DEFAULT FALSE,
  lab_work_status TEXT CHECK (lab_work_status IN ('pending','in_progress','passed','failed')),
  
  -- Fulfillment
  fulfillment_status TEXT DEFAULT 'pending',
  wms_reservation_line_id UUID,
  wms_order_line_id UUID,
  
  -- Cut tracking
  cut_performed BOOLEAN DEFAULT FALSE,
  cut_reason TEXT,
  cut_by UUID REFERENCES users(id),
  cut_at TIMESTAMPTZ,
  
  line_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deal_lines_deal ON deal_lines(deal_id);
CREATE INDEX idx_deal_lines_quality ON deal_lines(quality_code, color_code);
```

### 6.8 Table: `supply_requests`

```sql
CREATE TABLE supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),  -- For filtering/permissions ONLY
  requested_for_org_id UUID NOT NULL REFERENCES organizations(id),  -- Mandatory: which org needs this
  deal_id UUID REFERENCES deals(id),
  
  type TEXT NOT NULL CHECK (type IN ('manufacturing','import_from_central')),
  status TEXT DEFAULT 'planned' 
    CHECK (status IN ('planned','eta_confirmed','in_transit','arrived_soft','allocated','closed','cancelled')),
  
  quality_code TEXT NOT NULL,
  color_code TEXT,
  meters NUMERIC(12,2) NOT NULL,
  eta_date DATE,
  
  -- Tracking
  arrived_at TIMESTAMPTZ,
  allocated_at TIMESTAMPTZ,
  
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_supply_requests_org ON supply_requests(organization_id);
CREATE INDEX idx_supply_requests_status ON supply_requests(status);
CREATE INDEX idx_supply_requests_deal ON supply_requests(deal_id);
```

### 6.9 Table: `deal_orders`

```sql
CREATE TABLE deal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  wms_order_id TEXT NOT NULL,
  po_number TEXT NOT NULL,
  customer_reference_po TEXT,
  
  order_type TEXT DEFAULT 'full' CHECK (order_type IN ('full','partial','sample')),
  status TEXT DEFAULT 'created',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, po_number)
);

-- Indexes
CREATE INDEX idx_deal_orders_deal ON deal_orders(deal_id);
CREATE INDEX idx_deal_orders_po ON deal_orders(po_number);
```

### 6.10 Table: `post_po_issues`

```sql
CREATE TABLE post_po_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_order_id UUID NOT NULL REFERENCES deal_orders(id),
  deal_line_id UUID REFERENCES deal_lines(id),
  
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'lot_change',
    'quantity_shortage',
    'color_discrepancy',
    'quality_issue',
    'delivery_delay',
    'other'
  )),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','pending_customer','resolved','cancelled')),
  proposed_resolution TEXT,
  
  -- Customer approval evidence
  customer_approval_required BOOLEAN DEFAULT FALSE,
  customer_approved BOOLEAN,
  customer_approval_method TEXT CHECK (customer_approval_method IN (
    'email','phone','whatsapp','signed','other'
  )),
  customer_approval_note TEXT,
  customer_approval_attachment_path TEXT,  -- optional
  customer_approved_at TIMESTAMPTZ,
  
  -- Internal resolution
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  
  -- Manager oversight
  manager_override BOOLEAN DEFAULT FALSE,
  manager_override_by UUID REFERENCES users(id),
  manager_override_at TIMESTAMPTZ,
  manager_override_note TEXT,
  
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_post_po_issues_order ON post_po_issues(deal_order_id);
CREATE INDEX idx_post_po_issues_status ON post_po_issues(status);
```

### 6.11 Table: `proformas`

```sql
CREATE TABLE proformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  
  proforma_number TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  
  -- Financial
  subtotal NUMERIC(14,2),
  discount_total NUMERIC(14,2),
  tax_total NUMERIC(14,2),
  grand_total NUMERIC(14,2),
  currency_id UUID REFERENCES currencies(id),
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','expired','cancelled')),
  
  -- Balance gate
  customer_exposure NUMERIC(14,2),
  customer_overdue NUMERIC(14,2),
  customer_available_credit NUMERIC(14,2),
  balance_warning_shown BOOLEAN DEFAULT FALSE,
  
  -- Email draft
  email_subject TEXT,
  email_body TEXT,
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_proformas_deal ON proformas(deal_id);
CREATE INDEX idx_proformas_status ON proformas(status);
```

### 6.12 Table: `contracts`

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  proforma_id UUID REFERENCES proformas(id),
  
  contract_number TEXT NOT NULL,
  
  status TEXT DEFAULT 'drafted' CHECK (status IN ('drafted','sent','signed_received','waived')),
  
  -- Tracking
  drafted_at TIMESTAMPTZ DEFAULT now(),
  drafted_by UUID REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES users(id),
  waived_at TIMESTAMPTZ,
  waived_by UUID REFERENCES users(id),
  waived_note TEXT,
  
  attachment_path TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contracts_deal ON contracts(deal_id);
CREATE INDEX idx_contracts_status ON contracts(status);
```

### 6.13 Table: `payments`

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  payment_reference TEXT,
  
  -- Amount (in original currency)
  amount NUMERIC(14,2) NOT NULL,
  currency_id UUID NOT NULL REFERENCES currencies(id),
  
  -- FX conversion (to org base currency)
  fx_rate NUMERIC(10,6),
  base_currency_amount NUMERIC(14,2),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  
  -- Allocation
  allocated_to_deals JSONB DEFAULT '[]',  -- [{deal_id, amount}]
  
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
```

### 6.14 Table: `fx_rates`

```sql
CREATE TABLE fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  from_currency_id UUID NOT NULL REFERENCES currencies(id),
  to_currency_id UUID NOT NULL REFERENCES currencies(id),
  
  rate NUMERIC(10,6) NOT NULL,
  effective_date DATE NOT NULL,
  
  set_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, from_currency_id, to_currency_id, effective_date)
);

-- Indexes
CREATE INDEX idx_fx_rates_effective ON fx_rates(effective_date DESC);
```

### 6.15 Table: `order_form_tokens`

```sql
CREATE TABLE order_form_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  
  token TEXT NOT NULL UNIQUE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active','used','expired','revoked')),
  
  -- Tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_order_form_tokens_token ON order_form_tokens(token);
CREATE INDEX idx_order_form_tokens_deal ON order_form_tokens(deal_id);
```

### 6.16 Table: `order_form_submissions`

```sql
CREATE TABLE order_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  token_id UUID NOT NULL REFERENCES order_form_tokens(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  
  -- Submission payload (for prefill on resend)
  payload JSONB NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed','accepted','rejected')),
  
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_order_form_submissions_deal ON order_form_submissions(deal_id);
```

### 6.17 Table: `help_tickets`

```sql
CREATE TABLE help_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  title TEXT NOT NULL,
  description TEXT,
  
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  
  -- Context
  related_entity_type TEXT,
  related_entity_id UUID,
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_note TEXT,
  
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_help_tickets_status ON help_tickets(status);
CREATE INDEX idx_help_tickets_assigned ON help_tickets(assigned_to);
```

### 6.18 Table: `help_ticket_comments`

```sql
CREATE TABLE help_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES help_tickets(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_help_ticket_comments_ticket ON help_ticket_comments(ticket_id);
```

---

## 7. Complete Permission List

### 7.1 Multi-Org Permissions

| Permission Key | Description |
|----------------|-------------|
| `org.view` | View organization details |
| `org.grants.manage` | Manage user grants/roles |
| `org.switch.all` | Switch to any organization |

### 7.2 Customer Permissions

| Permission Key | Description |
|----------------|-------------|
| `customer.view` | View customers |
| `customer.create` | Create customers |
| `customer.edit` | Edit customers |
| `customer.review.approve` | Approve pending customer reviews |
| `customer.contract.waive` | Waive contract requirement |

### 7.3 Deal Permissions (PATCH #6: deals.close added)

| Permission Key | Description |
|----------------|-------------|
| `deals.view` | View deals |
| `deals.create` | Create deals |
| `deals.edit` | Edit deals |
| `deals.close` | Mark Ready to Close, Close Deal, Reopen, Bulk Close |

### 7.4 Pricing Permissions

| Permission Key | Description |
|----------------|-------------|
| `pricing.view` | View pricing data |
| `pricing.list_price.set` | Set list prices |
| `pricing.customer_price.set` | Set customer-specific prices |
| `pricing.discount.approve` | Approve discount requests |
| `pricing.staleness.confirm` | Confirm stale prices |
| `pricing.catalog.sync` | Sync catalog from WMS |

### 7.5 Payments/Credit Permissions

| Permission Key | Description |
|----------------|-------------|
| `payments.view` | View payments |
| `payments.create` | Create payment records |
| `payments.confirm` | Confirm individual payments |
| `payments.confirm.bulk_confirm` | Bulk confirm payments |
| `payments.import` | Import payments from file |
| `credit.view` | View credit information |
| `credit.limit.edit` | Edit credit limits |
| `credit.override` | Override credit blocks |
| `fx_rates.view` | View FX rates |
| `fx_rates.set` | Set FX rates |

### 7.6 Approval Permissions

| Permission Key | Description |
|----------------|-------------|
| `approvals.view` | View approval queue |
| `approvals.customer.review` | Review customer approvals |
| `approvals.credit` | Handle credit approvals |
| `approvals.pricing` | Handle pricing approvals |
| `approvals.payment` | Handle payment approvals |
| `approvals.shipment.approve` | Approve shipments |
| `approvals.shipment.bulk_approve` | Bulk approve shipments |
| `approvals.deal` | Handle deal approvals |

### 7.7 Post-PO Permissions (PATCH #6: all postpo.* added)

| Permission Key | Description |
|----------------|-------------|
| `postpo.view` | View post-PO issues |
| `postpo.create` | Create post-PO issues |
| `postpo.resolve` | Resolve issues with customer approval |
| `postpo.override` | Manager override/reject resolution |

### 7.8 Fulfillment Permissions

| Permission Key | Description |
|----------------|-------------|
| `fulfillment.view` | View fulfillment center |
| `supply_requests.view` | View supply requests |
| `supply_requests.create` | Create supply requests |
| `shortage.decide` | Make shortage decisions |

### 7.9 Order Form Permissions

| Permission Key | Description |
|----------------|-------------|
| `order_form.view` | View order forms |
| `order_form.token.create` | Create order form tokens |
| `order_form.token.manage` | Manage (revoke) tokens |

### 7.10 Central Stock Permissions

| Permission Key | Description |
|----------------|-------------|
| `central_stock.view` | View central stock check results |
| `central_stock.check.create` | Create central stock check requests |

### 7.11 Proforma/Contract Permissions

| Permission Key | Description |
|----------------|-------------|
| `proforma.view` | View proformas |
| `proforma.create` | Create proformas |
| `proforma.send` | Send proformas |
| `contract.view` | View contracts |
| `contract.receive` | Mark contract received |
| `contract.waive` | Waive contract requirement |

### 7.12 Cutting Permissions

| Permission Key | Description |
|----------------|-------------|
| `inventory.cut_roll` | Perform roll cutting operations |

### 7.13 Help/Tickets Permissions

| Permission Key | Description |
|----------------|-------------|
| `help.view` | View help tickets |
| `help.create` | Create help tickets |
| `help.manage` | Manage/assign tickets |

### 7.14 Email Permissions (PATCH #6: email.send_now added)

| Permission Key | Description |
|----------------|-------------|
| `email.send_now` | Manual "Send Now" actions |
| `settings.email.manage` | Manage email settings |

### 7.15 Settings Permissions

| Permission Key | Description |
|----------------|-------------|
| `settings.invoice_export` | Configure invoice export |

---

## 8. Email Types Catalog

### 8.1 Customer Emails (audience: `customer`)

| Email Type | Delivery Mode | Description |
|------------|---------------|-------------|
| `customer_shipped` | immediate (when enabled) | Sent when order shipped, includes tracking |
| `customer_delivered_docs_digest` | scheduled_batch (09:00) | Next-day batch with irsaliye attachments |
| `order_form_confirmation` | immediate | Sent on order form submission |
| `order_form_changes` | manual | Sent when internal edits made and resend requested |

**Customer Email Eligibility (ALL must be true):**
1. `email_routing_rules.enabled = TRUE` for that email_type
2. `customer_email_policy.mode = 'enabled'`
3. `delivery_mode` rules satisfied
4. Customer has at least one valid email via `resolve_customer_email()`

**HARD RULES:**
- Tracking changes NEVER auto-email customers (internal-only unless manual resend)
- Prepared email to customers = OFF in V1

### 8.2 Internal Digest Emails (audience: `internal_digest`)

| Email Type | Default Cron | Description |
|------------|--------------|-------------|
| `pending_approvals_digest` | `0 8 * * 1-5` | Summary of pending approvals (weekdays 8am) |
| `stale_prices_weekly_digest` | `0 8 * * 1` | Stale in-stock prices requiring review (Mondays 8am) |
| `central_stock_check_digest` | `0 17 * * 1-5` | Summary of check results (weekdays 5pm) |

**Recipients:** From `to_roles`, `to_users`, `to_emails` in routing rule. Falls back to org admins if empty.

### 8.3 Internal Ops Emails (audience: `internal_ops`)

| Email Type | Delivery Mode | Description |
|------------|---------------|-------------|
| `cost_control_daily_pack` | scheduled_batch (18:00) | Doc bundle: PO receipt + irsaliye + invoice reference |
| `override_used` | immediate | When credit/shipment override is used |
| `shipment_approval_needed` | immediate | When shipment enters approval queue |
| `new_customer_pending_review` | immediate | When new customer created via order form |
| `supply_request_created` | immediate | When supply request is created |
| `eta_near` | scheduled_batch (daily) | ETA approaching in 3 days |
| `soft_arrival_confirmed` | immediate | When supply arrives (soft) |
| `credit_request_submitted` | immediate | When credit limit request submitted |

**Recipients:** From `to_roles`, `to_users`, `to_emails`. Falls back to org admins if empty.

---

## 9. LM-1: Cost Control Daily Pack

### 9.1 Settings

Located in `organizations.cost_control_settings`:

```json
{
  "max_orders_per_email": 7,
  "send_time_cron": "0 18 * * 1-5"
}
```

### 9.2 Logic

**Trigger:** Supabase Scheduled Edge Function (configurable cron, default 18:00 weekdays)

**Content per email (max 7 orders, configurable):**

**Section 1: "Orders with Complete Documents"**
- For each order: PO Number, Customer, Delivered Date
- Attachments (from `order_mirrors`):
  - PO Receipt PDF (placeholder in V1)
  - Signed Irsaliye (`irsaliye_attachment_path`)
  - Invoice Reference (`invoice_attachment_path`)

**Section 2: "Orders Pending Document Uploads"**
- For each order: PO Number, Customer, Delivered Date
- Missing: [list of missing docs]

### 9.3 Batch Splitting

- If 15 orders: send 3 emails (7 + 7 + 1)
- Each email is self-contained with its order section

### 9.4 Eligibility

- Orders where `delivered_at` is within last 24h
- OR orders pending docs from previous days (not yet included in a pack)

### 9.5 Idempotency Key

Format: `{org_id}:cost_control_daily_pack:{YYYY-MM-DD}:{batch_index}`

---

## 10. LM-2: Fulfillment Closure State

### 10.1 Fields

**Deal level (already defined in Section 6.3):**
- `deal_close_status` (open | ready_to_close | closed)
- `closed_at`
- `closed_by`

**Order level (in `order_mirrors`):**
- `invoice_control_status` (pending_control | passed | failed)
- `invoice_control_by`
- `invoice_control_at`
- `invoice_control_note`

### 10.2 State Flow

```
ORDER LEVEL:
  invoiced → invoice_control_status = 'pending_control'
  ↓
  invoice control passed → invoice_control_status = 'passed'
  OR invoice control failed → invoice_control_status = 'failed' (note required)
  ↓
  ONLY after 'passed' can order be marked 'fulfilled'

DEAL LEVEL:
  deal.deal_close_status = 'open' (default)
  ↓
  ALL POs for deal have invoice_control_status = 'passed'
  ↓
  User manually clicks "Mark Ready to Close"
  ↓
  deal.deal_close_status = 'ready_to_close'
  ↓
  User manually clicks "Close Deal"
  ↓
  deal.deal_close_status = 'closed'
  deal.closed_at = now()
  deal.closed_by = user_id
```

### 10.3 UI Actions

| Action | Location | Permission | Condition |
|--------|----------|------------|-----------|
| Mark Ready to Close | Deal detail | `deals.close` | All POs passed invoice control |
| Close Deal | Deal detail | `deals.close` | `deal_close_status = 'ready_to_close'` |
| Bulk Close | Fulfillment Center | `deals.close` | Only deals in 'ready_to_close' selectable |
| Reopen Deal | Deal detail | `deals.close` | Only if 'closed' (creates audit entry) |

### 10.4 Blocking Rules

- Failed invoice control → blocks closure until resolved
- Individual order cannot be marked fulfilled until `invoice_control_status = 'passed'`
- Deal cannot be closed until ALL POs are fulfilled

---

## 11. LM-3: Post-PO Approval Evidence

### 11.1 Schema

See Section 6.10 for full `post_po_issues` table definition.

### 11.2 Approval Workflow

**Permissions:**
- `postpo.create` - Create issue (salesperson, wms_ops)
- `postpo.resolve` - Resolve issue with customer approval (salesperson)
- `postpo.override` - Override/reject resolution (manager)
- `postpo.view` - View issues (all with deal access)

**Flow:**
1. Issue created → status = 'open'
2. If `customer_approval_required`:
   - Salesperson contacts customer
   - Records approval method + note + optional attachment
   - Sets `customer_approved = TRUE`
3. Salesperson clicks "Resolve" → status = 'resolved'
4. Manager sees in /approvals queue → can approve or override/reject

**Evidence Fields (for customer-approved resolutions):**
- `customer_approval_method` - how approval was obtained (required)
- `customer_approval_note` - description of what was agreed (required)
- `customer_approval_attachment_path` - optional screenshot/file

---

## 12. Phase A: Foundation (Batches 1-3)

### Batch 1: Multi-Org Foundation Schema (2-3 sessions)

#### Session 1.1: Core Multi-Org Tables

**Tables to create:**
- `organizations` (with `eta_standard_messages`, `cost_control_settings`)
- `user_org_roles` (grant-based access)
- `user_active_org_preferences`

**Functions:**
- `user_has_org_access(user_id, org_id)` → BOOLEAN
- `get_user_active_org(user_id)` → UUID

**RLS Policies:**
- Org-scoped policies on all new tables using `user_has_org_access()`

#### Session 1.2: Customer Extensions

**Tables to modify:**
- `customers` additions (review_status, onboarding_answers)
- `customer_org_profiles` (NO status_emails_enabled column)

**React Hooks:**
- `useOrganizations`
- `useUserOrgRoles`
- `useActiveOrg`

#### Session 1.3: UI Components

**Components:**
- `OrgScopeSelector.tsx` - Dropdown for switching orgs
- `OrgBadge.tsx` - Visual indicator of current org
- Update `AppHeader.tsx` to include org switcher

---

### Batch 2: Customer Onboarding + Customer Page Details (2 sessions)

#### Session 2.1: Customer Review Workflow

**User Stories:**
- New customers default to `pending_review`
- Deals progress up to "Submitted" for pending customers
- Manager approval queue with override + required reason

**Components:**
- `CustomerReviewBadge.tsx`
- `CustomerReviewDialog.tsx`

#### Session 2.2: Customer Detail Tabs

**Tabs:**
1. Overview (with review status badge)
2. Org Profiles (per-org commercial settings)
3. Credit & Exposure
4. Deals
5. Contacts
6. Settings (contract waiver, email policy toggle)

**Contract Waiver:**
- Per customer + per org
- Manager-only with required note

---

### Batch 3: Deal Lines & Pricing Foundation (2-3 sessions)

#### Session 3.1: Deal Lines Schema

**Tables:**
- `deal_lines` (comprehensive with pricing, samples, fulfillment, lab work)
- `catalog_items`

#### Session 3.2: Pricing Tables

**Tables:**
- `quality_list_prices`
- `quality_pricing_policy`
- `customer_quality_prices`
- `pricing_approvals`

#### Session 3.3: Staleness Enforcement

**Logic:**
- Hidden from sales if in-stock + stale
- Weekly queue for reconfirmation

**Permissions:**
- Sales Manager + Pricing role can set prices

---

## 13. Phase B: Fulfillment Infrastructure (Batches 4-7)

### Batch 4: Fulfillment Schema & Mirrors (2-3 sessions)

#### Session 4.1: Deal Extensions

**Columns to add:**
- `deal_code`, `fulfillment_status`, `credit_blocked`
- `deal_close_status`, `closed_at`, `closed_by`

#### Session 4.2: Core Fulfillment Tables

**Tables:**
- `supply_requests` (with `organization_id` for filtering, `requested_for_org_id` mandatory)
- `deal_orders` (multi-PO support)

#### Session 4.3: Mirror Tables

**Tables:**
- `reservation_mirrors`
- `order_mirrors` (with `invoice_control_status`, `invoice_attachment_path`)
- `stock_by_quality_cache`

---

### Batch 5: Proforma + Contract System (2 sessions)

#### Session 5.1: Proforma Table & UI

**Tables:**
- `proformas` (with balance gate, editable email draft)

**Components:**
- `ProformaBuilder.tsx`
- `ProformaPreview.tsx`
- `BalanceGateWarning.tsx`

#### Session 5.2: Contract System

**Tables:**
- `contracts` (drafted → sent → signed_received → waived)
- `certificates`

**Balance Gate:**
- Show exposure, overdue, available before download/send
- Auto-insert warning if overdue exists

---

### Batch 6: Credit & Payment System (2-3 sessions)

#### Session 6.1: Payment Tables

**Tables:**
- `payments` (with FX conversion)
- `fx_rates`

#### Session 6.2: Credit Logic

**Overdue Hard Block:**
- Manager CAN override by:
  - Increasing limit
  - Recording payment
  - Override with reason
- All options create audit trail

#### Session 6.3: UI Components

**Components:**
- `PaymentLedger.tsx`
- `CreditExposureCard.tsx`
- `OverdueBlockDialog.tsx`

---

### Batch 7: Edge Functions - WMS Integration (2-3 sessions)

#### Session 7.1: Outbound Events (CRM → WMS)

**11 Events:**
1. `customer.created`
2. `customer.updated`
3. `deal.approved`
4. `deal.accepted`
5. `deal.won`
6. `deal.cancelled`
7. `deal.lines_updated`
8. `org_access.updated`
9. `supply_request.created`
10. `shipment.approved`
11. `payment.confirmed`

**Functions:**
- `wms-webhook-sender` (HMAC signing)

#### Session 7.2: Inbound Events (WMS → CRM)

**22 Events:**
(See integration contract for full list)

**Functions:**
- `crm-integration-api` (HMAC validation, mirror updates)

#### Session 7.3: Catalog Sync

**Functions:**
- `catalog-sync` (sync quality codes, colors from WMS)

---

## 14. Phase C: Command Centers (Batches 8-11)

### Batch 8: Unified Manager Approval Center (3 sessions)

#### Session 8.1: Approval Center Page

**Page:** `/approvals`

**Tabs:**
- All Pending
- Customer Reviews
- Credit
- Pricing
- Payment
- Shipment
- Deal
- Post-PO

#### Session 8.2: Approval Components

**Components:**
- `ApprovalGrid.tsx`
- `ApprovalContextPanel.tsx` (customer/credit/history info)
- `ApprovalActionBar.tsx`

#### Session 8.3: Bulk Actions

**Features:**
- Bulk approve/reject per type
- Filter by assignee, date, priority

---

### Batch 9: Fulfillment Command Center (3-4 sessions)

#### Session 9.1: Fulfillment Page Structure

**Page:** `/fulfillment`

**Layout:**
- Stage cards (Pending → Reserved → ... → Fulfilled → Closed)
- Universal filterable table

#### Session 9.2: Human Gates Panel

**5 Tabs:**
1. Needs Allocation Plan
2. Needs Roll Entry
3. Needs Ship Date
4. Needs Customer Confirmation
5. Needs Shortage Decision

#### Session 9.3: Close Actions

**Actions:**
- Mark Ready to Close (individual)
- Close Deal (individual)
- Bulk Close (multiple ready_to_close)

#### Session 9.4: Fulfillment Table

**Columns:**
- PO Number, Customer, Stage, Days in Stage, Actions

---

### Batch 10: Pricing Command Center (2-3 sessions)

#### Session 10.1: Pricing Page Structure

**Page:** `/pricing`

**Tabs:**
- Approvals Inbox
- Missing Prices
- Stale Prices

#### Session 10.2: Last 5 Sales Context

**Features:**
- Show last 5 sales for selected quality/customer
- Quick approve/reject actions

#### Session 10.3: Catalog Sync

**Features:**
- Sync Catalog button
- Quality + Customer pricing management

---

### Batch 11: Credit, Payments, FX Pages (2-3 sessions)

#### Session 11.1: Credit Page

**Page:** `/credit`

**Sections:**
- Balances
- Over Limit
- Overdue
- Blocked Deals
- Pending Review

#### Session 11.2: Payments Page

**Page:** `/payments`

**Features:**
- Ledger view
- Import from file
- Exposure calculation

#### Session 11.3: FX Rates Page

**Page:** `/fx-rates`

**Features:**
- Rate setter
- History view

---

## 15. Phase D: Order Form & Advanced (Batches 12-14)

### Batch 12: Public Order Form (3 sessions)

#### Session 12.1: Token System

**Tables:**
- `order_form_tokens` (with deal_id for regeneration)
- `order_form_submissions` (payload for prefill)

#### Session 12.2: Form Sections

**Sections:**
1. Ship intent
2. Ship date
3. Reserve rules
4. Carrier preference
5. AWB
6. Lab work
7. Certificates
8. Attachments (Excel upload)

#### Session 12.3: Excel Validation

**Validation Rules:**
- UOM: MT, KG, Metre, Kilogram (hard check)
- Quantity: positive number (hard check)
- Quality/Color: human check

**Behavior:**
- Any invalid row → block entire upload, show row errors
- Token regeneration prefills from latest submission

---

### Batch 13: Supply Tracking & Central Stock Checks (2 sessions)

#### Session 13.1: Supply Tracking Page

**Page:** `/supply-tracking`

**Features:**
- Status badges including "Arrived (Soft)"
- CRUD for supply requests

#### Session 13.2: Central Stock Checks

**Features:**
- Abra enforcement in WMS before "send back"
- CRM receives and displays results using ETA standard messages

---

### Batch 14: Cutting + Help/Tickets + Post-PO (2 sessions)

#### Session 14.1: Cutting Audit

**Fields on `deal_lines`:**
- `cut_performed`
- `cut_reason`
- `cut_by`
- `cut_at`

**Permission:** `inventory.cut_roll`

#### Session 14.2: Help/Tickets & Post-PO

**Tables:**
- `help_tickets`
- `help_ticket_comments`
- `post_po_issues`

**Features:**
- Basic CRM-only help framework
- Full post-PO evidence workflow

---

## 16. Phase E: Notifications & Control (Batches 15-16)

### Batch 15: Unified Email System (2-3 sessions)

#### Session 15.1: Email Tables

**Tables:**
- `email_routing_rules`
- `customer_email_policy`
- `email_send_logs` (with `idempotency_key`)
- `email_templates_v2`

**Functions:**
- `resolve_customer_email()`

#### Session 15.2: Scheduled Edge Functions

**Functions:**
- `email-customer-delivered-docs`
- `email-cost-control-pack`
- `email-pending-approvals`
- `email-stale-prices`
- `email-central-stock-check`
- `email-eta-near`

#### Session 15.3: Email Settings UI

**Page:** `/settings/email-notifications`

**Features:**
- Per-org configuration
- Enable/disable per email type
- Recipient configuration (roles, users, emails)
- TO/CC/BCC support

---

### Batch 16: Invoice Control + Costing (2-3 sessions)

#### Session 16.1: Invoice Control

**Workflow:**
- `pending_control` after invoicing
- Only `passed` allows fulfillment
- `failed` requires note, blocks closure

#### Session 16.2: Costing Mirrors

**Tables:**
- `costing_mirrors` (supplier invoice, landed cost, FX)

**Source:** Synced from WMS

#### Session 16.3: XML Export

**Tables:**
- `invoice_export_settings`

---

## 17. Phase F: Wrap-up (Batch 17)

### Batch 17: Navigation, Permissions, Documentation (3 sessions)

#### Session 17.1: Permission Implementation

**Features:**
- Complete permission enforcement on all pages
- All features have VIEW permissions
- Role-based permission grants

#### Session 17.2: Sidebar Configuration

**Basic Users:**
- Dashboard
- Customers
- Deals
- Pipeline
- Activities
- My Work

**Power Users (additional):**
- Approvals
- Operations (Fulfillment, Supply)
- Finance (Pricing, Payments, FX, Credit)
- Help
- Settings

#### Session 17.3: Documentation

**Files to update:**
- Copy all contract docs to `/docs`
- Update `ROADMAP.md`
- Update `integration_contract_v1.md`

---

## 18. Hard Rules Summary

| Rule | Description |
|------|-------------|
| 3 Email Audiences | `customer`, `internal_digest`, `internal_ops` - never mix |
| Single Email Config | `email_routing_rules` + `customer_email_policy` only |
| All Customer Emails Default OFF | `customer_email_policy.mode = 'off'` default |
| All Routing Rules Default OFF | `email_routing_rules.enabled = FALSE` default |
| Delivery Mode Default Manual | `delivery_mode = 'manual'` default |
| Tracking Changes | NEVER auto-email customers |
| Prepared Email | OFF in V1 |
| Recipient Fallback | Falls back to org admins if none configured |
| Cost Control Pack | Max 7 orders/email (configurable), includes pending docs section |
| Deal Close | Manual trigger only, requires all POs invoice_control_passed |
| Post-PO Evidence | Attachment optional, note required |
| supply_requests.organization_id | Filtering/permissions ONLY, not ownership |
| customers.poc_email | Standard field for primary email (Micro-edit A) |
| contacts.role values | billing, shipping, sales, other (Micro-edit B) |
| Idempotency | All emails have unique idempotency_key per org |
| Scheduling | Supabase Scheduled Edge Functions (fallback pg_cron) |

---

## 19. Session Estimates

| Batch | Description | Sessions | Cumulative |
|-------|-------------|----------|------------|
| 1 | Multi-Org Foundation | 2-3 | 2-3 |
| 2 | Customer Onboarding + Details | 2 | 4-5 |
| 3 | Deal Lines & Pricing | 2-3 | 6-8 |
| 4 | Fulfillment Schema & Mirrors | 2-3 | 8-11 |
| 5 | Proforma + Contract | 2 | 10-13 |
| 6 | Credit & Payment | 2-3 | 12-16 |
| 7 | Edge Functions - WMS | 2-3 | 14-19 |
| 8 | Unified Approval Center | 3 | 17-22 |
| 9 | Fulfillment Command Center | 3-4 | 20-26 |
| 10 | Pricing Command Center | 2-3 | 22-29 |
| 11 | Credit, Payments, FX | 2-3 | 24-32 |
| 12 | Public Order Form | 3 | 27-35 |
| 13 | Supply Tracking + Abra | 2 | 29-37 |
| 14 | Cutting + Help + Post-PO | 2 | 31-39 |
| 15 | Unified Email System | 2-3 | 33-42 |
| 16 | Invoice Control + Costing | 2-3 | 35-45 |
| 17 | Navigation + Permissions + Docs | 3 | 38-48 |

**Total: 35-45 sessions**

---

## 20. Prerequisites

### Before Batch 1

1. **Generate HMAC Secret:**
   ```bash
   openssl rand -hex 32
   ```

2. **Add Supabase Secrets:**
   - `WMS_API_KEY`
   - `WMS_API_URL`
   - `WMS_WEBHOOK_SECRET`

3. **Prepare Seed Data:**
   - MOD + JTR organizations
   - Initial admin grants

### After Batch 7

4. **Share with WMS Team:**
   - Contract docs
   - HMAC secret exchange
   - Webhook endpoints

---

## 21. Tables to Remove

These tables/columns are NOT created (replaced by unified model):

```sql
-- DROP THESE (or never create):
-- customer_status_email_config
-- customer_email_optouts
-- email_recipient_configs

-- REMOVE THESE COLUMNS:
-- customer_org_profiles.status_emails_enabled
```

---

## 22. Lock Statement

This document represents the **FINAL LOCKED** implementation plan for the CRM-WMS Integration and Pricing Engine EPIC.

**All patches have been applied:**
- [x] Customer recipient resolution order defined (`customers.poc_email` → primary/billing contact → skip+log)
- [x] `order_mirrors.invoice_attachment_path` added
- [x] Org admin fallback precisely defined
- [x] Email idempotency key with uniqueness
- [x] Scheduling: Supabase Scheduled Edge Functions
- [x] All permissions listed (`deals.close`, `postpo.*`, `email.send_now`)
- [x] Email templates required per org per type
- [x] Naming consistency: `customers.poc_email` (Micro-edit A)
- [x] Contacts role enum defined (Micro-edit B)
- [x] RLS `user_has_org_access()` function with grant expiration check (v1.0.22)
- [x] RLS 4-policy split: SELECT/INSERT/UPDATE/DELETE with proper WITH CHECK (v1.0.22)
- [x] RLS org column name rule: `organization_id` vs `org_id` documented (v1.0.22)
- [x] RLS `organizations` table special case documented (v1.0.22)
- [x] RLS table categories verified against actual schema (v1.0.22)
- [x] `customers.review_status` default = `'pending_review'` (v1.0.22)
- [x] `order_form_tokens.deal_id` and `customer_id` nullable for new customer flow (v1.0.22)
- [x] `order_form_tokens.created_by` nullable for public tokens (v1.0.22)
- [x] `help_ticket_comments` is JOIN-ACCESSED via `help_tickets` (v1.0.22)

**Hard Rules Added (v1.0.22):**
- Customer Approval Gate: Deals cannot transition to WON unless `customer.review_status = 'approved'` OR manager override with reason
- RLS Category Check: Before adding RLS, verify table has org column; if not, use JOIN-ACCESSED pattern
- RLS WITH CHECK: All INSERT policies use WITH CHECK; all UPDATE policies use USING + WITH CHECK
- Grant Expiration: `user_has_org_access()` checks `expires_at IS NULL OR expires_at > now()`

**Contract Version:** v1.0.22  
**Status:** FINAL LOCKED — READY TO PROCEED

---

*Document generated: 2026-01-27*  
*Next action: Begin Batch 1 implementation*

---

## APPENDED — v1.0.23 Alignment Addendum (Non-breaking)
**Date appended:** 2026-01-30  
**Contract authority:** `integration_contract_v1_0_23(1)(1).md` is the locked single source of truth.  
**Rule:** If anything in this document conflicts with Contract v1.0.23, Contract v1.0.23 wins. No schema/event/idempotency drift is permitted.

### What changed vs earlier drafts (summary)
This addendum exists to (a) explicitly align this plan to Contract v1.0.23, and (b) document the previously missing/implicit topics:
1) **stock.changed** full section (idempotency + payload shape + cache update rules)  
2) **Idempotency key format enforcement** (exactly 5 segments)  
3) **Ordering/sequence handling** for any events that include a monotonic sequence field (e.g., `org_access_seq`, `status_seq` where present in the contract baseline)

### Non-negotiable role intent (maps to your User Stories #17–#18)
- **Sales Owner / Salesperson**: can *request* approvals, create deals, create supply requests, but **cannot approve** shipments/pricing/payments by default.  
- **Sales Manager / Pricing / Admin**: can approve pricing, confirm payments, approve shipments, clear credit blocks, decide shortages.  
- **Exception rule (explicit grant only):** a salesperson may approve shipments **only if** they have the explicit permission `approvals.shipment.approve` granted in `user_org_roles` (no implied role-based approval).

> NOTE: Any user stories or batches that say “Salesperson approves …” must be interpreted as “A user with explicit approval permission approves …”, defaulting to Sales Manager only.

### stock.changed — Contract v1.0.23 alignment note
- **Direction:** WMS → CRM  
- **Idempotency key:** `wms:stock:{transaction_batch_id}:changed:v1` (5 segments)  
- **Primary purpose:** update CRM cache/mirrors so command centers do not do N+1 calls.

**Implementation constraints (must match contract):**
- Treat each `transaction_batch_id` as the unit of idempotency.
- Apply scope-key normalization (org/color/warehouse scope keys) for UPSERT uniqueness in cache tables.
- Handle nullable `crm_organization_id`, `warehouse_id`, `color_code` using sentinel scope keys (Appendix A/C).

### Idempotency key format enforcement (hard constraint)
- Enforce **exactly 5 segments**: `<source>:<entity>:<entity_id>:<action>:v1`
- Reject keys that are not 5 segments, do not end with `v1`, or have empty `entity_id`.

### Ordering / sequence handling (anti-drift rule)
If an inbound event’s payload includes a monotonic sequence field (e.g., `org_access_seq`, `status_seq` in the contract baseline):
- Persist `last_seq` per `(entity)` (e.g., per `user_id` for org access; per `wms_order_id` for order status).
- If `incoming_seq <= last_seq`: **ignore** the update and log a warning to timeline (do not regress state).
- If `incoming_seq > last_seq`: apply and update `last_seq`.

This protects against out-of-order delivery without changing the contract.
