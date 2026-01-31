# WMS Implementation Plan for CRM/WMS Integration v1.0.23

> **Status**: DRAFT — Pending Review  
> **Contract Version**: v1.0.23 (LOCKED)  
> **Created**: 2026-01-31  
> **Total Estimated Sessions**: 29

---

## Table of Contents

1. [Document Alignment](#document-alignment)
2. [Operational Infrastructure](#operational-infrastructure)
3. [Batch 1: Contract File + Integration Inbox](#batch-1-contract-file--integration-inbox)
4. [Batch 2: Multi-Org Identity + org_access.updated Handler](#batch-2-multi-org-identity--org_accessupdated-handler)
5. [Batch 3: Reservations Schema Extensions](#batch-3-reservations-schema-extensions)
6. [Batch 4: Orders Schema Extensions + PO Number Generator](#batch-4-orders-schema-extensions--po-number-generator)
7. [Batch 5: Supply Requests Mirror + Events](#batch-5-supply-requests-mirror--events)
8. [Batch 6: stock.changed Event](#batch-6-stockchanged-event)
9. [Batch 7: Allocation Planning + Entry Pages](#batch-7-allocation-planning--entry-pages)
10. [Batch 8: Shipment Approval + Override](#batch-8-shipment-approval--override)
11. [Batch 9: Central Stock Checks (Abra)](#batch-9-central-stock-checks-abra)
12. [Batch 10: Post-PO Issues (Discrepancy Loop)](#batch-10-post-po-issues-discrepancy-loop)
13. [Batch 11: Costing Module](#batch-11-costing-module)
14. [Batch 12: Invoice Control + Fulfillment Gate](#batch-12-invoice-control--fulfillment-gate)
15. [Batch 13: PO Command Center](#batch-13-po-command-center)
16. [Final Consolidated Inventories](#final-consolidated-inventories)
17. [CRM Dependencies Per Batch](#crm-dependencies-per-batch)
18. [Open Items](#open-items)

---

## Document Alignment

This implementation plan is **100% aligned** with the following canonical v1.0.23 documents:

| Document | Location | Purpose |
|----------|----------|---------|
| Integration Contract v1.0.23 | `integration_contract_v1_0_23.md` | LOCKED contract (30 WMS→CRM events, 11 CRM→WMS events) |
| Epic Implementation Plan | `docs/wms_crm_v1_0_23_integration_updated/WMS_CRM_EPIC_IMPLEMENTATION_PLAN_v1_0_23_UPDATED.md` | 17-batch execution roadmap |
| QA Test Plan | `docs/wms_crm_v1_0_23_integration_updated/QA_TestPlan_CRM_WMS_v1_0_23_UPDATED.md` | 503-line test coverage |
| PRD | `docs/wms_crm_v1_0_23_integration_updated/PRD_CRM_Pricing_Thresholds_v1_9_v1_0_23_UPDATED.md` | Multi-org + pricing + credit rules |
| Agent Checklist | `docs/wms_crm_v1_0_23_integration_updated/Agent_Checklist_Pricing_Thresholds_WarehouseCheck_v1_10_v1_0_23_UPDATED.md` | WMS implementation checklist |
| Appendix | `docs/wms_crm_v1_0_23_integration_updated/WMS_Appendix_PricingThresholds_Inputs_v1_9_v1_0_23_UPDATED.md` | Data requirements |
| User Stories | `docs/wms_crm_v1_0_23_integration_updated/CRM_WMS_UserStories_v1_0_23.md` | 83 user stories |
| Master User Journeys | `docs/wms_crm_v1_0_23_integration_updated/CRM_WMS_USER_JOURNEYS_v1_0_23_AGGREGATED_MASTER.md` | 99 user journeys |

---

## Operational Infrastructure

### Inbound Event Logging

| Aspect | Specification |
|--------|---------------|
| **Table** | `integration_inbox` |
| **Columns** | `event_type`, `payload`, `idempotency_key`, `status`, `processed_at`, `error_message` |
| **Statuses** | `received` → `processing` → `processed` / `error` |
| **Validation** | 5-segment idempotency key format, HMAC signature verification |
| **Edge Function** | `wms-webhook-receiver` logs all received events |

### Outbound Event Queuing/Retry

| Aspect | Specification |
|--------|---------------|
| **Table** | `integration_outbox` (existing) |
| **Target** | `target_system = 'crm'` |
| **Retry Fields** | `next_retry_at`, `retry_count`, `max_retries` |
| **Edge Functions** | `webhook-dispatcher`, `process-webhook-retries` |

### Idempotency Enforcement

| Aspect | Specification |
|--------|---------------|
| **Format** | `<source>:<entity>:<entity_id>:<action>:v1` (exactly 5 segments) |
| **Index** | `idx_outbox_idempotency` on `integration_outbox(idempotency_key)` |
| **Behavior** | Check if key exists with `status = 'sent'`; if yes, return 200 "already processed" |
| **Sequence Handling** | Out-of-order protection using monotonic `*_seq` fields |

### Idempotency Key Validation Function

```sql
CREATE OR REPLACE FUNCTION validate_idempotency_key(p_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_parts TEXT[];
BEGIN
  v_parts := string_to_array(p_key, ':');
  IF array_length(v_parts, 1) != 5 THEN
    RETURN FALSE;
  END IF;
  IF v_parts[1] NOT IN ('wms', 'crm') THEN
    RETURN FALSE;
  END IF;
  IF v_parts[5] != 'v1' THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;
```

---

## Batch 1: Contract File + Integration Inbox

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1 |
| **Priority** | P0 — Foundation |
| **Dependencies** | None |
| **CRM Required** | No |

### Contract Scope

- **Events**: None (infrastructure only)
- **Purpose**: Establish canonical contract file and create inbound event logging table

### DB Scope

#### New Table: `integration_inbox`

```sql
CREATE TABLE integration_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  source_system TEXT DEFAULT 'crm',
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'error')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbox_idempotency ON integration_inbox(idempotency_key);
CREATE INDEX idx_inbox_status ON integration_inbox(status, created_at);
CREATE INDEX idx_inbox_event_type ON integration_inbox(event_type, created_at DESC);
```

#### RLS Policies

```sql
ALTER TABLE integration_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only access to integration_inbox"
  ON integration_inbox
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'senior_manager')
    )
  );
```

### Backend Scope

#### Edge Function Updates: `wms-webhook-receiver`

| Change | Description |
|--------|-------------|
| Validate idempotency key | Reject if not 5 segments |
| Log to `integration_inbox` | Instead of `integration_outbox` for inbound events |
| Return structured response | `{ "status": "received", "idempotency_key": "..." }` |

#### New Validation Logic

```typescript
function validateIdempotencyKey(key: string): boolean {
  const parts = key.split(':');
  if (parts.length !== 5) return false;
  if (!['wms', 'crm'].includes(parts[0])) return false;
  if (parts[4] !== 'v1') return false;
  return true;
}
```

### UI Scope

- None

### Feature Scope

- None

### Forms Scope

- None

### Permissions Scope

| Permission | Roles |
|------------|-------|
| View `integration_inbox` | admin, senior_manager |

### User Journeys

- None (infrastructure)

### User Stories

- None (infrastructure)

### Done Proof

| Check | Method |
|-------|--------|
| Contract file updated | `docs/integration_contract_v1.md` contains v1.0.23 content |
| Table exists | `SELECT * FROM integration_inbox LIMIT 1` succeeds |
| Event logging works | Send test event with valid HMAC, verify row in inbox |
| Invalid key rejected | Send event with 4-segment key, verify HTTP 400 response |

### QA Test IDs

- B-01: Idempotency key format validation
- B-02: Duplicate event handling

---

## Batch 2: Multi-Org Identity + org_access.updated Handler

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2 |
| **Priority** | P0 — Foundation |
| **Dependencies** | Batch 1 |
| **CRM Required** | Yes — must emit `org_access.updated` |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `org_access.updated` | CRM → WMS | `crm:org_access:{user_id}-{org_access_seq}:updated:v1` |

### DB Scope

#### New Table: `user_org_grants_mirror`

```sql
CREATE TABLE user_org_grants_mirror (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  crm_organization_id UUID NOT NULL,
  role_in_org TEXT NOT NULL CHECK (role_in_org IN ('viewer', 'sales_rep', 'sales_manager', 'org_admin')),
  is_active BOOLEAN DEFAULT true,
  org_access_seq INTEGER NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, crm_organization_id)
);

CREATE INDEX idx_org_grants_user ON user_org_grants_mirror(user_id);
CREATE INDEX idx_org_grants_org ON user_org_grants_mirror(crm_organization_id);
CREATE INDEX idx_org_grants_active ON user_org_grants_mirror(user_id, is_active) WHERE is_active = true;
```

#### New Function: `user_has_org_access`

```sql
CREATE OR REPLACE FUNCTION user_has_org_access(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_org_grants_mirror
    WHERE user_id = p_user_id 
      AND crm_organization_id = p_org_id 
      AND is_active = true
  );
$$;
```

#### New Function: `get_user_org_ids`

```sql
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id UUID)
RETURNS UUID[] 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT COALESCE(
    array_agg(crm_organization_id),
    ARRAY[]::UUID[]
  )
  FROM user_org_grants_mirror
  WHERE user_id = p_user_id AND is_active = true;
$$;
```

#### RLS Policies

```sql
ALTER TABLE user_org_grants_mirror ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own grants"
  ON user_org_grants_mirror
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON user_org_grants_mirror
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Backend Scope

#### Edge Function Handler: `handleOrgAccessUpdated`

```typescript
async function handleOrgAccessUpdated(payload: OrgAccessUpdatedPayload) {
  const { user_id, org_access_seq, grants } = payload;
  
  // Sequence guard - reject out-of-order events
  const { data: existing } = await supabase
    .from('user_org_grants_mirror')
    .select('org_access_seq')
    .eq('user_id', user_id)
    .order('org_access_seq', { ascending: false })
    .limit(1)
    .single();
  
  if (existing && existing.org_access_seq >= org_access_seq) {
    console.warn(`Out-of-order org_access event: received seq ${org_access_seq}, have ${existing.org_access_seq}`);
    return { status: 'skipped', reason: 'out_of_order' };
  }
  
  // Replace all grants for user with new snapshot
  await supabase
    .from('user_org_grants_mirror')
    .delete()
    .eq('user_id', user_id);
  
  if (grants && grants.length > 0) {
    await supabase
      .from('user_org_grants_mirror')
      .insert(grants.map(g => ({
        user_id,
        crm_organization_id: g.organization_id,
        role_in_org: g.role,
        is_active: g.is_active,
        org_access_seq
      })));
  }
  
  return { status: 'processed' };
}
```

#### Expected Payload Schema

```typescript
interface OrgAccessUpdatedPayload {
  user_id: string;
  org_access_seq: number;
  grants: Array<{
    organization_id: string;
    role: 'viewer' | 'sales_rep' | 'sales_manager' | 'org_admin';
    is_active: boolean;
  }>;
}
```

### UI Scope

- None (infrastructure)

### Feature Scope

- Multi-org RLS foundation for all org-scoped tables

### Forms Scope

- None

### Permissions Scope

| Change | Description |
|--------|-------------|
| New RLS helper | `user_has_org_access()` available for all policies |
| New RLS helper | `get_user_org_ids()` available for array filtering |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #1 | User with only MOD access cannot see JTR data | ✅ |
| #2 | Multi-org manager can toggle Org Scope | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-ORG-01 | As a user with MOD-only access, I cannot see JTR organization data |
| US-ORG-02 | As a multi-org manager, I can switch between organizations I have access to |

### Done Proof

| Check | Method |
|-------|--------|
| Table populated | Send `org_access.updated` event, verify rows in `user_org_grants_mirror` |
| Function works | `SELECT user_has_org_access('user-uuid', 'org-uuid')` returns correct boolean |
| Sequence guard | Send older seq, verify warning log and no data change |
| Grant replacement | Send new grants, verify old grants deleted |

### QA Test IDs

- RLS-01: User sees only permitted org data
- RLS-02: Multi-org user can switch context
- RLS-03: Out-of-order sequence rejected
- F-01: Org grants snapshot replacement
- D-01: Missing org access handled gracefully

---

## Batch 3: Reservations Schema Extensions

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1.5 |
| **Priority** | P0 — Schema Foundation |
| **Dependencies** | Batch 1 |
| **CRM Required** | No |

### Contract Scope

- **Events**: Prepares for `reservation.allocation_planned`, `reservation.allocated`
- **Purpose**: Add missing reservation columns per contract Section 13.3

### DB Scope

#### Alter Table: `reservations`

```sql
-- Supply request linkage
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS crm_supply_request_id UUID;

-- Ship intent (from CRM deal)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ship_intent TEXT DEFAULT 'unknown'
  CHECK (ship_intent IN ('unknown', 'ex_works', 'delivered', 'customer_pickup'));

-- Expected ship date
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ship_date DATE;

-- Allocation tracking
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS allocation_state TEXT DEFAULT 'unallocated'
  CHECK (allocation_state IN ('unallocated', 'planned', 'allocated', 'partially_allocated'));

-- Action flags for workflow
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS action_required BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS action_required_reason TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_allocation_state ON reservations(allocation_state);
CREATE INDEX IF NOT EXISTS idx_reservations_action_required ON reservations(action_required) WHERE action_required = true;
CREATE INDEX IF NOT EXISTS idx_reservations_ship_date ON reservations(ship_date);
```

#### Alter Table: `reservation_lines`

```sql
-- CRM deal line linkage
ALTER TABLE reservation_lines ADD COLUMN IF NOT EXISTS crm_deal_line_id UUID;

-- Unit of measure
ALTER TABLE reservation_lines ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'MT'
  CHECK (uom IN ('MT', 'KG', 'M', 'YD', 'PCS'));

-- Lab workflow state (Journey #83)
ALTER TABLE reservation_lines ADD COLUMN IF NOT EXISTS lab_workflow_state TEXT DEFAULT 'not_requested'
  CHECK (lab_workflow_state IN ('not_requested', 'requested', 'in_progress', 'sent_to_customer', 'approved', 'rejected'));

ALTER TABLE reservation_lines ADD COLUMN IF NOT EXISTS lab_state_updated_at TIMESTAMPTZ;
ALTER TABLE reservation_lines ADD COLUMN IF NOT EXISTS lab_state_updated_by UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reservation_lines_deal_line ON reservation_lines(crm_deal_line_id);
CREATE INDEX IF NOT EXISTS idx_reservation_lines_lab_state ON reservation_lines(lab_workflow_state);
```

### Backend Scope

#### Update: `wms-webhook-receiver` → `handleDealWon`

| Field | Source |
|-------|--------|
| `crm_supply_request_id` | Payload `supply_request_id` |
| `ship_intent` | Payload `ship_intent` |
| `ship_date` | Payload `expected_ship_date` |
| `allocation_state` | Default `'unallocated'` |

### UI Scope

#### Amend: `/reservations` Page

| Column | Display |
|--------|---------|
| `allocation_state` | Badge: gray=unallocated, yellow=planned, green=allocated |
| `ship_intent` | Text with icon |
| `ship_date` | Date formatted |
| `action_required` | Warning icon if true |

### Feature Scope

| Feature | Description |
|---------|-------------|
| Allocation state display | Show allocation progress on reservation list |
| Lab workflow visibility | Show lab state badges on reservation lines |

### Forms Scope

#### Amend: `ReservationDialog`

| Field | Type | Editable |
|-------|------|----------|
| `allocation_state` | Badge | Read-only |
| `ship_intent` | Text | Read-only (from CRM) |
| `ship_date` | Date | Read-only (from CRM) |

### Permissions Scope

- No changes (existing RLS applies)

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #10 | Human Gates tabs on /fulfillment | ✅ (partial) |
| #83 | Lab Workflow states | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-RES-01 | As a WMS operator, I can see the allocation state of a reservation |
| US-RES-02 | As a WMS operator, I can see which reservations are backed by supply requests |
| US-RES-03 | As a WMS operator, I can see lab workflow state on reservation lines |

### Done Proof

| Check | Method |
|-------|--------|
| Columns exist | `SELECT allocation_state, ship_intent, lab_workflow_state FROM reservations r JOIN reservation_lines rl ON r.id = rl.reservation_id LIMIT 1` |
| UI displays | Navigate to `/reservations`, verify new columns visible |
| Lab state badge | View reservation detail, verify lab workflow badge on lines |

### QA Test IDs

- FUL-01: Reservation shows allocation state
- LAB-01: Lab workflow state visible on lines

---

## Batch 4: Orders Schema Extensions + PO Number Generator

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P0 — Schema Foundation |
| **Dependencies** | Batch 1 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `order.created` | WMS → CRM | `wms:order:{id}:created:v1` |

### DB Scope

#### Alter Table: `orders`

```sql
-- PO Number (primary identifier)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number TEXT UNIQUE;

-- CRM linkage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_organization_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_deal_id UUID;

-- Override tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_used BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_reason TEXT
  CHECK (override_reason IS NULL OR override_reason IN (
    'urgent_customer_request',
    'manager_discretion', 
    'system_unavailable',
    'credit_exception',
    'other'
  ));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_by UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;

-- Status sequence for event ordering
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status_seq INTEGER DEFAULT 0;

-- Invoice tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'not_issued'
  CHECK (invoice_status IN ('not_issued', 'pending', 'issued', 'paid'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_control_status TEXT DEFAULT 'pending_control'
  CHECK (invoice_control_status IN ('pending_control', 'passed', 'failed', 'bypassed'));

-- Carrier preference (Journey #84)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS use_customer_carrier BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_carrier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_carrier_account TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_carrier_instructions TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_po_number ON orders(po_number);
CREATE INDEX IF NOT EXISTS idx_orders_crm_org ON orders(crm_organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_crm_deal ON orders(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_control ON orders(invoice_control_status);
```

#### Alter Table: `order_lots`

```sql
-- CRM deal line linkage
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS crm_deal_line_id UUID;

-- Unit of measure
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'MT'
  CHECK (uom IN ('MT', 'KG', 'M', 'YD', 'PCS'));

-- Design/Printing reference (Journey #82)
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS design_asset_id UUID;
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS print_request_id UUID;

-- Issue tracking
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS issue_blocked BOOLEAN DEFAULT false;
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS issue_id UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_lots_deal_line ON order_lots(crm_deal_line_id);
CREATE INDEX IF NOT EXISTS idx_order_lots_issue_blocked ON order_lots(issue_blocked) WHERE issue_blocked = true;
```

#### New Function: `generate_po_number`

```sql
-- Non-sequential PO number generator (per Checklist requirement)
CREATE OR REPLACE FUNCTION generate_po_number(p_org_prefix TEXT DEFAULT 'WMS')
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code (Crockford Base32 style)
    v_code := p_org_prefix || 'P' || upper(substring(encode(gen_random_bytes(5), 'hex') FROM 1 FOR 8));
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM orders WHERE po_number = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique PO number after 10 attempts';
    END IF;
  END LOOP;
END;
$$;
```

#### New Trigger: `increment_order_status_seq`

```sql
CREATE OR REPLACE FUNCTION increment_order_status_seq()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.order_status_seq := OLD.order_status_seq + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_status_seq
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_order_status_seq();
```

### Backend Scope

#### Update: Order Creation

```typescript
// Auto-generate PO number on order creation
const { data: poNumber } = await supabase
  .rpc('generate_po_number', { p_org_prefix: orgPrefix || 'WMS' });

const order = {
  ...orderData,
  po_number: poNumber,
  crm_organization_id: orgId,
  crm_deal_id: dealId
};
```

#### Update: `dispatchOrderCreated`

```typescript
interface OrderCreatedPayload {
  event: 'order.created';
  idempotency_key: string; // wms:order:{id}:created:v1
  wms_order_id: string;
  po_number: string;
  crm_deal_id: string;
  crm_organization_id: string;
  reservation_id: string;
  created_at: string;
  lines: Array<{
    crm_deal_line_id: string;
    wms_order_line_id: string;
    quality_code: string;
    color_code: string;
    meters: number;
    uom: string;
    lot_id?: string;
    roll_id?: string;
  }>;
  use_customer_carrier: boolean;
  customer_carrier_name?: string;
}
```

### UI Scope

#### Amend: `/orders` Page

| Column | Display | Priority |
|--------|---------|----------|
| `po_number` | Primary identifier (bold) | 1st column |
| `override_used` | Warning badge if true | Near status |
| `invoice_control_status` | Badge | After status |

#### Amend: `/orders/:id` Detail

| Section | Fields |
|---------|--------|
| Header | PO Number (large), Status, Invoice Control Status |
| Override Info | Show if `override_used = true`: reason, notes, who, when |
| Carrier Info | Show if `use_customer_carrier = true`: carrier details |

### Feature Scope

| Feature | Description |
|---------|-------------|
| PO number generation | Auto-generate on order creation |
| Override tracking | Record when WMS manager overrides CRM approval |
| Carrier preference | Store and display customer carrier preferences |

### Forms Scope

#### Order Creation

| Field | Type | Auto/Manual |
|-------|------|-------------|
| `po_number` | Text | Auto-generated |
| `crm_organization_id` | UUID | From context |
| `crm_deal_id` | UUID | From reservation |

### Permissions Scope

- No changes (existing RLS applies)

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #6 | Org-prefixed, non-sequential identifiers | ✅ |
| #7 | Deal code generator | ✅ (PO number) |
| #82 | Design/Printing references | ✅ |
| #84 | Carrier Preference | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-ORD-01 | As a WMS operator, I see PO number as the primary order identifier |
| US-ORD-02 | As a WMS operator, PO number is auto-generated when creating an order |
| US-ORD-03 | As a WMS operator, I can see if an order used a manager override |
| US-ORD-04 | As a WMS operator, I can see customer carrier preferences |

### Done Proof

| Check | Method |
|-------|--------|
| PO number format | Create order, verify format `{ORG}P{8-CHAR}` |
| Uniqueness | Attempt duplicate, verify rejection |
| Event payload | Create order, verify `order.created` includes `po_number` |
| Status seq | Update status twice, verify `order_status_seq = 2` |

### QA Test IDs

- ID-01: PO number format validation
- ID-02: PO number uniqueness
- ID-03: Status sequence increment
- ORD-01: Order created event includes all fields

---

## Batch 5: Supply Requests Mirror + Events

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2 |
| **Priority** | P1 — Integration |
| **Dependencies** | Batch 1 |
| **CRM Required** | Yes — must emit `supply_request.created` |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `supply_request.created` | CRM → WMS | `crm:supply_request:{id}:created:v1` |
| `supply_request.status_updated` | WMS → CRM | `wms:supply_request:{id}:status_updated:v1` |

### DB Scope

#### New Table: `supply_requests`

```sql
CREATE TABLE supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- CRM linkage
  crm_supply_request_id UUID NOT NULL UNIQUE,
  crm_deal_id UUID NOT NULL,
  crm_customer_id UUID,
  crm_organization_id UUID,
  requested_for_org_id UUID NOT NULL, -- Mandatory per Appendix
  
  -- Type and status
  type TEXT NOT NULL CHECK (type IN ('manufacturing', 'import_from_central')),
  status TEXT DEFAULT 'planned' CHECK (status IN (
    'planned',
    'eta_confirmed', 
    'in_transit', 
    'arrived_soft',  -- Key state per Checklist
    'allocated', 
    'closed', 
    'cancelled'
  )),
  
  -- Product details
  quality_code TEXT NOT NULL,
  color_code TEXT,
  meters NUMERIC(12,2) NOT NULL,
  uom TEXT DEFAULT 'MT' CHECK (uom IN ('MT', 'KG', 'M', 'YD', 'PCS')),
  
  -- Dates
  eta_date DATE,
  arrived_at TIMESTAMPTZ,
  allocated_at TIMESTAMPTZ,
  
  -- Linkage
  manufacturing_order_id UUID REFERENCES manufacturing_orders(id),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_supply_requests_crm_id ON supply_requests(crm_supply_request_id);
CREATE INDEX idx_supply_requests_status ON supply_requests(status);
CREATE INDEX idx_supply_requests_org ON supply_requests(requested_for_org_id);
CREATE INDEX idx_supply_requests_deal ON supply_requests(crm_deal_id);
CREATE INDEX idx_supply_requests_eta ON supply_requests(eta_date) WHERE status IN ('planned', 'eta_confirmed', 'in_transit');
```

#### RLS Policies

```sql
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view supply requests for their orgs"
  ON supply_requests
  FOR SELECT
  USING (
    requested_for_org_id = ANY(get_user_org_ids(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'senior_manager', 'warehouse_staff')
    )
  );

CREATE POLICY "Warehouse staff can update supply request status"
  ON supply_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'senior_manager', 'warehouse_staff')
    )
  );
```

### Backend Scope

#### Edge Function Handler: `handleSupplyRequestCreated`

```typescript
async function handleSupplyRequestCreated(payload: SupplyRequestCreatedPayload) {
  const { data, error } = await supabase
    .from('supply_requests')
    .upsert({
      crm_supply_request_id: payload.supply_request_id,
      crm_deal_id: payload.deal_id,
      crm_customer_id: payload.customer_id,
      crm_organization_id: payload.organization_id,
      requested_for_org_id: payload.requested_for_org_id,
      type: payload.type,
      status: 'planned',
      quality_code: payload.quality_code,
      color_code: payload.color_code,
      meters: payload.meters,
      uom: payload.uom || 'MT',
      eta_date: payload.eta_date
    }, {
      onConflict: 'crm_supply_request_id'
    });
  
  return { status: 'processed', supply_request_id: data?.id };
}
```

#### Dispatcher: `dispatchSupplyRequestStatusUpdated`

```typescript
async function dispatchSupplyRequestStatusUpdated(
  supplyRequestId: string,
  newStatus: string,
  metadata?: { arrived_at?: string; notes?: string }
) {
  const { data: sr } = await supabase
    .from('supply_requests')
    .select('*')
    .eq('id', supplyRequestId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'supply_request.status_updated',
    idempotency_key: `wms:supply_request:${supplyRequestId}:status_updated:v1`,
    crm_supply_request_id: sr.crm_supply_request_id,
    wms_supply_request_id: supplyRequestId,
    new_status: newStatus,
    previous_status: sr.status,
    updated_at: new Date().toISOString(),
    metadata
  });
}
```

### UI Scope

#### New Page: `/supply-requests`

| Component | Description |
|-----------|-------------|
| Header | "Supply Requests" with filter controls |
| Filters | Type, Status, Quality, ETA Date Range |
| Table | Columns: Type, Quality, Color, Meters, ETA, Status, Actions |
| Status Badges | planned=gray, eta_confirmed=blue, in_transit=yellow, arrived_soft=green, allocated=purple |
| Row Actions | "Mark In Transit", "Mark Arrived (Soft)", "View Details" |

#### Page Route

```typescript
// In App.tsx routing
<Route path="/supply-requests" element={<SupplyRequests />} />
```

### Feature Scope

| Feature | Description |
|---------|-------------|
| View supply requests | List all supply requests from CRM |
| Update status | Transition through status workflow |
| Emit events | Send status updates to CRM |
| Filter by type | Manufacturing vs Import from Central |

### Forms Scope

#### Supply Request Status Update Form

| Field | Type | Required |
|-------|------|----------|
| `status` | Dropdown | Yes |
| `eta_date` | Date picker | If status = 'eta_confirmed' |
| `notes` | Textarea | No |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| View supply requests | warehouse_staff, senior_manager, admin |
| Update status | warehouse_staff, senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #11 | /supply-tracking page | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-SUP-01 | As a WMS operator, I can view manufacturing/import requests from CRM |
| US-SUP-02 | As a WMS operator, I can mark supply as in transit |
| US-SUP-03 | As a WMS operator, I can mark supply as arrived (soft) |
| US-SUP-04 | As a WMS operator, I can see ETA dates for incoming supply |

### Done Proof

| Check | Method |
|-------|--------|
| Page accessible | Navigate to `/supply-requests`, page loads |
| Event creates row | Send `supply_request.created`, verify row in table |
| Status update emits | Change status, verify `supply_request.status_updated` in outbox |
| Arrived (Soft) badge | Mark arrived, verify green badge displayed |

### QA Test IDs

- SUP-01: Supply request creation from CRM event
- SUP-02: Status transition workflow
- SUP-03: Arrived (Soft) state handling
- SUP-04: Event emission on status change

---

## Batch 6: stock.changed Event

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1.5 |
| **Priority** | P1 — Integration |
| **Dependencies** | Batch 1 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `stock.changed` | WMS → CRM | `wms:stock:{transaction_batch_id}:changed:v1` |

### DB Scope

#### New Table: `stock_transactions`

```sql
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Transaction details
  reason TEXT NOT NULL CHECK (reason IN (
    'receipt',
    'fulfillment', 
    'adjustment',
    'transfer',
    'count'
  )),
  
  -- Org scoping
  crm_organization_id UUID,
  
  -- Audit
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by UUID,
  
  -- Event tracking
  emitted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_stock_transactions_batch ON stock_transactions(transaction_batch_id);
CREATE INDEX idx_stock_transactions_reason ON stock_transactions(reason);
CREATE INDEX idx_stock_transactions_org ON stock_transactions(crm_organization_id);
CREATE INDEX idx_stock_transactions_emitted ON stock_transactions(emitted_at) WHERE emitted_at IS NULL;
```

### Backend Scope

#### Update: `dispatchStockChanged` (v1.0.23 Schema)

```typescript
interface StockChangedPayload {
  event: 'stock.changed';
  idempotency_key: string; // wms:stock:{transaction_batch_id}:changed:v1
  transaction_batch_id: string;
  crm_organization_id: string | null;
  changed_at: string;
  reason: 'receipt' | 'fulfillment' | 'adjustment' | 'transfer' | 'count';
  items: Array<{
    quality_code: string;
    color_code: string | null;
    warehouse_id: string | null;
    uom: 'MT' | 'KG';
    on_hand_meters: number;
    reserved_meters: number;
    available_meters: number;
    delta_meters: number;
  }>;
  changed_by: string | null;
}

async function dispatchStockChanged(
  transactionBatchId: string,
  reason: string,
  items: StockItem[],
  orgId?: string,
  changedBy?: string
) {
  const payload: StockChangedPayload = {
    event: 'stock.changed',
    idempotency_key: `wms:stock:${transactionBatchId}:changed:v1`,
    transaction_batch_id: transactionBatchId,
    crm_organization_id: orgId || null,
    changed_at: new Date().toISOString(),
    reason,
    items: items.map(item => ({
      quality_code: item.quality_code,
      color_code: item.color_code || null,
      warehouse_id: item.warehouse_id || null,
      uom: item.uom || 'MT',
      on_hand_meters: item.on_hand_meters,
      reserved_meters: item.reserved_meters,
      available_meters: item.on_hand_meters - item.reserved_meters,
      delta_meters: item.delta_meters
    })),
    changed_by: changedBy || null
  };
  
  await dispatchWebhookEvent(payload);
  
  // Mark transaction as emitted
  await supabase
    .from('stock_transactions')
    .update({ emitted_at: new Date().toISOString() })
    .eq('transaction_batch_id', transactionBatchId);
}
```

#### Integration Points

| Action | Trigger |
|--------|---------|
| Lot receipt | After `lots` insert |
| Roll receipt | After `rolls` insert |
| Order fulfillment | After order status → 'fulfilled' |
| Stock adjustment | After manual adjustment |
| Stock take reconciliation | After count session reconciled |

### UI Scope

- None (background event)

### Feature Scope

| Feature | Description |
|---------|-------------|
| Batch transactions | Group related changes into single event |
| Snapshot fields | Include on_hand, reserved, available, delta |
| Reason tracking | Categorize change reason |

### Forms Scope

- None

### Permissions Scope

- None

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #16 | Mirrors/caches updated by stock.changed | ✅ |
| #81 | Ingest stock.changed and update caches | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-STK-01 | As a system, inventory changes are synced to CRM in real-time |
| US-STK-02 | As CRM, I receive stock snapshots with delta and absolute values |
| US-STK-03 | As a system, duplicate events are handled idempotently |

### Done Proof

| Check | Method |
|-------|--------|
| Event emitted on receipt | Create lot, verify `stock.changed` in outbox |
| Payload format | Verify `items[]` array with snapshot fields |
| Idempotency key | Verify format `wms:stock:{uuid}:changed:v1` |
| Replay handling | Emit same batch_id twice, verify no duplicate effects |

### QA Test IDs

- E-01: stock.changed scope keys
- STK-01: Event emission on inventory change
- STK-02: Payload schema compliance

---

## Batch 7: Allocation Planning + Entry Pages

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P1 — Workflow |
| **Dependencies** | Batch 3, Batch 5 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `reservation.allocation_planned` | WMS → CRM | `wms:reservation:{id}:allocation_planned:v1` |
| `reservation.allocated` | WMS → CRM | `wms:reservation:{id}:allocated:v1` |

### DB Scope

- Uses columns from Batch 3 (`allocation_state`, `lab_workflow_state`)

### Backend Scope

#### Dispatcher: `dispatchReservationAllocationPlanned`

```typescript
async function dispatchReservationAllocationPlanned(reservationId: string) {
  const { data: reservation } = await supabase
    .from('reservations')
    .select(`
      *,
      reservation_lines (*)
    `)
    .eq('id', reservationId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'reservation.allocation_planned',
    idempotency_key: `wms:reservation:${reservationId}:allocation_planned:v1`,
    wms_reservation_id: reservationId,
    crm_deal_id: reservation.crm_deal_id,
    crm_organization_id: reservation.crm_organization_id,
    planned_at: new Date().toISOString(),
    lines: reservation.reservation_lines.map(line => ({
      crm_deal_line_id: line.crm_deal_line_id,
      quality_code: line.quality_code,
      color_code: line.color_code,
      meters: line.meters,
      uom: line.uom
    }))
  });
}
```

#### Dispatcher: `dispatchReservationAllocated`

```typescript
async function dispatchReservationAllocated(
  reservationId: string,
  allocations: AllocationEntry[]
) {
  const { data: reservation } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'reservation.allocated',
    idempotency_key: `wms:reservation:${reservationId}:allocated:v1`,
    wms_reservation_id: reservationId,
    crm_deal_id: reservation.crm_deal_id,
    crm_organization_id: reservation.crm_organization_id,
    allocated_at: new Date().toISOString(),
    allocations: allocations.map(a => ({
      crm_deal_line_id: a.crm_deal_line_id,
      wms_lot_id: a.lot_id,
      wms_roll_id: a.roll_id,
      quality_code: a.quality_code,
      color_code: a.color_code,
      meters: a.meters,
      uom: a.uom
    }))
  });
}
```

### UI Scope

#### New Page: `/allocation-planning`

| Component | Description |
|-----------|-------------|
| Header | "Allocation Planning" with filters |
| Filters | Quality, Color, Ship Date Range, Allocation State |
| Table | Reservations with `allocation_state = 'unallocated'` backed by arrived supply |
| Selection | Multi-select checkboxes |
| Action | "Plan Selected" button |
| Lab State | Show lab_workflow_state badge per line (block if 'rejected') |

#### New Page: `/allocation-entry`

| Component | Description |
|-----------|-------------|
| Header | "Allocation Entry" |
| Filters | Quality, Color, Planned Date |
| Table | Reservations with `allocation_state = 'planned'` |
| Entry Form | Lot/Roll/Meters input per line |
| Validation | Meters cannot exceed available in lot |
| Action | "Confirm Allocation" button |

#### Page Routes

```typescript
<Route path="/allocation-planning" element={<AllocationPlanning />} />
<Route path="/allocation-entry" element={<AllocationEntry />} />
```

### Feature Scope

| Feature | Description |
|---------|-------------|
| Plan allocations | Set allocation_state = 'planned', emit event |
| Enter allocations | Link specific lots/rolls, emit event |
| Lab state blocking | Prevent allocation of lines with rejected lab state |
| Supply matching | Show only reservations backed by arrived supply |

### Forms Scope

#### Allocation Planning Form

| Field | Type | Description |
|-------|------|-------------|
| Selected reservations | Checkbox list | Multi-select |
| Notes | Textarea | Optional planning notes |

#### Allocation Entry Form

| Field | Type | Validation |
|-------|------|------------|
| `lot_id` | Dropdown | Required, must have available stock |
| `roll_id` | Dropdown | Optional, filter by lot |
| `meters` | Number | Required, ≤ available |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| `allocations:plan` | warehouse_staff, senior_manager, admin |
| `allocations:enter` | warehouse_staff, senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #19 | Warehouse staff handles allocation in WMS | ✅ |
| #83 | Lab Workflow visibility in allocation | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-ALC-01 | As a WMS operator, I can plan which reservations will be fulfilled from arrived supply |
| US-ALC-02 | As a WMS operator, I can enter specific lots/rolls for planned allocations |
| US-ALC-03 | As a WMS operator, I cannot allocate lines with rejected lab status |
| US-ALC-04 | As CRM, I receive allocation events to update deal status |

### Done Proof

| Check | Method |
|-------|--------|
| Page accessible | Navigate to `/allocation-planning` |
| Planning emits event | Plan reservation, verify `reservation.allocation_planned` in outbox |
| Entry emits event | Enter allocation, verify `reservation.allocated` in outbox |
| Lab blocking | Attempt to allocate rejected line, verify blocked |

### QA Test IDs

- ALC-01: Allocation planning workflow
- ALC-02: Allocation entry validation
- ALC-03: Lab state blocking
- FUL-01: Human gates workflow

---

## Batch 8: Shipment Approval + Override

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P1 — Workflow |
| **Dependencies** | Batch 4, Batch 7 |
| **CRM Required** | Yes — must emit `shipment.approved` |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `shipment.approved` | CRM → WMS | `crm:reservation:{id}:shipment_approved:v1` |

### DB Scope

- Uses columns from Batch 4 (override_*, customer_carrier_*)

### Backend Scope

#### Edge Function Handler: `handleShipmentApproved`

```typescript
async function handleShipmentApproved(payload: ShipmentApprovedPayload) {
  const { reservation_id, deal_id, approved_by, use_customer_carrier, carrier_details } = payload;
  
  // Get reservation
  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, reservation_lines(*)')
    .eq('id', reservation_id)
    .single();
  
  if (!reservation) {
    throw new Error(`Reservation ${reservation_id} not found`);
  }
  
  // Generate PO number
  const { data: poNumber } = await supabase.rpc('generate_po_number', { 
    p_org_prefix: payload.org_prefix || 'WMS' 
  });
  
  // Create order
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      po_number: poNumber,
      reservation_id: reservation.id,
      crm_deal_id: deal_id,
      crm_organization_id: reservation.crm_organization_id,
      customer_name: reservation.customer_name,
      status: 'confirmed',
      use_customer_carrier: use_customer_carrier || false,
      customer_carrier_name: carrier_details?.name,
      customer_carrier_account: carrier_details?.account,
      customer_carrier_instructions: carrier_details?.instructions
    })
    .select()
    .single();
  
  // Create order lines
  await supabase
    .from('order_lots')
    .insert(reservation.reservation_lines.map(line => ({
      order_id: order.id,
      crm_deal_line_id: line.crm_deal_line_id,
      lot_id: line.lot_id,
      quality_code: line.quality_code,
      color_code: line.color_code,
      meters: line.meters,
      uom: line.uom
    })));
  
  // Emit order.created
  await dispatchOrderCreated(order.id);
  
  return { status: 'processed', order_id: order.id, po_number: poNumber };
}
```

#### Override Function

```typescript
async function createOrderWithOverride(
  reservationId: string,
  overrideReason: string,
  overrideNotes: string,
  userId: string
) {
  const { data: poNumber } = await supabase.rpc('generate_po_number');
  
  const { data: order } = await supabase
    .from('orders')
    .insert({
      po_number: poNumber,
      reservation_id: reservationId,
      status: 'confirmed',
      override_used: true,
      override_reason: overrideReason,
      override_notes: overrideNotes,
      override_by: userId,
      override_at: new Date().toISOString()
    })
    .select()
    .single();
  
  await dispatchOrderCreated(order.id);
  
  return order;
}
```

### UI Scope

#### New Page: `/approvals/shipment`

| Component | Description |
|-----------|-------------|
| Header | "Shipment Approvals" |
| Tabs | "Pending CRM Approval", "Ready to Ship", "Override Queue" |
| Table | Reservations with `action_required = true` AND `action_required_reason = 'needs_shipment_approval'` |
| Row Details | Customer, Quality, Meters, Ship Intent, Expected Date |
| Actions | "Override" button (senior_manager only) |

#### Override Dialog

| Field | Type | Required |
|-------|------|----------|
| `override_reason` | Dropdown (locked enum) | Yes |
| `override_notes` | Textarea | Yes (min 20 chars) |

#### Override Reason Enum

```typescript
const OVERRIDE_REASONS = [
  { value: 'urgent_customer_request', label: 'Urgent Customer Request' },
  { value: 'manager_discretion', label: 'Manager Discretion' },
  { value: 'system_unavailable', label: 'CRM System Unavailable' },
  { value: 'credit_exception', label: 'Credit Exception Approved' },
  { value: 'other', label: 'Other (specify in notes)' }
] as const;
```

### Feature Scope

| Feature | Description |
|---------|-------------|
| Receive approval | CRM approval creates WMS order |
| Manager override | Senior manager can override without CRM |
| Carrier prefill | Copy carrier preferences from approval |
| Audit trail | Record override reason, notes, who, when |

### Forms Scope

#### Override Form

| Field | Validation |
|-------|------------|
| Reason | Required, from locked enum |
| Notes | Required, min 20 characters |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| View approvals | warehouse_staff, senior_manager, admin |
| `shipment:override` | senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #20 | WMS Manager can override with reason codes | ✅ |
| #21 | Warehouse never logs into CRM | ✅ |
| #84 | Carrier Preference handling | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-SHP-01 | As a WMS operator, I see orders created after CRM approves shipment |
| US-SHP-02 | As a WMS manager, I can override shipment approval when needed |
| US-SHP-03 | As a WMS manager, I must provide a reason and notes for override |
| US-SHP-04 | As a WMS operator, I can see customer carrier preferences on orders |

### Done Proof

| Check | Method |
|-------|--------|
| Approval creates order | Send `shipment.approved`, verify order with `po_number` |
| Override works | Click Override, fill form, verify order with `override_used = true` |
| Reason required | Try override without reason, verify blocked |
| Carrier copied | Send approval with carrier, verify order has carrier fields |

### QA Test IDs

- FUL-01: Shipment approval workflow
- FUL-02: Override with reason codes
- SHP-01: Order creation from approval
- SHP-02: Carrier preference mapping

---

## Batch 9: Central Stock Checks (Abra)

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2 |
| **Priority** | P1 — Workflow |
| **Dependencies** | Batch 1 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `central_stock_check.completed` | WMS → CRM | `wms:central_stock_check:{check_id}:completed:v1` |

### DB Scope

#### New Types

```sql
CREATE TYPE central_stock_result AS ENUM (
  'found_in_abra',
  'not_in_abra',
  'uncertain'
);

CREATE TYPE central_stock_next_step AS ENUM (
  'import_from_central',
  'manufacture',
  'needs_central_confirmation'
);
```

#### New Table: `central_stock_checks`

```sql
CREATE TABLE central_stock_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- CRM linkage
  crm_deal_id UUID,
  crm_organization_id UUID,
  
  -- Audit
  checked_at TIMESTAMPTZ DEFAULT now(),
  checked_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_central_checks_deal ON central_stock_checks(crm_deal_id);
CREATE INDEX idx_central_checks_org ON central_stock_checks(crm_organization_id);
```

#### New Table: `central_stock_check_lines`

```sql
CREATE TABLE central_stock_check_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES central_stock_checks(id) ON DELETE CASCADE,
  
  -- CRM linkage
  crm_deal_line_id UUID NOT NULL,
  
  -- Product
  quality_code TEXT NOT NULL,
  color_code TEXT,
  
  -- Results
  result central_stock_result,
  available_qty NUMERIC(12,2),
  proposed_next_step central_stock_next_step,
  eta_text TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_central_check_lines_check ON central_stock_check_lines(check_id);
CREATE INDEX idx_central_check_lines_deal_line ON central_stock_check_lines(crm_deal_line_id);
```

### Backend Scope

#### Dispatcher: `dispatchCentralStockCheckCompleted`

```typescript
async function dispatchCentralStockCheckCompleted(checkId: string) {
  const { data: check } = await supabase
    .from('central_stock_checks')
    .select(`
      *,
      lines:central_stock_check_lines(*)
    `)
    .eq('id', checkId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'central_stock_check.completed',
    idempotency_key: `wms:central_stock_check:${checkId}:completed:v1`,
    check_id: checkId,
    crm_deal_id: check.crm_deal_id,
    crm_organization_id: check.crm_organization_id,
    checked_at: check.checked_at,
    checked_by: check.checked_by,
    lines: check.lines.map(line => ({
      crm_deal_line_id: line.crm_deal_line_id,
      quality_code: line.quality_code,
      color_code: line.color_code,
      result: line.result,
      available_qty: line.available_qty,
      proposed_next_step: line.proposed_next_step,
      eta_text: line.eta_text
    }))
  });
}
```

### UI Scope

#### New Page: `/central-stock-checks`

| Component | Description |
|-----------|-------------|
| Header | "Central Stock Checks (Abra)" |
| Queue | List of deals pending Abra check |
| Entry Form | Per-line result entry |
| Submit | "Complete Check" button |

#### Check Entry Form

| Field | Type | Options |
|-------|------|---------|
| Result | Dropdown | Found in Abra, Not in Abra, Uncertain |
| Available Qty | Number | If found |
| Next Step | Dropdown | Import from Central, Manufacture, Needs Confirmation |
| ETA | Text | Free text (e.g., "2-3 weeks") |
| Notes | Textarea | Optional |

### Feature Scope

| Feature | Description |
|---------|-------------|
| Queue pending checks | Show deals needing Abra verification |
| Enter results | Record result per deal line |
| Emit completion | Send results to CRM |
| Block actions | "Send back (No On-Hand)" blocked until check complete |

### Forms Scope

#### Central Stock Check Form

| Step | Fields |
|------|--------|
| 1 | Select deal from queue |
| 2 | Enter result per line |
| 3 | Confirm and submit |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| `centralstock:check` | warehouse_staff, senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #46 | Abra check queue | ✅ |
| #47 | Abra result entry | ✅ |
| #48 | Abra → Supply Request creation | ✅ (via event) |
| #49 | Abra → Manufacturing request | ✅ (via event) |
| #50 | Abra uncertain handling | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-ABR-01 | As a WMS operator, I can see deals pending Abra check |
| US-ABR-02 | As a WMS operator, I can record Abra check results |
| US-ABR-03 | As CRM, I receive check results to route next steps |
| US-ABR-04 | As a WMS operator, I cannot send back items without completing Abra check |

### Done Proof

| Check | Method |
|-------|--------|
| Page accessible | Navigate to `/central-stock-checks` |
| Queue displays | Verify pending checks shown |
| Results saved | Enter results, verify in database |
| Event emitted | Complete check, verify `central_stock_check.completed` in outbox |

### QA Test IDs

- ABR-01: Queue display
- ABR-02: Result entry validation
- ABR-03: Supply request creation trigger
- ABR-04: Manufacturing request trigger
- ABRA-01: Uncertain result handling
- ABRA-02: Block "Send back" without check

---

## Batch 10: Post-PO Issues (Discrepancy Loop)

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P1 — Workflow |
| **Dependencies** | Batch 4 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `post_po_issue.created` | WMS → CRM | `wms:post_po_issue:{issue_id}:created:v1` |
| `post_po_issue.updated` | WMS → CRM | `wms:post_po_issue:{issue_id}:updated:v1` |
| `post_po_issue.resolved` | WMS → CRM | `wms:post_po_issue:{issue_id}:resolved:v1` |

### DB Scope

#### New Types

```sql
CREATE TYPE post_po_issue_type AS ENUM (
  'shortage',
  'wrong_lot',
  'damaged_roll',
  'quality_mismatch',
  'color_mismatch',
  'lot_swap',
  'other'
);

CREATE TYPE post_po_issue_status AS ENUM (
  'open',
  'proposed',
  'manager_review',
  'resolved',
  'rejected',
  'override'
);
```

#### New Table: `post_po_issues`

```sql
CREATE TABLE post_po_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order linkage
  order_id UUID NOT NULL REFERENCES orders(id),
  po_number TEXT NOT NULL,
  
  -- CRM linkage
  crm_deal_id UUID NOT NULL,
  crm_organization_id UUID,
  
  -- Issue details
  issue_type post_po_issue_type NOT NULL,
  description TEXT,
  status post_po_issue_status DEFAULT 'open',
  
  -- Customer approval
  requires_customer_approval BOOLEAN DEFAULT false,
  customer_approved_at TIMESTAMPTZ,
  
  -- Resolution
  resolution TEXT,
  resolution_note TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX idx_post_po_issues_order ON post_po_issues(order_id);
CREATE INDEX idx_post_po_issues_status ON post_po_issues(status);
CREATE INDEX idx_post_po_issues_deal ON post_po_issues(crm_deal_id);
```

#### New Table: `post_po_issue_lines`

```sql
CREATE TABLE post_po_issue_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES post_po_issues(id) ON DELETE CASCADE,
  
  -- Line linkage
  crm_deal_line_id UUID NOT NULL,
  wms_order_line_id UUID,
  
  -- Issue details
  issue_type post_po_issue_type NOT NULL,
  reason_note TEXT,
  
  -- Quantities
  original_meters NUMERIC(12,2) NOT NULL,
  affected_meters NUMERIC(12,2) NOT NULL,
  
  -- Lot swap
  lot_swap_flagged BOOLEAN DEFAULT false,
  original_lot_id TEXT,
  proposed_lot_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_post_po_issue_lines_issue ON post_po_issue_lines(issue_id);
CREATE INDEX idx_post_po_issue_lines_deal_line ON post_po_issue_lines(crm_deal_line_id);
```

### Backend Scope

#### Dispatchers

```typescript
async function dispatchPostPoIssueCreated(issueId: string) {
  const { data: issue } = await supabase
    .from('post_po_issues')
    .select(`
      *,
      lines:post_po_issue_lines(*)
    `)
    .eq('id', issueId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'post_po_issue.created',
    idempotency_key: `wms:post_po_issue:${issueId}:created:v1`,
    issue_id: issueId,
    po_number: issue.po_number,
    crm_deal_id: issue.crm_deal_id,
    crm_organization_id: issue.crm_organization_id,
    issue_type: issue.issue_type,
    description: issue.description,
    requires_customer_notification: issue.requires_customer_approval,
    suggested_customer_message: generateCustomerMessage(issue),
    lines: issue.lines.map(line => ({
      crm_deal_line_id: line.crm_deal_line_id,
      issue_type: line.issue_type,
      original_meters: line.original_meters,
      affected_meters: line.affected_meters,
      lot_swap_flagged: line.lot_swap_flagged
    })),
    created_at: issue.created_at,
    created_by: issue.created_by
  });
}

function generateCustomerMessage(issue: PostPoIssue): string {
  if (issue.issue_type === 'shortage') {
    const delta = issue.lines.reduce((sum, l) => sum + (l.original_meters - l.affected_meters), 0);
    return `Order quantity adjusted by ${delta} meters due to stock availability.`;
  }
  // ... other message templates
  return '';
}
```

### UI Scope

#### Amend: `/orders/:id` Page

| Addition | Description |
|----------|-------------|
| Issues Section | List of post-PO issues for this order |
| Report Issue Button | Opens PostPoIssueDialog |
| Issue Status Badges | Color-coded by status |

#### New Component: `PostPoIssueDialog`

| Tab | Fields |
|-----|--------|
| Issue Type | Dropdown (shortage, wrong_lot, etc.) |
| Description | Textarea |
| Affected Lines | Multi-select with meters input |
| Lot Swap | Checkbox + lot selector if applicable |

### Feature Scope

| Feature | Description |
|---------|-------------|
| Create issues | Report post-PO issues with line detail |
| Block lines | Mark affected order lines as blocked |
| Update issues | Change status, add notes |
| Resolve issues | Record resolution, unblock lines |
| Customer notification | Include message data in event for CRM |

### Forms Scope

#### Issue Creation Form

| Step | Fields |
|------|--------|
| 1 | Select issue type, enter description |
| 2 | Select affected lines, enter affected meters |
| 3 | Flag lot swap if applicable |
| 4 | Confirm and submit |

#### Issue Resolution Form

| Field | Type |
|-------|------|
| Resolution | Dropdown (adjusted, replaced, cancelled, waived) |
| Resolution Note | Textarea (required) |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| `orders:createissue` | warehouse_staff, senior_manager, admin |
| `orders:resolveissue` | senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #72 | Post-PO discrepancy loop | ✅ |
| #85 | Discrepancy flagging | ✅ |
| #86 | Line blocking | ✅ |
| #87 | Customer notification data | ✅ |
| #93 | WMS post-PO flagging | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-ISS-01 | As a WMS operator, I can report issues discovered after PO creation |
| US-ISS-02 | As a WMS operator, I can specify affected lines and meters |
| US-ISS-03 | As a WMS manager, I can resolve issues and unblock order lines |
| US-ISS-04 | As CRM, I receive issue data including customer notification message |

### Done Proof

| Check | Method |
|-------|--------|
| Create issue | Click "Report Issue", fill form, verify row in `post_po_issues` |
| Lines blocked | Verify affected `order_lots` have `issue_blocked = true` |
| Event emitted | Verify `post_po_issue.created` in outbox |
| Resolve issue | Resolve as manager, verify lines unblocked |

### QA Test IDs

- DPO-01: Issue creation workflow
- DPO-02: Line blocking behavior
- DPO-03: Resolution workflow
- DPO-04: Customer notification data

---

## Batch 11: Costing Module

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 4 |
| **Priority** | P2 — Financial |
| **Dependencies** | Batch 1 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `costing.invoice_posted` | WMS → CRM | `wms:costing_invoice:{invoice_id}:posted:v1` |
| `costing.receipt_linked` | WMS → CRM | `wms:costing_receipt:{receipt_id}:linked:v1` |
| `costing.adjustment_posted` | WMS → CRM | `wms:costing_adjustment:{adjustment_id}:posted:v1` |
| `costing.wac_updated` | WMS → CRM | `wms:wac:{quality_code}-{wac_update_id}:updated:v1` |

### DB Scope

#### New Table: `supplier_invoices`

```sql
CREATE TABLE supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Org scoping
  crm_organization_id UUID,
  
  -- Supplier
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  
  -- Invoice details
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  
  -- Currency
  original_currency TEXT NOT NULL CHECK (original_currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  original_amount NUMERIC(14,2) NOT NULL,
  selected_fx_rate NUMERIC(10,6) NOT NULL,
  fx_rate_source TEXT DEFAULT 'manual' CHECK (fx_rate_source IN ('manual', 'tcmb', 'api')),
  try_amount NUMERIC(14,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'adjusted')),
  
  -- Audit
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_supplier_invoices_org ON supplier_invoices(crm_organization_id);
CREATE INDEX idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX idx_supplier_invoices_status ON supplier_invoices(status);
```

#### New Table: `supplier_invoice_lines`

```sql
CREATE TABLE supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  
  -- Inventory linkage
  lot_id UUID,
  roll_id UUID,
  
  -- Product
  quality_code TEXT NOT NULL,
  color_code TEXT,
  
  -- Quantities
  uom TEXT DEFAULT 'MT' CHECK (uom IN ('MT', 'KG', 'M', 'YD', 'PCS')),
  quantity NUMERIC(12,2) NOT NULL,
  
  -- Pricing
  unit_price NUMERIC(12,4) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  unit_cost_try NUMERIC(12,4) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoice_lines_invoice ON supplier_invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_lot ON supplier_invoice_lines(lot_id);
```

#### New Table: `costing_adjustments`

```sql
CREATE TABLE costing_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Org scoping
  crm_organization_id UUID,
  
  -- Adjustment details
  component_type TEXT NOT NULL CHECK (component_type IN (
    'freight',
    'customs_duty',
    'insurance',
    'handling',
    'other'
  )),
  
  -- Amounts
  amount_original NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  fx_rate_used NUMERIC(10,6) NOT NULL,
  amount_try NUMERIC(14,2) NOT NULL,
  
  -- Allocation
  applies_to JSONB NOT NULL, -- [{lot_id, roll_id, allocation_pct}]
  
  -- Audit
  posted_at TIMESTAMPTZ DEFAULT now(),
  posted_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_costing_adjustments_org ON costing_adjustments(crm_organization_id);
CREATE INDEX idx_costing_adjustments_type ON costing_adjustments(component_type);
```

#### New Table: `quality_wac`

```sql
CREATE TABLE quality_wac (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product
  quality_code TEXT NOT NULL,
  color_code TEXT,
  warehouse_id UUID,
  
  -- WAC values
  wac_per_meter_try NUMERIC(12,4) NOT NULL,
  total_meters NUMERIC(14,2) NOT NULL,
  total_cost_try NUMERIC(14,2) NOT NULL,
  
  -- Audit
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uniqueness
  UNIQUE(quality_code, color_code, warehouse_id)
);

CREATE INDEX idx_quality_wac_quality ON quality_wac(quality_code);
```

#### New Table: `fx_rate_selections`

```sql
CREATE TABLE fx_rate_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES supplier_invoices(id),
  
  -- Rate
  rate_at_selection NUMERIC(10,6) NOT NULL,
  currency_pair TEXT NOT NULL, -- e.g., 'USD/TRY'
  
  -- Audit
  selected_at TIMESTAMPTZ DEFAULT now(),
  selected_by UUID NOT NULL
);

CREATE INDEX idx_fx_selections_invoice ON fx_rate_selections(invoice_id);
```

#### Alter Tables

```sql
-- Add costing columns to lots
ALTER TABLE lots ADD COLUMN IF NOT EXISTS unit_cost_try NUMERIC(12,4);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS total_cost_try NUMERIC(14,2);

-- Add costing columns to rolls  
ALTER TABLE rolls ADD COLUMN IF NOT EXISTS unit_cost_try NUMERIC(12,4);
```

### Backend Scope

#### WAC Calculation Function

```sql
CREATE OR REPLACE FUNCTION calculate_wac(
  p_quality_code TEXT,
  p_color_code TEXT DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS NUMERIC(12,4)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_cost NUMERIC(14,2);
  v_total_meters NUMERIC(14,2);
  v_wac NUMERIC(12,4);
BEGIN
  SELECT 
    COALESCE(SUM(total_cost_try), 0),
    COALESCE(SUM(current_meters), 0)
  INTO v_total_cost, v_total_meters
  FROM lots
  WHERE quality_code = p_quality_code
    AND (p_color_code IS NULL OR color_code = p_color_code)
    AND (p_warehouse_id IS NULL OR warehouse_id = p_warehouse_id)
    AND current_meters > 0;
  
  IF v_total_meters > 0 THEN
    v_wac := v_total_cost / v_total_meters;
  ELSE
    v_wac := 0;
  END IF;
  
  -- Upsert WAC record
  INSERT INTO quality_wac (quality_code, color_code, warehouse_id, wac_per_meter_try, total_meters, total_cost_try)
  VALUES (p_quality_code, p_color_code, p_warehouse_id, v_wac, v_total_meters, v_total_cost)
  ON CONFLICT (quality_code, color_code, warehouse_id)
  DO UPDATE SET
    wac_per_meter_try = EXCLUDED.wac_per_meter_try,
    total_meters = EXCLUDED.total_meters,
    total_cost_try = EXCLUDED.total_cost_try,
    last_calculated_at = now();
  
  RETURN v_wac;
END;
$$;
```

#### Event Dispatchers

```typescript
async function dispatchCostingInvoicePosted(invoiceId: string) {
  const { data: invoice } = await supabase
    .from('supplier_invoices')
    .select('*, lines:supplier_invoice_lines(*)')
    .eq('id', invoiceId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'costing.invoice_posted',
    idempotency_key: `wms:costing_invoice:${invoiceId}:posted:v1`,
    invoice_id: invoiceId,
    supplier_id: invoice.supplier_id,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    original_currency: invoice.original_currency,
    original_amount: invoice.original_amount,
    fx_rate: invoice.selected_fx_rate,
    try_amount: invoice.try_amount,
    posted_at: invoice.posted_at,
    lines: invoice.lines.map(l => ({
      lot_id: l.lot_id,
      quality_code: l.quality_code,
      color_code: l.color_code,
      quantity: l.quantity,
      uom: l.uom,
      unit_cost_try: l.unit_cost_try
    }))
  });
}
```

### UI Scope

#### New Page: `/costing/invoices`

| Component | Description |
|-----------|-------------|
| Header | "Supplier Invoices" |
| List | Invoices with status badges |
| Create | "New Invoice" button |
| Detail | Invoice header + lines + FX selection audit |

#### New Page: `/costing/adjustments`

| Component | Description |
|-----------|-------------|
| Header | "Landed Cost Adjustments" |
| List | Adjustments by type |
| Create | "New Adjustment" button |
| Allocation | Multi-select lots/rolls for cost allocation |

### Feature Scope

| Feature | Description |
|---------|-------------|
| Enter invoices | Record supplier invoices with FX |
| FX selection audit | Track rate at selection time |
| Link to inventory | Associate invoice lines with lots/rolls |
| Landed costs | Allocate freight, customs, etc. |
| WAC calculation | Compute weighted average cost |

### Forms Scope

#### Supplier Invoice Form

| Section | Fields |
|---------|--------|
| Header | Supplier, Invoice #, Date, Currency, Amount |
| FX | Rate, Source (manual/TCMB/API) |
| Lines | Lot/Roll, Quality, Color, Qty, Unit Price |

#### Landed Cost Form

| Field | Type |
|-------|------|
| Component Type | Dropdown |
| Amount | Number |
| Currency | Dropdown |
| FX Rate | Number |
| Applies To | Multi-select lots/rolls |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| `costing:view` | accounting, senior_manager, admin |
| `costing:edit` | accounting, admin |
| `costing:post` | senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #75 | Supplier invoice entry | ✅ |
| #76 | FX rate selection | ✅ |
| #77 | Receipt linking | ✅ |
| #78 | Landed cost allocation | ✅ |
| #79 | WAC calculation | ✅ |
| #80 | Costing events to CRM | ✅ |
| #88 | Cost mirrors sync | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-CST-01 | As an accountant, I can enter supplier invoices with FX rates |
| US-CST-02 | As an accountant, I can link invoices to specific lots |
| US-CST-03 | As an accountant, I can allocate landed costs to inventory |
| US-CST-04 | As a manager, I can view WAC by quality |
| US-CST-05 | As CRM, I receive costing events for margin calculations |

### Done Proof

| Check | Method |
|-------|--------|
| Invoice posted | Create and post invoice, verify `costing.invoice_posted` event |
| Lines linked | Verify `lots.unit_cost_try` updated |
| WAC calculated | Call `calculate_wac()`, verify result |
| Adjustment posted | Create adjustment, verify `costing.adjustment_posted` event |

### QA Test IDs

- CST-01: Invoice creation
- CST-02: FX rate audit
- CST-03: Receipt linking
- CST-04: Landed cost allocation
- CST-05: WAC calculation
- CST-06: Event emission

---

## Batch 12: Invoice Control + Fulfillment Gate

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P1 — Workflow |
| **Dependencies** | Batch 4 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `invoice_control.passed` | WMS → CRM | `wms:invoice_control:{wms_order_id}:passed:v1` |
| `invoice_control.failed` | WMS → CRM | `wms:invoice_control:{wms_order_id}:failed:v1` |

### DB Scope

#### New Table: `invoice_control_records`

```sql
CREATE TABLE invoice_control_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order linkage
  order_id UUID NOT NULL REFERENCES orders(id),
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed')),
  
  -- Failure details
  failure_reason TEXT,
  
  -- Notes
  note TEXT,
  
  -- Audit
  checked_at TIMESTAMPTZ DEFAULT now(),
  checked_by UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoice_control_order ON invoice_control_records(order_id);
CREATE INDEX idx_invoice_control_status ON invoice_control_records(status);
```

#### Fulfillment Gate Trigger

```sql
CREATE OR REPLACE FUNCTION enforce_invoice_control_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if transitioning to fulfilled
  IF NEW.status = 'fulfilled' AND OLD.status != 'fulfilled' THEN
    -- Require invoice control to be passed
    IF NEW.invoice_control_status != 'passed' THEN
      RAISE EXCEPTION 'Cannot fulfill order: invoice_control_status must be "passed" (current: %)', NEW.invoice_control_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_control_gate
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_control_gate();
```

### Backend Scope

#### Event Dispatchers

```typescript
async function dispatchInvoiceControlPassed(orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'invoice_control.passed',
    idempotency_key: `wms:invoice_control:${orderId}:passed:v1`,
    wms_order_id: orderId,
    po_number: order.po_number,
    crm_deal_id: order.crm_deal_id,
    checked_at: new Date().toISOString()
  });
}

async function dispatchInvoiceControlFailed(orderId: string, reason: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  await dispatchWebhookEvent({
    event: 'invoice_control.failed',
    idempotency_key: `wms:invoice_control:${orderId}:failed:v1`,
    wms_order_id: orderId,
    po_number: order.po_number,
    crm_deal_id: order.crm_deal_id,
    failure_reason: reason,
    checked_at: new Date().toISOString()
  });
}
```

#### Control Action Handler

```typescript
async function handleInvoiceControl(
  orderId: string,
  status: 'passed' | 'failed',
  userId: string,
  reason?: string,
  note?: string
) {
  // Create control record
  await supabase
    .from('invoice_control_records')
    .insert({
      order_id: orderId,
      status,
      failure_reason: reason,
      note,
      checked_by: userId
    });
  
  // Update order
  await supabase
    .from('orders')
    .update({
      invoice_control_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);
  
  // Emit event
  if (status === 'passed') {
    await dispatchInvoiceControlPassed(orderId);
  } else {
    await dispatchInvoiceControlFailed(orderId, reason!);
  }
}
```

### UI Scope

#### New Page: `/invoice-control`

| Component | Description |
|-----------|-------------|
| Header | "Invoice Control Queue" |
| Tabs | "Pending", "Passed", "Failed" |
| Table | Orders with invoice_control_status = 'pending_control' |
| Bulk Actions | "Pass Selected", "Fail Selected" |
| Export | Excel export button |
| Pagination | Standard pagination |

#### Control Action Dialog

| Field | Type | Required |
|-------|------|----------|
| Action | Radio (Pass/Fail) | Yes |
| Failure Reason | Dropdown | If Fail |
| Note | Textarea | No |

### Feature Scope

| Feature | Description |
|---------|-------------|
| View pending | List orders needing invoice control |
| Pass/Fail control | Record control decision |
| Bulk operations | Process multiple orders |
| Block fulfillment | Gate trigger prevents fulfillment without control |
| Export | Excel export of queue |

### Forms Scope

#### Invoice Control Form

| Field | Type |
|-------|------|
| Action | Pass / Fail radio |
| Failure Reason | Dropdown (if fail) |
| Note | Textarea |

### Permissions Scope

| Permission | Roles |
|------------|-------|
| `invoicecontrol:view` | accounting, senior_manager, admin |
| `invoicecontrol:action` | accounting, senior_manager, admin |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #90 | Invoice control queue | ✅ |
| #91 | Control pass/fail | ✅ |
| #92 | Fulfillment gate | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-INV-01 | As an accountant, I can view orders pending invoice control |
| US-INV-02 | As an accountant, I can pass or fail invoice control |
| US-INV-03 | As a WMS operator, I cannot fulfill orders without passed control |
| US-INV-04 | As an accountant, I can bulk process multiple orders |

### Done Proof

| Check | Method |
|-------|--------|
| Page accessible | Navigate to `/invoice-control` |
| Pass emits event | Pass order, verify `invoice_control.passed` in outbox |
| Fail emits event | Fail order, verify `invoice_control.failed` in outbox |
| Gate blocks | Try to fulfill without control, verify error |

### QA Test IDs

- INV-01: Queue display
- INV-02: Pass action
- INV-03: Fail action with reason
- INV-04: Fulfillment gate enforcement
- INV-05: Bulk operations

---

## Batch 13: PO Command Center

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P2 — Dashboard |
| **Dependencies** | All prior batches |
| **CRM Required** | No |

### Contract Scope

- **Events**: Uses all prior events
- **Purpose**: Unified dashboard per Checklist Section 3

### DB Scope

- None (uses derived stages from existing data)

### Backend Scope

#### Stage Derivation Query

```sql
-- View for derived order stages
CREATE OR REPLACE VIEW order_stages AS
SELECT 
  o.id,
  o.po_number,
  o.customer_name,
  o.created_at,
  CASE
    WHEN o.status = 'cancelled' THEN 'cancelled'
    WHEN o.status = 'fulfilled' THEN 'fulfilled'
    WHEN o.invoice_status = 'paid' THEN 'invoiced'
    WHEN o.status = 'shipped' THEN 'shipped'
    WHEN o.status = 'prepared' THEN 'prepared'
    WHEN o.status = 'picking' THEN 'picking'
    WHEN o.status = 'confirmed' AND o.invoice_control_status = 'passed' THEN 'po_created'
    WHEN o.status = 'confirmed' AND o.invoice_control_status = 'pending_control' THEN 'awaiting_approval'
    WHEN r.allocation_state = 'allocated' THEN 'reserved'
    ELSE 'pending'
  END as derived_stage,
  o.crm_deal_id,
  o.crm_organization_id
FROM orders o
LEFT JOIN reservations r ON o.reservation_id = r.id;
```

### UI Scope

#### New Page: `/po-command-center`

| Component | Description |
|-----------|-------------|
| Header | "PO Command Center" with org filter |
| Stage Cards | Cards showing count per stage |
| Stage Flow | Visual flow diagram |
| Drill-down | Click card to filter table |
| Table | Orders filtered by selected stage |
| Lab Indicator | Badge if any line has lab pending |
| Design Indicator | Badge if design/print required |

#### Stage Cards

| Stage | Color | Filter Condition |
|-------|-------|------------------|
| Pending | Gray | derived_stage = 'pending' |
| Reserved | Blue | derived_stage = 'reserved' |
| Awaiting Approval | Yellow | derived_stage = 'awaiting_approval' |
| PO Created | Green | derived_stage = 'po_created' |
| Picking | Orange | derived_stage = 'picking' |
| Prepared | Teal | derived_stage = 'prepared' |
| Shipped | Purple | derived_stage = 'shipped' |
| Delivered | Indigo | derived_stage = 'delivered' |
| Invoiced | Pink | derived_stage = 'invoiced' |
| Fulfilled | Emerald | derived_stage = 'fulfilled' |
| Cancelled | Red | derived_stage = 'cancelled' |

### Feature Scope

| Feature | Description |
|---------|-------------|
| Stage counts | Real-time count per stage |
| Stage filtering | Click to filter to stage |
| Lab visibility | Show lab pending indicator |
| Design visibility | Show design/print required indicator |
| Org filtering | Filter by organization |

### Forms Scope

- None (read-only dashboard)

### Permissions Scope

| Permission | Roles |
|------------|-------|
| View command center | All authenticated users |

### User Journeys

| Journey # | Description | Covered |
|-----------|-------------|---------|
| #9 | /fulfillment command center | ✅ |
| #82 | Design/Printing visibility | ✅ |
| #83 | Lab Workflow visibility | ✅ |

### User Stories

| Story | Description |
|-------|-------------|
| US-CMD-01 | As a WMS manager, I can see all orders by stage |
| US-CMD-02 | As a WMS operator, I can quickly find orders needing action |
| US-CMD-03 | As a WMS operator, I can see lab workflow pending items |
| US-CMD-04 | As a WMS operator, I can see design/print requirements |

### Done Proof

| Check | Method |
|-------|--------|
| Page accessible | Navigate to `/po-command-center` |
| Stage counts | Verify counts match actual orders |
| Drill-down works | Click stage card, verify table filters |
| Lab indicator | Create order with lab pending, verify badge |

### QA Test IDs

- CMD-01: Stage card counts
- CMD-02: Stage drill-down
- CMD-03: Lab workflow indicator
- CMD-04: Design/print indicator

---

## Final Consolidated Inventories

### Final Page List

| # | Route | Status | Batch |
|---|-------|--------|-------|
| 1 | `/` (Dashboard) | Existing | — |
| 2 | `/inventory` | Existing | — |
| 3 | `/reservations` | Amended | 3 |
| 4 | `/orders` | Amended | 4 |
| 5 | `/orders/:id` | Amended | 4, 10 |
| 6 | `/supply-requests` | **NEW** | 5 |
| 7 | `/allocation-planning` | **NEW** | 7 |
| 8 | `/allocation-entry` | **NEW** | 7 |
| 9 | `/approvals/shipment` | **NEW** | 8 |
| 10 | `/central-stock-checks` | **NEW** | 9 |
| 11 | `/costing/invoices` | **NEW** | 11 |
| 12 | `/costing/adjustments` | **NEW** | 11 |
| 13 | `/invoice-control` | **NEW** | 12 |
| 14 | `/po-command-center` | **NEW** | 13 |

### Final Permissions/Roles

| Permission | Roles |
|------------|-------|
| `allocations:plan` | warehouse_staff, senior_manager, admin |
| `allocations:enter` | warehouse_staff, senior_manager, admin |
| `shipment:override` | senior_manager, admin |
| `orders:createissue` | warehouse_staff, senior_manager, admin |
| `orders:resolveissue` | senior_manager, admin |
| `centralstock:check` | warehouse_staff, senior_manager, admin |
| `costing:view` | accounting, senior_manager, admin |
| `costing:edit` | accounting, admin |
| `costing:post` | senior_manager, admin |
| `invoicecontrol:view` | accounting, senior_manager, admin |
| `invoicecontrol:action` | accounting, senior_manager, admin |

### Final CRM → WMS Events (11)

| # | Event | Idempotency Key |
|---|-------|-----------------|
| 1 | `customer.created` | `crm:customer:{id}:created:v1` |
| 2 | `customer.updated` | `crm:customer:{id}:updated:v1` |
| 3 | `deal.approved` | `crm:deal:{id}:approved:v1` |
| 4 | `deal.accepted` | `crm:deal:{id}:accepted:v1` |
| 5 | `deal.won` | `crm:deal:{id}:won:v1` |
| 6 | `deal.cancelled` | `crm:deal:{id}:cancelled:v1` |
| 7 | `deal.lines_updated` | `crm:deal:{id}:lines_updated:v1` |
| 8 | `supply_request.created` | `crm:supply_request:{id}:created:v1` |
| 9 | `shipment.approved` | `crm:reservation:{id}:shipment_approved:v1` |
| 10 | `payment.confirmed` | `crm:payment:{id}:confirmed:v1` |
| 11 | `org_access.updated` | `crm:org_access:{user_id}-{seq}:updated:v1` |

### Final WMS → CRM Events (30)

| # | Event | Idempotency Key |
|---|-------|-----------------|
| 1 | `inquiry.created` | `wms:inquiry:{id}:created:v1` |
| 2 | `inquiry.converted` | `wms:inquiry:{id}:converted:v1` |
| 3 | `reservation.created` | `wms:reservation:{id}:created:v1` |
| 4 | `reservation.released` | `wms:reservation:{id}:released:v1` |
| 5 | `reservation.converted` | `wms:reservation:{id}:converted:v1` |
| 6 | `reservation.allocation_planned` | `wms:reservation:{id}:allocation_planned:v1` |
| 7 | `reservation.allocated` | `wms:reservation:{id}:allocated:v1` |
| 8 | `order.created` | `wms:order:{id}:created:v1` |
| 9 | `order.picking_started` | `wms:order:{id}:picking_started:v1` |
| 10 | `order.prepared` | `wms:order:{id}:prepared:v1` |
| 11 | `shipment.posted` | `wms:shipment:{id}:posted:v1` |
| 12 | `shipment.delivered` | `wms:shipment:{id}:delivered:v1` |
| 13 | `order.invoiced` | `wms:order:{id}:invoiced:v1` |
| 14 | `order.fulfilled` | `wms:order:{id}:fulfilled:v1` |
| 15 | `order.cancelled` | `wms:order:{id}:cancelled:v1` |
| 16 | `stock.changed` | `wms:stock:{batch_id}:changed:v1` |
| 17 | `inventory.low_stock` | `wms:low_stock:{alert_id}:triggered:v1` |
| 18 | `supply_request.status_updated` | `wms:supply_request:{id}:status_updated:v1` |
| 19 | `order.status_changed` | `wms:order_status:{id}-{seq}:changed:v1` |
| 20 | `shortage.detected` | `wms:shortage_detection:{id}:detected:v1` |
| 21 | `central_stock_check.completed` | `wms:central_stock_check:{id}:completed:v1` |
| 22 | `post_po_issue.created` | `wms:post_po_issue:{id}:created:v1` |
| 23 | `post_po_issue.updated` | `wms:post_po_issue:{id}:updated:v1` |
| 24 | `post_po_issue.resolved` | `wms:post_po_issue:{id}:resolved:v1` |
| 25 | `costing.invoice_posted` | `wms:costing_invoice:{id}:posted:v1` |
| 26 | `costing.receipt_linked` | `wms:costing_receipt:{id}:linked:v1` |
| 27 | `costing.adjustment_posted` | `wms:costing_adjustment:{id}:posted:v1` |
| 28 | `costing.wac_updated` | `wms:wac:{quality}-{id}:updated:v1` |
| 29 | `invoice_control.passed` | `wms:invoice_control:{order_id}:passed:v1` |
| 30 | `invoice_control.failed` | `wms:invoice_control:{order_id}:failed:v1` |

### Final DB Inventory

#### New Tables (14)

| # | Table | Batch |
|---|-------|-------|
| 1 | `integration_inbox` | 1 |
| 2 | `user_org_grants_mirror` | 2 |
| 3 | `supply_requests` | 5 |
| 4 | `stock_transactions` | 6 |
| 5 | `central_stock_checks` | 9 |
| 6 | `central_stock_check_lines` | 9 |
| 7 | `post_po_issues` | 10 |
| 8 | `post_po_issue_lines` | 10 |
| 9 | `supplier_invoices` | 11 |
| 10 | `supplier_invoice_lines` | 11 |
| 11 | `costing_adjustments` | 11 |
| 12 | `quality_wac` | 11 |
| 13 | `fx_rate_selections` | 11 |
| 14 | `invoice_control_records` | 12 |

#### Altered Tables (6)

| # | Table | New Columns | Batch |
|---|-------|-------------|-------|
| 1 | `reservations` | +6 columns | 3 |
| 2 | `reservation_lines` | +5 columns | 3 |
| 3 | `orders` | +14 columns | 4 |
| 4 | `order_lots` | +6 columns | 4 |
| 5 | `lots` | +2 columns | 11 |
| 6 | `rolls` | +1 column | 11 |

---

## CRM Dependencies Per Batch

| Batch | CRM Must Provide | Can Start Without CRM |
|-------|------------------|----------------------|
| 1 | None | ✅ Yes |
| 2 | Emit `org_access.updated` with grants[] + seq | ⚠️ Schema only |
| 3 | None | ✅ Yes |
| 4 | None | ✅ Yes |
| 5 | Emit `supply_request.created` | ⚠️ Schema only |
| 6 | None | ✅ Yes |
| 7 | None | ✅ Yes |
| 8 | Emit `shipment.approved` | ⚠️ Schema only |
| 9 | None | ✅ Yes |
| 10 | None | ✅ Yes |
| 11 | None | ✅ Yes |
| 12 | None | ✅ Yes |
| 13 | None | ✅ Yes |

---

## Open Items

### Returns (Journey #295)

Per line 295 of the Master User Journeys:
> "Returns / return-flagging / return processing: I did not find an explicit requirement in the current v1.0.23 docs"

**Decision Required**: Is returns IN or POST v1.0.23?

If IN scope, add:
- **Batch 14**: Returns Processing (2 sessions)
- **New table**: `returns`
- **New event**: `return.received`

---

## Session Summary

| Batch | Description | Sessions |
|-------|-------------|----------|
| 1 | Contract File + Integration Inbox | 1 |
| 2 | Multi-Org Identity + org_access.updated | 2 |
| 3 | Reservations Schema Extensions | 1.5 |
| 4 | Orders Schema + PO Number | 2.5 |
| 5 | Supply Requests Mirror | 2 |
| 6 | stock.changed Event | 1.5 |
| 7 | Allocation Planning + Entry | 2.5 |
| 8 | Shipment Approval + Override | 2.5 |
| 9 | Central Stock Checks | 2 |
| 10 | Post-PO Issues | 2.5 |
| 11 | Costing Module | 4 |
| 12 | Invoice Control + Gate | 2.5 |
| 13 | PO Command Center | 2.5 |
| **Total** | | **29** |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-31 | AI | Initial creation aligned with v1.0.23 contract |
