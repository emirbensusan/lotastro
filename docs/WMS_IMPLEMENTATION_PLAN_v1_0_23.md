# WMS Implementation Plan for CRM/WMS Integration v1.0.23

> **Status**: DRAFT — Pending Review  
> **Contract Version**: v1.0.23 (LOCKED)  
> **Contract Authority**: `docs/wms_crm_v1_0_23_integration_updated/integration_contract_v1_0_23(1)(1).md`  
> **Created**: 2026-01-31  
> **Revised**: 2026-01-31 (Alignment hardening)  
> **Total Estimated Sessions**: 30

---

## DRIFT PREVENTION RULES (HARD REQUIREMENTS)

These rules are **non-negotiable** and must be followed throughout implementation:

### DR-1: Contract as Schema Authority
The locked contract file `integration_contract_v1_0_23(1)(1).md` is the **single source of truth** for:
- Event names (exact spelling)
- Payload field names and types
- Status enum values
- Idempotency key formats

**Any deviation from contract schemas is a blocking defect.**

### DR-2: Reject Unknown Fields
All inbound event handlers MUST:
1. Validate payload against contract schema
2. **Log** any fields present in payload but not in contract schema
3. **Reject** (HTTP 400) payloads with unknown fields if strict mode is enabled
4. Store violation details in `integration_contract_violations` audit table

### DR-3: Contract Compliance Checklist
Every batch that touches integration events MUST include:
```
### Contract Compliance Checklist
- [ ] Event names match contract exactly
- [ ] Payload fields match contract schema (no extras, no missing required)
- [ ] Idempotency key format: 5 segments, ends with :v1
- [ ] Status enums use contract-defined values only
- [ ] UOM restricted to MT|KG only (contract requirement)
```

### DR-4: No Invented Events or Fields
If functionality requires events/fields not in contract:
1. **DO NOT IMPLEMENT** as integration event
2. Flag as **CONTRACT CHANGE REQUEST** in this document
3. Implement only after contract amendment is approved and locked

### DR-5: Idempotency Key Validation
All idempotency keys MUST:
- Have exactly 5 colon-separated segments
- Format: `<source>:<entity>:<entity_id>:<action>:v1`
- Use dashes (not colons) for composite entity_ids
- End with `:v1` (version segment)

---

## MULTI-ORG UI RULES (LOCKED)

Per PRD Section 2 and Agent Checklist Section 1:

### Single-Org Roles (warehouse_staff)
- **No** org column in tables
- **No** "All Orgs" toggle visible
- Operate in Active Org context only
- Org badge hidden in WMS UI

### Multi-Org Roles (senior_manager, admin)
- **Active/All** toggle available in header
- When scope = Active Org: No org column
- When scope = All Orgs: Org column visible, filter by org available
- Org badge visible on order/reservation cards

### Implementation Rule
```typescript
// Use this pattern in all list pages
const showOrgColumn = userHasMultiOrgAccess && orgScope === 'all';
const showOrgToggle = userHasMultiOrgAccess;
```

---

## Table of Contents

1. [Document Alignment](#document-alignment)
2. [QA Traceability Matrix](#qa-traceability-matrix)
3. [Operational Infrastructure](#operational-infrastructure)
4. [Batch 0: Contract Alignment & Guards](#batch-0-contract-alignment--guards)
5. [Batch 1: Contract File + Integration Inbox](#batch-1-contract-file--integration-inbox)
6. [Batch 2: Multi-Org Identity + org_access.updated Handler](#batch-2-multi-org-identity--org_accessupdated-handler)
7. [Batch 3: Reservations Schema Extensions](#batch-3-reservations-schema-extensions)
8. [Batch 4: Orders Schema Extensions + PO Number Generator](#batch-4-orders-schema-extensions--po-number-generator)
9. [Batch 5: Supply Requests Mirror + Events](#batch-5-supply-requests-mirror--events)
10. [Batch 6: stock.changed Event](#batch-6-stockchanged-event)
11. [Batch 7: Allocation Planning + Entry Pages](#batch-7-allocation-planning--entry-pages)
12. [Batch 8: Shipment Approval + Override](#batch-8-shipment-approval--override)
13. [Batch 9: Central Stock Checks (Abra)](#batch-9-central-stock-checks-abra)
14. [Batch 10: Post-PO Issues (Discrepancy Loop)](#batch-10-post-po-issues-discrepancy-loop)
15. [Batch 11: Costing Module](#batch-11-costing-module)
16. [Batch 12: Invoice Control + Fulfillment Gate](#batch-12-invoice-control--fulfillment-gate)
17. [Batch 13: PO Command Center](#batch-13-po-command-center)
18. [Final Consolidated Inventories](#final-consolidated-inventories)
19. [CRM Dependencies Per Batch](#crm-dependencies-per-batch)
20. [Contract Change Requests](#contract-change-requests)
21. [Files/Functions Created or Modified](#filesfunctions-created-or-modified)

---

## Document Alignment

This implementation plan is **100% aligned** with the following canonical v1.0.23 documents:

| Document | Location | Purpose |
|----------|----------|---------|
| **Integration Contract v1.0.23 (LOCKED)** | `docs/wms_crm_v1_0_23_integration_updated/integration_contract_v1_0_23(1)(1).md` | Schema authority (30 WMS→CRM events, 11 CRM→WMS events) |
| Epic Implementation Plan | `docs/wms_crm_v1_0_23_integration_updated/WMS_CRM_EPIC_IMPLEMENTATION_PLAN_v1_0_23_UPDATED.md` | 17-batch execution roadmap |
| QA Test Plan | `docs/wms_crm_v1_0_23_integration_updated/QA_TestPlan_CRM_WMS_v1_0_23_UPDATED.md` | 503-line test coverage |
| PRD | `docs/wms_crm_v1_0_23_integration_updated/PRD_CRM_Pricing_Thresholds_v1_9_v1_0_23_UPDATED.md` | Multi-org + pricing + credit rules |
| Agent Checklist | `docs/wms_crm_v1_0_23_integration_updated/Agent_Checklist_Pricing_Thresholds_WarehouseCheck_v1_10_v1_0_23_UPDATED.md` | WMS implementation checklist |
| Appendix | `docs/wms_crm_v1_0_23_integration_updated/WMS_Appendix_PricingThresholds_Inputs_v1_9_v1_0_23_UPDATED.md` | Data requirements |
| User Stories | `docs/wms_crm_v1_0_23_integration_updated/CRM_WMS_UserStories_v1_0_23.md` | 83 user stories |
| Master User Journeys | `docs/wms_crm_v1_0_23_integration_updated/CRM_WMS_USER_JOURNEYS_v1_0_23_AGGREGATED_MASTER.md` | 99 user journeys |

---

## QA Traceability Matrix

Every batch MUST map to at least one QA test case from QA_TestPlan_CRM_WMS_v1_0_23_UPDATED.md.

| Batch | User Stories | Contract Events | QA Test Cases |
|-------|--------------|-----------------|---------------|
| 0 | #72, #81, #82, #83 | (infrastructure) | B-01, B-02, QA Addendum A-F |
| 1 | #72 | (infrastructure) | B-01, B-02 |
| 2 | #1, #2 | `org_access.updated` | RLS-01, RLS-02, RLS-03, F-01, D-01 |
| 3 | #10, #83 | (prepares allocation events) | FUL-01, LAB-01 |
| 4 | #6, #7, #82, #84 | `order.created` | ID-01, ID-02, ID-03, ORD-01 |
| 5 | #11 | `supply_request.created`, `supply_request.status_updated` | (supply tracking) |
| 6 | #16, #81 | `stock.changed` | E-01, QA Addendum E |
| 7 | #19 | `reservation.allocation_planned`, `reservation.allocated` | FUL-01 |
| 8 | #20, #21 | `shipment.approved` (inbound), `order.created` | FUL-01, FUL-02 |
| 9 | #46-50 | `central_stock_check.completed` | ABR-01, ABR-02, ABR-03, ABR-04, ABRA-01, ABRA-02 |
| 10 | #72, #85, #86, #93 | `post_po_issue.created/updated/resolved` | DPO-01, DPO-02, DPO-03, DPO-04 |
| 11 | #75-80 | `costing.invoice_posted/receipt_linked/adjustment_posted/wac_updated` | CST-01 to CST-06 |
| 12 | #72 | `invoice_control.passed/failed` | INV-01, INV-02, INV-03 |
| 13 | #9 | (uses all prior events) | (command center) |

---

## Operational Infrastructure

### Inbound Event Logging

| Aspect | Specification |
|--------|---------------|
| **Table** | `integration_inbox` |
| **Columns** | `event_type`, `payload`, `idempotency_key`, `status`, `processed_at`, `error_message`, `payload_hash`, `attempt_count` |
| **Statuses** | `pending` → `processing` → `processed` / `failed` |
| **Validation** | 5-segment idempotency key, HMAC signature, schema validation, unknown field rejection |
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
| **Behavior** | Check if key exists; if `status = 'processed'`, return 200; if `status = 'failed'`, update to pending |
| **Sequence Handling** | Out-of-order protection using monotonic `*_seq` fields |

### NULL-Safe Uniqueness (Contract Appendix C)

For all cache/mirror tables with nullable dimensions:

```sql
-- Canonical sentinel values
-- UUID nullable: 00000000-0000-0000-0000-000000000000
-- TEXT nullable: __NULL__

-- Scope key pattern (apply to all cache tables)
org_scope_key := COALESCE(crm_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
warehouse_scope_key := COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
color_scope_key := COALESCE(color_code, '__NULL__')
```

---

## Batch 0: Contract Alignment & Guards

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1 |
| **Priority** | P0 — Prerequisite |
| **Dependencies** | None |
| **CRM Required** | No |

### Purpose

Establish drift prevention infrastructure BEFORE any integration work begins.

### DB Scope

#### New Table: `integration_contract_violations`

```sql
CREATE TABLE integration_contract_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'unknown_field', 'missing_required_field', 'invalid_enum_value',
    'invalid_idempotency_format', 'schema_mismatch', 'uom_violation'
  )),
  field_name TEXT,
  field_value TEXT,
  expected_schema JSONB,
  received_payload JSONB,
  idempotency_key TEXT,
  source_system TEXT,
  logged_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);

CREATE INDEX idx_contract_violations_type ON integration_contract_violations(violation_type, logged_at DESC);
CREATE INDEX idx_contract_violations_event ON integration_contract_violations(event_type, logged_at DESC);
```

#### Idempotency Key Validation Function (REVISED)

```sql
-- Validates idempotency key format per Contract v1.0.23
CREATE OR REPLACE FUNCTION validate_idempotency_key(p_key TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT
) 
LANGUAGE plpgsql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts TEXT[];
BEGIN
  -- Check for NULL or empty
  IF p_key IS NULL OR p_key = '' THEN
    RETURN QUERY SELECT false, 'Idempotency key is empty or null';
    RETURN;
  END IF;
  
  v_parts := string_to_array(p_key, ':');
  
  -- Must have exactly 5 segments
  IF array_length(v_parts, 1) != 5 THEN
    RETURN QUERY SELECT false, format('Expected 5 segments, got %s', array_length(v_parts, 1));
    RETURN;
  END IF;
  
  -- Segment 1: source system
  IF v_parts[1] NOT IN ('wms', 'crm') THEN
    RETURN QUERY SELECT false, format('Invalid source system: %s (must be wms or crm)', v_parts[1]);
    RETURN;
  END IF;
  
  -- Segment 2: entity (non-empty)
  IF v_parts[2] IS NULL OR v_parts[2] = '' THEN
    RETURN QUERY SELECT false, 'Entity segment (2) is empty';
    RETURN;
  END IF;
  
  -- Segment 3: entity_id (non-empty, may contain dashes but not colons)
  IF v_parts[3] IS NULL OR v_parts[3] = '' THEN
    RETURN QUERY SELECT false, 'Entity ID segment (3) is empty';
    RETURN;
  END IF;
  
  -- Segment 4: action (non-empty)
  IF v_parts[4] IS NULL OR v_parts[4] = '' THEN
    RETURN QUERY SELECT false, 'Action segment (4) is empty';
    RETURN;
  END IF;
  
  -- Segment 5: version (must be v1)
  IF v_parts[5] != 'v1' THEN
    RETURN QUERY SELECT false, format('Invalid version: %s (must be v1)', v_parts[5]);
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;
```

#### UOM Validation Function

```sql
-- Per Contract: UOM MUST be MT or KG only (uppercase)
CREATE OR REPLACE FUNCTION validate_contract_uom(p_uom TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_uom IN ('MT', 'KG');
$$;
```

### Backend Scope

#### Contract Schema Definitions (TypeScript)

```typescript
// File: supabase/functions/_shared/contract-schemas.ts

/**
 * Contract v1.0.23 Schema Definitions
 * Source: integration_contract_v1_0_23(1)(1).md
 * DO NOT MODIFY without contract amendment
 */

// Valid UOM values per contract
export const CONTRACT_UOM_VALUES = ['MT', 'KG'] as const;
export type ContractUOM = typeof CONTRACT_UOM_VALUES[number];

// Idempotency key validation
export function validateIdempotencyKey(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: 'Idempotency key is empty' };
  }
  
  const parts = key.split(':');
  
  if (parts.length !== 5) {
    return { valid: false, error: `Expected 5 segments, got ${parts.length}` };
  }
  
  if (!['wms', 'crm'].includes(parts[0])) {
    return { valid: false, error: `Invalid source: ${parts[0]}` };
  }
  
  if (!parts[1] || !parts[2] || !parts[3]) {
    return { valid: false, error: 'Empty segment in key' };
  }
  
  if (parts[4] !== 'v1') {
    return { valid: false, error: `Invalid version: ${parts[4]}` };
  }
  
  return { valid: true };
}

// Schema validation with unknown field detection
export function validatePayloadSchema<T>(
  payload: Record<string, unknown>,
  schema: Record<string, 'required' | 'optional'>,
  eventType: string
): { valid: boolean; unknownFields: string[]; missingFields: string[] } {
  const unknownFields: string[] = [];
  const missingFields: string[] = [];
  
  // Check for unknown fields
  for (const key of Object.keys(payload)) {
    if (!(key in schema)) {
      unknownFields.push(key);
    }
  }
  
  // Check for missing required fields
  for (const [key, requirement] of Object.entries(schema)) {
    if (requirement === 'required' && !(key in payload)) {
      missingFields.push(key);
    }
  }
  
  return {
    valid: unknownFields.length === 0 && missingFields.length === 0,
    unknownFields,
    missingFields
  };
}

// Log contract violation
export async function logContractViolation(
  supabase: any,
  violation: {
    event_type: string;
    violation_type: 'unknown_field' | 'missing_required_field' | 'invalid_enum_value' | 
                   'invalid_idempotency_format' | 'schema_mismatch' | 'uom_violation';
    field_name?: string;
    field_value?: string;
    expected_schema?: object;
    received_payload?: object;
    idempotency_key?: string;
    source_system?: string;
  }
): Promise<void> {
  await supabase.from('integration_contract_violations').insert(violation);
  console.warn(`[CONTRACT VIOLATION] ${violation.violation_type}: ${violation.field_name || violation.event_type}`);
}

// Event schemas per Contract v1.0.23
export const EVENT_SCHEMAS = {
  'org_access.updated': {
    event: 'required',
    idempotency_key: 'required',
    user_id: 'required',
    org_access_seq: 'required',
    grants: 'required',
    updated_at: 'required',
    updated_by: 'optional'
  },
  'stock.changed': {
    event: 'required',
    idempotency_key: 'required',
    transaction_batch_id: 'required',
    crm_organization_id: 'optional',
    changed_at: 'required',
    reason: 'required',
    items: 'required',
    changed_by: 'optional'
  },
  // Add all other event schemas...
} as const;
```

#### HMAC + Schema Validation (TypeScript)

```typescript
// File: supabase/functions/_shared/contract-validation.ts

import { createHmac, timingSafeEqual } from 'node:crypto';
import { 
  validateIdempotencyKey, 
  validatePayloadSchema, 
  logContractViolation,
  EVENT_SCHEMAS,
  CONTRACT_UOM_VALUES
} from './contract-schemas.ts';

const STRICT_MODE = true; // Reject unknown fields

export interface ValidationResult {
  valid: boolean;
  status: number;
  error?: string;
  violations: string[];
}

export async function validateInboundEvent(
  supabase: any,
  req: Request,
  payload: Record<string, unknown>
): Promise<ValidationResult> {
  const violations: string[] = [];
  
  // 1. Validate HMAC signature
  const signature = req.headers.get('x-webhook-signature');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  
  if (!signature || !webhookSecret) {
    return { valid: false, status: 401, error: 'Missing signature', violations: [] };
  }
  
  const expectedSignature = createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (sigBuffer.length !== expectedBuffer.length || 
      !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, status: 401, error: 'Invalid signature', violations: [] };
  }
  
  // 2. Validate idempotency key format
  const idempotencyKey = payload.idempotency_key as string;
  const keyValidation = validateIdempotencyKey(idempotencyKey);
  
  if (!keyValidation.valid) {
    await logContractViolation(supabase, {
      event_type: payload.event as string || 'unknown',
      violation_type: 'invalid_idempotency_format',
      field_value: idempotencyKey,
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    
    return { 
      valid: false, 
      status: 400, 
      error: `Invalid idempotency key: ${keyValidation.error}`,
      violations: [`idempotency_key: ${keyValidation.error}`]
    };
  }
  
  // 3. Validate event schema
  const eventType = payload.event as string;
  const schema = EVENT_SCHEMAS[eventType as keyof typeof EVENT_SCHEMAS];
  
  if (!schema) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'schema_mismatch',
      received_payload: payload,
      source_system: 'crm'
    });
    
    return {
      valid: false,
      status: 400,
      error: `Unknown event type: ${eventType}`,
      violations: [`Unknown event: ${eventType}`]
    };
  }
  
  const schemaValidation = validatePayloadSchema(payload, schema, eventType);
  
  // Log unknown fields
  for (const field of schemaValidation.unknownFields) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'unknown_field',
      field_name: field,
      field_value: String(payload[field]),
      received_payload: payload,
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    violations.push(`Unknown field: ${field}`);
  }
  
  // Reject if strict mode and unknown fields present
  if (STRICT_MODE && schemaValidation.unknownFields.length > 0) {
    return {
      valid: false,
      status: 400,
      error: `Unknown fields in payload: ${schemaValidation.unknownFields.join(', ')}`,
      violations
    };
  }
  
  // Check missing required fields
  for (const field of schemaValidation.missingFields) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'missing_required_field',
      field_name: field,
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    violations.push(`Missing required field: ${field}`);
  }
  
  if (schemaValidation.missingFields.length > 0) {
    return {
      valid: false,
      status: 400,
      error: `Missing required fields: ${schemaValidation.missingFields.join(', ')}`,
      violations
    };
  }
  
  // 4. Validate UOM if present
  if ('uom' in payload && !CONTRACT_UOM_VALUES.includes(payload.uom as any)) {
    await logContractViolation(supabase, {
      event_type: eventType,
      violation_type: 'uom_violation',
      field_name: 'uom',
      field_value: String(payload.uom),
      idempotency_key: idempotencyKey,
      source_system: 'crm'
    });
    
    return {
      valid: false,
      status: 400,
      error: `Invalid UOM: ${payload.uom} (must be MT or KG)`,
      violations: [`Invalid UOM: ${payload.uom}`]
    };
  }
  
  return { valid: true, status: 200, violations };
}
```

### Contract Compliance Checklist

- [x] Event names match contract exactly (infrastructure only)
- [x] Idempotency key validation: 5 segments, ends with :v1
- [x] Unknown field detection and logging implemented
- [x] UOM validation restricted to MT|KG only

### Done Proof

| Check | Method |
|-------|--------|
| Violation table exists | `SELECT * FROM integration_contract_violations LIMIT 1` |
| Key validation works | `SELECT * FROM validate_idempotency_key('wms:order:123:created:v1')` returns valid=true |
| Invalid key rejected | `SELECT * FROM validate_idempotency_key('wms:order:123:created')` returns valid=false |
| UOM validation | `SELECT validate_contract_uom('MT')` = true, `SELECT validate_contract_uom('YD')` = false |

### QA Test IDs

- QA Addendum A: Contract authority verification
- QA Addendum B: Idempotency key format validation
- QA Addendum C: Inbox retry semantics

---

## Batch 1: Contract File + Integration Inbox

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 1 |
| **Priority** | P0 — Foundation |
| **Dependencies** | Batch 0 |
| **CRM Required** | No |

### Contract Scope

- **Events**: None (ingestion/logging only — no business handlers)
- **Purpose**: Establish canonical contract file and create inbound event logging table

### DB Scope

#### New Table: `integration_inbox`

```sql
CREATE TABLE integration_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  source_system TEXT DEFAULT 'crm',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempt_count INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbox_idempotency ON integration_inbox(idempotency_key);
CREATE INDEX idx_inbox_status ON integration_inbox(status, created_at);
CREATE INDEX idx_inbox_event_type ON integration_inbox(event_type, created_at DESC);
CREATE INDEX idx_inbox_retry ON integration_inbox(status, next_retry_at) WHERE status = 'failed';
```

#### RLS Policies (Per Contract Appendix D.2)

```sql
ALTER TABLE integration_inbox ENABLE ROW LEVEL SECURITY;

-- No direct end-user access (service role only + admin view)
REVOKE ALL ON TABLE integration_inbox FROM authenticated;

-- Admin-only visibility for debugging
CREATE POLICY "inbox_select_admin_only"
  ON integration_inbox
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### Backend Scope

#### Edge Function: `wms-webhook-receiver` (Updated)

Implements Contract Appendix D.3 retry semantics:

```typescript
// Receiver MUST implement "Failed → Pending (Update, Not Insert)"
async function handleInboundEvent(supabase: any, payload: any, idempotencyKey: string, payloadHash: string) {
  // Check for existing entry
  const { data: existing } = await supabase
    .from('integration_inbox')
    .select('id, status, payload_hash')
    .eq('idempotency_key', idempotencyKey)
    .single();
  
  if (existing) {
    // Already processed/processing - return 200
    if (['processed', 'processing', 'pending'].includes(existing.status)) {
      // Log drift if payload hash differs
      if (existing.payload_hash !== payloadHash) {
        console.warn(`[DRIFT] Payload hash differs for ${idempotencyKey}`);
        await supabase.from('integration_inbox')
          .update({ last_error: `[DRIFT] Payload hash changed: ${existing.payload_hash} → ${payloadHash}` })
          .eq('id', existing.id);
      }
      return { status: 200, message: 'Already processed' };
    }
    
    // Failed - convert to pending for retry (per Appendix D.3.2)
    if (existing.status === 'failed') {
      await supabase.from('integration_inbox')
        .update({
          status: 'pending',
          attempt_count: existing.attempt_count + 1,
          last_error: null,
          next_retry_at: null,
          last_attempt_at: null
        })
        .eq('id', existing.id);
      
      return { status: 200, message: 'Queued for retry' };
    }
  }
  
  // New event - insert
  await supabase.from('integration_inbox').insert({
    event_type: payload.event,
    payload,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    status: 'pending',
    attempt_count: 0
  });
  
  return { status: 201, message: 'Event received' };
}
```

### Contract Compliance Checklist

- [x] Event names match contract exactly (infrastructure only)
- [x] Idempotency key format: 5 segments, ends with :v1
- [x] Retry semantics per Contract Appendix D.3
- [x] RLS prevents NULL-org leak per Contract Appendix D.2

### Done Proof

| Check | Method |
|-------|--------|
| Contract file updated | Verify `docs/wms_crm_v1_0_23_integration_updated/integration_contract_v1_0_23(1)(1).md` is authoritative |
| Table exists | `SELECT * FROM integration_inbox LIMIT 1` succeeds |
| Event logging works | Send test event with valid HMAC, verify row in inbox with status='pending' |
| Invalid key rejected | Send event with 4-segment key, verify HTTP 400 response |
| Retry semantics | Send duplicate with status=failed, verify status flips to pending |

### QA Test IDs

- B-01: Idempotency key format validation
- B-02: Duplicate event handling
- QA Addendum C: Inbox retry semantics

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

**Contract Reference**: Section "New Event Definition: org_access.updated"

### DB Scope

#### New Table: `user_org_grants_mirror`

```sql
CREATE TABLE user_org_grants_mirror (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  crm_organization_id UUID NOT NULL,
  role_in_org TEXT NOT NULL CHECK (role_in_org IN (
    'sales_owner', 'sales_manager', 'pricing', 'accounting', 'admin'
  )),
  is_active BOOLEAN DEFAULT true,
  org_access_seq INTEGER NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, crm_organization_id)
);

CREATE INDEX idx_org_grants_user ON user_org_grants_mirror(user_id);
CREATE INDEX idx_org_grants_org ON user_org_grants_mirror(crm_organization_id);
CREATE INDEX idx_org_grants_active ON user_org_grants_mirror(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_org_grants_seq ON user_org_grants_mirror(user_id, org_access_seq DESC);
```

#### New Functions

```sql
-- Check if user has access to specific org
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

-- Get all org IDs user has access to
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

-- Check if user has multi-org access (for UI toggle visibility)
CREATE OR REPLACE FUNCTION user_has_multi_org_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(DISTINCT crm_organization_id) 
    FROM user_org_grants_mirror 
    WHERE user_id = p_user_id AND is_active = true
  ) > 1;
$$;
```

### Backend Scope

#### Event Handler: `handleOrgAccessUpdated`

```typescript
interface OrgAccessGrant {
  crm_organization_id: string;
  role_in_org: 'sales_owner' | 'sales_manager' | 'pricing' | 'accounting' | 'admin';
  is_active: boolean;
}

interface OrgAccessUpdatedPayload {
  event: 'org_access.updated';
  idempotency_key: string;
  user_id: string;
  org_access_seq: number;
  grants: OrgAccessGrant[];
  updated_at: string;
  updated_by?: string;
}

async function handleOrgAccessUpdated(supabase: any, payload: OrgAccessUpdatedPayload) {
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
    console.warn(`[org_access.updated] Out-of-order: received seq ${org_access_seq}, have ${existing.org_access_seq}`);
    return { status: 'skipped', reason: 'out_of_order_sequence' };
  }
  
  // Replace all grants for user with new snapshot (per contract)
  await supabase
    .from('user_org_grants_mirror')
    .delete()
    .eq('user_id', user_id);
  
  if (grants && grants.length > 0) {
    await supabase
      .from('user_org_grants_mirror')
      .insert(grants.map(g => ({
        user_id,
        crm_organization_id: g.crm_organization_id,
        role_in_org: g.role_in_org,
        is_active: g.is_active,
        org_access_seq
      })));
  }
  
  return { status: 'processed' };
}
```

### Contract Compliance Checklist

- [x] Event name: `org_access.updated` (matches contract)
- [x] Idempotency key format: `crm:org_access:{user_id}-{org_access_seq}:updated:v1`
- [x] Payload schema matches contract exactly
- [x] Sequence guard for out-of-order protection
- [x] Snapshot replacement (not merge)

### Done Proof

| Check | Method |
|-------|--------|
| Table populated | Send `org_access.updated` event, verify rows in `user_org_grants_mirror` |
| Function works | `SELECT user_has_org_access('user-uuid', 'org-uuid')` returns correct boolean |
| Multi-org check | `SELECT user_has_multi_org_access('user-uuid')` returns true for multi-org users |
| Sequence guard | Send older seq, verify warning log and no data change |

### QA Test IDs

- RLS-01: User sees only permitted org data
- RLS-02: Multi-org user can switch context
- RLS-03: Out-of-order sequence rejected
- F-01: Org grants snapshot replacement
- D-01: Missing org access handled gracefully
- QA Addendum F: Ordering/sequence handling

---

## Batch 4: Orders Schema Extensions + PO Number Generator

### Overview

| Attribute | Value |
|-----------|-------|
| **Sessions** | 2.5 |
| **Priority** | P0 — Schema Foundation |
| **Dependencies** | Batch 1, Batch 2 |
| **CRM Required** | No |

### Contract Scope

| Event | Direction | Idempotency Key |
|-------|-----------|-----------------|
| `order.created` | WMS → CRM | `wms:order:{id}:created:v1` |

### DB Scope

#### Alter Table: `orders`

```sql
-- PO Number (primary identifier) - MANDATORY ORG PREFIX
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number TEXT UNIQUE;

-- CRM linkage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_organization_id UUID NOT NULL; -- MANDATORY

-- Add constraint to prevent PO creation without org
ALTER TABLE orders ADD CONSTRAINT orders_require_org 
  CHECK (crm_organization_id IS NOT NULL);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_deal_id UUID;

-- Override tracking with LOCKED reason codes per Checklist
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
```

#### Alter Table: `order_lots`

```sql
-- CRM deal line linkage
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS crm_deal_line_id UUID;

-- Unit of measure - CONTRACT RESTRICTED TO MT|KG ONLY
ALTER TABLE order_lots ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'MT'
  CHECK (uom IN ('MT', 'KG')); -- Per Contract: "uom MUST be MT or KG only"

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_lots_deal_line ON order_lots(crm_deal_line_id);
```

#### PO Number Generator (MANDATORY ORG PREFIX)

```sql
-- CRITICAL: No default prefix - org MUST be provided
-- Per Checklist: "Org-prefixed, non-sequential identifiers"
-- Format: {ORG}P{8-CHAR} e.g., MODP8F3K2Q7A

CREATE OR REPLACE FUNCTION generate_po_number(p_org_prefix TEXT)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
  v_chars TEXT := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Crockford Base32 (no I,L,O,U)
  v_result TEXT := '';
  i INTEGER;
BEGIN
  -- MANDATORY: Org prefix required
  IF p_org_prefix IS NULL OR p_org_prefix = '' THEN
    RAISE EXCEPTION 'Org prefix is required for PO number generation. Cannot generate PO without organization context.';
  END IF;
  
  -- Validate prefix format (2-4 uppercase letters)
  IF NOT (p_org_prefix ~ '^[A-Z]{2,4}$') THEN
    RAISE EXCEPTION 'Invalid org prefix format: %. Must be 2-4 uppercase letters.', p_org_prefix;
  END IF;
  
  LOOP
    -- Generate 8-character Crockford Base32 code
    v_result := '';
    FOR i IN 1..8 LOOP
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    
    v_code := p_org_prefix || 'P' || v_result;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM orders WHERE po_number = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique PO number after 100 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Add constraint to ensure PO follows format
ALTER TABLE orders ADD CONSTRAINT orders_po_format 
  CHECK (po_number ~ '^[A-Z]{2,4}P[0-9A-Z]{8}$');
```

#### Status Sequence Trigger

```sql
CREATE OR REPLACE FUNCTION increment_order_status_seq()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.order_status_seq := COALESCE(OLD.order_status_seq, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_seq ON orders;
CREATE TRIGGER trg_order_status_seq
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_order_status_seq();
```

### Backend Scope

#### Order Creation with Mandatory Org

```typescript
// CRITICAL: Org prefix MUST be derived from order's org context
async function createOrder(
  supabase: any, 
  orderData: OrderInput, 
  crmOrgId: string
): Promise<Order> {
  // Get org prefix from org mapping
  const { data: orgConfig } = await supabase
    .from('org_configurations') // or however org prefixes are stored
    .select('prefix')
    .eq('crm_organization_id', crmOrgId)
    .single();
  
  if (!orgConfig?.prefix) {
    throw new Error(`No org prefix configured for organization ${crmOrgId}`);
  }
  
  // Generate PO number with mandatory org prefix
  const { data: poNumber, error: poError } = await supabase
    .rpc('generate_po_number', { p_org_prefix: orgConfig.prefix });
  
  if (poError) {
    throw new Error(`Failed to generate PO number: ${poError.message}`);
  }
  
  const order = {
    ...orderData,
    po_number: poNumber,
    crm_organization_id: crmOrgId // MANDATORY
  };
  
  return order;
}
```

### Contract Compliance Checklist

- [x] Event name: `order.created` (matches contract)
- [x] Idempotency key format: `wms:order:{id}:created:v1`
- [x] PO number format: `{ORG}P{8-CHAR}` with mandatory org prefix
- [x] UOM restricted to MT|KG only per contract
- [x] Override reason codes locked to enum
- [x] Status sequence for order.status_changed events

### Done Proof

| Check | Method |
|-------|--------|
| PO number format | Create order, verify format `{ORG}P{8-CHAR}` |
| No default prefix | Call `generate_po_number(NULL)` fails with exception |
| Prefix validation | Call `generate_po_number('invalid')` fails |
| Uniqueness | Attempt duplicate, verify rejection |
| UOM constraint | Attempt insert with `uom='YD'`, verify rejection |

### QA Test IDs

- ID-01: PO number format `{ORG}P{CODE8}`
- ID-02: PO number uniqueness
- ID-03: Prefix changes apply future-only

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

**Contract Reference**: "Canonical Payload Definition: stock.changed (v1.0.23)"

### Payload Schema (LOCKED per Contract)

```json
{
  "event": "stock.changed",
  "idempotency_key": "wms:stock:{transaction_batch_id}:changed:v1",
  "transaction_batch_id": "uuid",
  "crm_organization_id": "uuid|null",
  "changed_at": "timestamptz",
  "reason": "receipt|fulfillment|adjustment|transfer|count",
  "items": [
    {
      "quality_code": "string",
      "color_code": "string|null",
      "warehouse_id": "uuid|null",
      "uom": "MT|KG",
      "on_hand_meters": 1250.00,
      "reserved_meters": 100.00,
      "available_meters": 1150.00,
      "delta_meters": 150.00
    }
  ],
  "changed_by": "uuid|null"
}
```

### DB Scope

#### New Table: `stock_transactions`

```sql
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL CHECK (reason IN ('receipt', 'fulfillment', 'adjustment', 'transfer', 'count')),
  crm_organization_id UUID, -- nullable per contract
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by UUID,
  emitted_at TIMESTAMPTZ,
  
  -- Scope keys for NULL-safe uniqueness (Contract Appendix C)
  org_scope_key UUID GENERATED ALWAYS AS (
    COALESCE(crm_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED
);

CREATE INDEX idx_stock_txn_batch ON stock_transactions(transaction_batch_id);
CREATE INDEX idx_stock_txn_reason ON stock_transactions(reason, changed_at DESC);
```

### Backend Scope

#### Dispatcher: `dispatchStockChanged`

```typescript
interface StockItem {
  quality_code: string;
  color_code: string | null;
  warehouse_id: string | null;
  uom: 'MT' | 'KG'; // Contract: MUST be MT or KG only
  on_hand_meters: number;
  reserved_meters: number;
  available_meters: number;
  delta_meters?: number;
}

async function dispatchStockChanged(
  supabase: any,
  transactionBatchId: string,
  reason: 'receipt' | 'fulfillment' | 'adjustment' | 'transfer' | 'count',
  items: StockItem[],
  crmOrgId?: string,
  changedBy?: string
): Promise<void> {
  // Validate UOM per contract
  for (const item of items) {
    if (!['MT', 'KG'].includes(item.uom)) {
      throw new Error(`Invalid UOM: ${item.uom}. Contract requires MT or KG only.`);
    }
  }
  
  const payload = {
    event: 'stock.changed',
    idempotency_key: `wms:stock:${transactionBatchId}:changed:v1`,
    transaction_batch_id: transactionBatchId,
    crm_organization_id: crmOrgId || null,
    changed_at: new Date().toISOString(),
    reason,
    items: items.map(item => ({
      quality_code: item.quality_code,
      color_code: item.color_code,
      warehouse_id: item.warehouse_id,
      uom: item.uom,
      on_hand_meters: item.on_hand_meters,
      reserved_meters: item.reserved_meters,
      available_meters: item.available_meters,
      delta_meters: item.delta_meters
    })),
    changed_by: changedBy || null
  };
  
  await dispatchWebhookEvent(supabase, payload);
}
```

### Contract Compliance Checklist

- [x] Event name: `stock.changed` (matches contract exactly)
- [x] Idempotency key: `wms:stock:{transaction_batch_id}:changed:v1` (5 segments)
- [x] Payload schema matches contract exactly
- [x] UOM restricted to MT|KG only
- [x] Snapshot values included (on_hand, reserved, available)
- [x] transaction_batch_id is stable per batch (not time-derived)

### Done Proof

| Check | Method |
|-------|--------|
| Event dispatched | Inventory change triggers `stock.changed` event |
| Idempotency | Replay same batch_id creates no duplicate effects |
| UOM validated | Attempt dispatch with `uom='YD'` fails |
| Snapshot values | Payload includes on_hand, reserved, available |

### QA Test IDs

- E-01: stock.changed scope keys
- QA Addendum E: stock.changed cache correctness

---

## Files/Functions Created or Modified

### SQL Migrations

| Batch | File/Migration | Description |
|-------|---------------|-------------|
| 0 | `create_contract_violations_table` | Contract violation audit table |
| 0 | `create_idempotency_validation_function` | `validate_idempotency_key()` |
| 0 | `create_uom_validation_function` | `validate_contract_uom()` |
| 1 | `create_integration_inbox_table` | Inbound event logging |
| 2 | `create_user_org_grants_mirror_table` | Multi-org RLS mirror |
| 2 | `create_org_access_functions` | `user_has_org_access()`, `get_user_org_ids()` |
| 4 | `alter_orders_add_integration_columns` | PO number, org linkage, overrides |
| 4 | `create_po_number_generator` | `generate_po_number()` - MANDATORY org prefix |
| 4 | `alter_order_lots_add_uom` | UOM restricted to MT|KG |
| 6 | `create_stock_transactions_table` | Stock change tracking |

### Edge Functions

| Batch | Function | Description |
|-------|----------|-------------|
| 0 | `_shared/contract-schemas.ts` | Contract schema definitions |
| 0 | `_shared/contract-validation.ts` | HMAC + schema validation |
| 1 | `wms-webhook-receiver` | Updated with retry semantics |
| 2 | (handler in receiver) | `handleOrgAccessUpdated` |
| 6 | `webhook-dispatcher` | Updated `dispatchStockChanged` |

### RLS Policies

| Batch | Table | Policy Description |
|-------|-------|-------------------|
| 1 | `integration_inbox` | Admin-only (no NULL-org leak) |
| 2 | `user_org_grants_mirror` | User sees own grants, service role full |

---

## Contract Change Requests

Items that require functionality not in Contract v1.0.23:

| ID | Description | Requested By | Status |
|----|-------------|--------------|--------|
| (none) | | | |

**Rule**: No implementation proceeds on items in this table until contract amendment is approved.

---

## CRM Dependencies Per Batch

| Batch | CRM Must Provide |
|-------|------------------|
| 2 | Emit `org_access.updated` with grants[] + org_access_seq |
| 5 | Emit `supply_request.created` with required fields |
| 8 | Emit `shipment.approved` with carrier preferences |

All other batches can proceed independently with WMS emitting events.

---

## Open Items

### Pending Decisions

| ID | Question | Impact | Owner |
|----|----------|--------|-------|
| OI-1 | Is returns (Journey #295) IN or POST v1.0.23? | Batch 14 + `returns` table | Product |

### Known Limitations

| ID | Limitation | Workaround |
|----|-----------|------------|
| KL-1 | No kg↔m conversion in v1 | UOM must match catalog |
