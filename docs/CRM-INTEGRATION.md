# CRM ↔ WMS Integration Specification

> **Status:** Planning Complete | **Last Updated:** 2026-01-09  
> **Integration Partners:** WMS (LotAstro) ↔ CRM System

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Models](#data-models)
4. [Event Types & Payloads](#event-types--payloads)
5. [API Endpoints](#api-endpoints)
6. [Edge Functions](#edge-functions)
7. [Database Migrations](#database-migrations)
8. [RLS Policies](#rls-policies)
9. [Frontend Components](#frontend-components)
10. [Feature Flags](#feature-flags)
11. [Implementation Phases](#implementation-phases)
12. [Testing Strategy](#testing-strategy)
13. [Rollback Plan](#rollback-plan)
14. [Success Metrics](#success-metrics)

---

## Overview

### Purpose
Enable seamless bidirectional data flow between WMS (warehouse/inventory) and CRM (customer/sales) systems for:
- Customer data synchronization
- Deal-to-reservation conversion
- Order fulfillment tracking
- Stock availability visibility
- Inquiry flow management

### Integration Pattern
- **Outbox Pattern** for reliable event delivery
- **HMAC-signed webhooks** for security
- **Idempotent processing** via `idempotency_key`
- **Local caching** with 24h TTL for performance

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CRM ↔ WMS Integration Flow                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐         Events (Webhooks)         ┌─────────────┐     │
│  │             │ ──────────────────────────────▶   │             │     │
│  │     CRM     │    deal.confirmed                 │     WMS     │     │
│  │   System    │    deal.cancelled                 │   System    │     │
│  │             │    deal.lines_updated             │             │     │
│  │             │ ◀──────────────────────────────   │             │     │
│  │             │    reservation.created            │             │     │
│  │             │    order.fulfilled                │             │     │
│  │             │    shipment.posted                │             │     │
│  │             │    inventory.low_stock            │             │     │
│  └─────────────┘                                   └─────────────┘     │
│         │                                                 │             │
│         │              API Calls (REST)                   │             │
│         │ ◀───────────────────────────────────────────▶   │             │
│         │    /crm-get-customer                            │             │
│         │    /crm-search-customers                        │             │
│         │    /api-get-inventory?masked=true               │             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Communication Patterns

| Pattern | Direction | Use Case |
|---------|-----------|----------|
| Webhooks (Outbox) | WMS → CRM | Reservation, Order, Shipment events |
| Webhooks (Outbox) | CRM → WMS | Deal confirmation, cancellation |
| REST API | WMS → CRM | Customer search, customer details |
| REST API | CRM → WMS | Stock availability queries |

### Security

| Mechanism | Implementation |
|-----------|----------------|
| Authentication | API Key in `X-API-Key` header |
| Signing | HMAC-SHA256 in `X-WMS-Signature` / `X-CRM-Signature` |
| Timestamp | `X-WMS-Timestamp` / `X-CRM-Timestamp` (5-minute window) |
| Idempotency | `idempotency_key` in payload |

### HMAC Signing Implementation

```typescript
// WMS Outgoing Webhook Signing
function signWebhook(payload: object, secret: string): { signature: string; timestamp: number } {
  const timestamp = Date.now();
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return { signature, timestamp };
}

// Headers sent with webhook
{
  'Content-Type': 'application/json',
  'X-API-Key': WMS_API_KEY,
  'X-WMS-Signature': signature,
  'X-WMS-Timestamp': timestamp.toString()
}
```

---

## Data Models

### WMS Tables (New/Modified)

#### Modified: `orders`
```sql
ALTER TABLE orders ADD COLUMN crm_customer_id UUID;
ALTER TABLE orders ADD COLUMN crm_deal_id UUID;
```

#### Modified: `reservations`
```sql
ALTER TABLE reservations ADD COLUMN crm_customer_id UUID;
ALTER TABLE reservations ADD COLUMN crm_deal_id UUID;
ALTER TABLE reservations ADD COLUMN crm_organization_id TEXT;
```

#### Modified: `inquiries`
```sql
ALTER TABLE inquiries ADD COLUMN crm_customer_id UUID;
```

#### New: `integration_outbox`
```sql
CREATE TABLE integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  target_system TEXT NOT NULL DEFAULT 'crm',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter'))
);

CREATE INDEX idx_outbox_pending ON integration_outbox(status, next_retry_at) 
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_outbox_created ON integration_outbox(created_at);
```

#### New: `crm_customer_cache`
```sql
CREATE TABLE crm_customer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id UUID NOT NULL,
  crm_organization_id TEXT,
  company_name TEXT NOT NULL,
  unique_code TEXT,
  email TEXT,
  phone TEXT,
  contacts JSONB DEFAULT '[]'::jsonb,
  payment_terms JSONB,
  cached_at TIMESTAMPTZ DEFAULT now(),
  stale_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  
  CONSTRAINT unique_crm_customer UNIQUE (crm_customer_id)
);

CREATE INDEX idx_cache_customer ON crm_customer_cache(crm_customer_id);
CREATE INDEX idx_cache_code ON crm_customer_cache(unique_code);
CREATE INDEX idx_cache_stale ON crm_customer_cache(stale_at);
```

#### New: `integration_sync_log`
```sql
CREATE TABLE integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  source_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  records_checked INTEGER DEFAULT 0,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  discrepancies JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  error_message TEXT
);
```

#### New: `integration_feature_flags`
```sql
CREATE TABLE integration_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Default flags
INSERT INTO integration_feature_flags (flag_key, flag_value, description) VALUES
  ('integration_enabled', false, 'Master switch for CRM integration'),
  ('crm_customer_sync', false, 'Enable customer data sync from CRM'),
  ('crm_reservation_events', false, 'Send reservation events to CRM'),
  ('crm_order_events', false, 'Send order events to CRM'),
  ('crm_shipment_events', false, 'Send shipment events to CRM'),
  ('crm_inventory_events', false, 'Send inventory events to CRM'),
  ('crm_masked_stock', true, 'Return masked stock levels to CRM API');
```

---

## Event Types & Payloads

### WMS → CRM Events

#### `reservation.created`
```json
{
  "event_type": "reservation.created",
  "idempotency_key": "res_uuid_v1",
  "timestamp": 1704700000000,
  "payload": {
    "wms_reservation_id": "uuid",
    "crm_organization_id": "uuid",
    "crm_customer_id": "uuid",
    "crm_deal_id": "uuid",
    "reservation_number": "RES-20260108-001",
    "customer_ref": "ACME001",
    "lines": [
      {
        "quality_code": "FABRIC-A",
        "color_code": "RED-001",
        "reserved_meters": 500,
        "lot_numbers": ["LOT-001", "LOT-002"]
      }
    ],
    "expires_at": "2026-01-15T00:00:00Z",
    "status": "active"
  }
}
```

#### `reservation.released`
```json
{
  "event_type": "reservation.released",
  "idempotency_key": "res_uuid_released_v1",
  "timestamp": 1704700000000,
  "payload": {
    "wms_reservation_id": "uuid",
    "crm_deal_id": "uuid",
    "reason": "expired|cancelled|converted",
    "released_meters": 500
  }
}
```

#### `order.created`
```json
{
  "event_type": "order.created",
  "idempotency_key": "order_uuid_v1",
  "timestamp": 1704700000000,
  "payload": {
    "wms_order_id": "uuid",
    "crm_organization_id": "uuid",
    "crm_customer_id": "uuid",
    "crm_deal_id": "uuid",
    "order_number": "ORD-20260108-001",
    "lines": [
      {
        "quality_code": "FABRIC-A",
        "color_code": "RED-001",
        "ordered_meters": 500
      }
    ],
    "status": "confirmed"
  }
}
```

#### `order.fulfilled`
```json
{
  "event_type": "order.fulfilled",
  "idempotency_key": "order_uuid_fulfilled_v1",
  "timestamp": 1704700000000,
  "payload": {
    "wms_order_id": "uuid",
    "crm_deal_id": "uuid",
    "order_number": "ORD-20260108-001",
    "fulfilled_at": "2026-01-08T14:30:00Z",
    "fulfilled_lines": [
      {
        "quality_code": "FABRIC-A",
        "color_code": "RED-001",
        "fulfilled_meters": 500,
        "lot_numbers": ["LOT-001"]
      }
    ]
  }
}
```

#### `shipment.posted`
```json
{
  "event_type": "shipment.posted",
  "idempotency_key": "shipment_uuid_v1",
  "timestamp": 1704700000000,
  "payload": {
    "wms_shipment_id": "uuid",
    "crm_deal_id": "uuid",
    "order_number": "ORD-20260108-001",
    "tracking_number": "TRACK123",
    "carrier": "DHL",
    "shipped_at": "2026-01-08T16:00:00Z"
  }
}
```

#### `inquiry.created`
```json
{
  "event_type": "inquiry.created",
  "idempotency_key": "inq_uuid_v1",
  "timestamp": 1704700000000,
  "payload": {
    "wms_inquiry_id": "uuid",
    "crm_customer_id": "uuid",
    "inquiry_number": "INQ-20260108-001",
    "items": [
      {
        "quality_code": "FABRIC-A",
        "color_code": "RED-001",
        "requested_meters": 1000
      }
    ]
  }
}
```

#### `inventory.low_stock`
```json
{
  "event_type": "inventory.low_stock",
  "idempotency_key": "stock_quality_color_timestamp",
  "timestamp": 1704700000000,
  "payload": {
    "quality_code": "FABRIC-A",
    "color_code": "RED-001",
    "current_stock": 150,
    "threshold": 200,
    "unit": "meters"
  }
}
```

### CRM → WMS Events

#### `deal.confirmed`
```json
{
  "event_type": "deal.confirmed",
  "idempotency_key": "deal_uuid_confirmed_v1",
  "timestamp": 1704700000000,
  "payload": {
    "crm_deal_id": "uuid",
    "crm_organization_id": "uuid",
    "crm_customer_id": "uuid",
    "customer_ref": "ACME001",
    "deal_number": "DEAL-001",
    "lines": [
      {
        "crm_line_id": "uuid",
        "quality_code": "FABRIC-A",
        "color_code": "RED-001",
        "quantity_meters": 500
      }
    ],
    "requested_delivery_date": "2026-01-15",
    "priority": "normal"
  }
}
```

#### `deal.cancelled`
```json
{
  "event_type": "deal.cancelled",
  "idempotency_key": "deal_uuid_cancelled_v1",
  "timestamp": 1704700000000,
  "payload": {
    "crm_deal_id": "uuid",
    "reason": "customer_request|timeout|other",
    "notes": "Optional cancellation notes"
  }
}
```

#### `deal.lines_updated`
```json
{
  "event_type": "deal.lines_updated",
  "idempotency_key": "deal_uuid_lines_v2",
  "timestamp": 1704700000000,
  "payload": {
    "crm_deal_id": "uuid",
    "changes": [
      {
        "crm_line_id": "uuid",
        "action": "quantity_reduced|quantity_increased|line_removed",
        "quality_code": "FABRIC-A",
        "color_code": "RED-001",
        "old_quantity": 500,
        "new_quantity": 300
      }
    ]
  }
}
```

---

## API Endpoints

### WMS Endpoints (for CRM to call)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api-get-inventory` | GET | Stock availability (supports `masked=true`) |
| `/wms-webhook-receiver` | POST | Receive CRM events |

#### GET `/api-get-inventory`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `quality` | string | Filter by quality code |
| `color` | string | Filter by color code |
| `masked` | boolean | Return stock status instead of exact meters |

**Response (masked=true):**
```json
{
  "success": true,
  "data": [
    {
      "quality_code": "FABRIC-A",
      "color_code": "RED-001",
      "stock_status": "available|low_stock|out_of_stock",
      "available_for_reservation": true
    }
  ]
}
```

**Stock Status Logic:**
```typescript
function getStockStatus(meters: number, threshold: number = 100): string {
  if (meters >= threshold) return 'available';
  if (meters > 0) return 'low_stock';
  return 'out_of_stock';
}
```

### CRM Endpoints (for WMS to call)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/crm-get-customer` | GET | Get customer details |
| `/crm-search-customers` | GET | Search customers |
| `/crm-webhook-receiver` | POST | Receive WMS events |

---

## Edge Functions

### WMS Edge Functions

#### `crm-get-customer`
```typescript
// supabase/functions/crm-get-customer/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");
  const uniqueCode = url.searchParams.get("unique_code");
  
  // Check cache first
  const { data: cached } = await supabase
    .from("crm_customer_cache")
    .select("*")
    .or(`crm_customer_id.eq.${customerId},unique_code.eq.${uniqueCode}`)
    .gt("stale_at", new Date().toISOString())
    .single();
  
  if (cached) {
    return new Response(JSON.stringify({ success: true, data: cached, source: "cache" }));
  }
  
  // Call CRM API
  const crmResponse = await fetch(
    `${Deno.env.get("CRM_API_URL")}/crm-get-customer?${customerId ? `customer_id=${customerId}` : `unique_code=${uniqueCode}`}`,
    {
      headers: {
        "X-API-Key": Deno.env.get("CRM_API_KEY")!,
        "Content-Type": "application/json"
      }
    }
  );
  
  const crmData = await crmResponse.json();
  
  // Update cache
  if (crmData.success) {
    await supabase.from("crm_customer_cache").upsert({
      crm_customer_id: crmData.data.id,
      crm_organization_id: crmData.data.organization_id,
      company_name: crmData.data.company_name,
      unique_code: crmData.data.unique_code,
      email: crmData.data.email,
      phone: crmData.data.phone,
      contacts: crmData.data.contacts,
      payment_terms: crmData.data.payment_terms,
      cached_at: new Date().toISOString(),
      stale_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  return new Response(JSON.stringify({ success: true, data: crmData.data, source: "api" }));
});
```

#### `crm-search-customers`
```typescript
// supabase/functions/crm-search-customers/index.ts
serve(async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query");
  const limit = url.searchParams.get("limit") || "10";
  
  const crmResponse = await fetch(
    `${Deno.env.get("CRM_API_URL")}/crm-search-customers?query=${encodeURIComponent(query!)}&limit=${limit}`,
    {
      headers: {
        "X-API-Key": Deno.env.get("CRM_API_KEY")!,
        "Content-Type": "application/json"
      }
    }
  );
  
  const data = await crmResponse.json();
  return new Response(JSON.stringify(data));
});
```

#### `process-integration-outbox` (CRON: every 30 seconds)
```typescript
// supabase/functions/process-integration-outbox/index.ts
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  // Get pending events
  const { data: events } = await supabase
    .from("integration_outbox")
    .select("*")
    .eq("status", "pending")
    .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(10);
  
  for (const event of events || []) {
    // Mark as processing
    await supabase
      .from("integration_outbox")
      .update({ status: "processing" })
      .eq("id", event.id);
    
    try {
      // Sign webhook
      const { signature, timestamp } = signWebhook(event.payload, Deno.env.get("CRM_WEBHOOK_SECRET")!);
      
      // Send to CRM
      const response = await fetch(`${Deno.env.get("CRM_API_URL")}/crm-webhook-receiver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": Deno.env.get("CRM_API_KEY")!,
          "X-WMS-Signature": signature,
          "X-WMS-Timestamp": timestamp.toString()
        },
        body: JSON.stringify({
          event_type: event.event_type,
          idempotency_key: event.idempotency_key,
          timestamp: event.created_at,
          payload: event.payload
        })
      });
      
      if (response.ok) {
        await supabase
          .from("integration_outbox")
          .update({ status: "sent", processed_at: new Date().toISOString() })
          .eq("id", event.id);
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      const newRetryCount = event.retry_count + 1;
      const nextRetry = new Date(Date.now() + Math.pow(2, newRetryCount) * 1000 * 60);
      
      await supabase
        .from("integration_outbox")
        .update({
          status: newRetryCount >= event.max_retries ? "dead_letter" : "pending",
          retry_count: newRetryCount,
          next_retry_at: nextRetry.toISOString(),
          last_error: error.message
        })
        .eq("id", event.id);
    }
  }
  
  return new Response(JSON.stringify({ processed: events?.length || 0 }));
});
```

#### `wms-webhook-receiver` (Receive CRM events)
```typescript
// supabase/functions/wms-webhook-receiver/index.ts
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  // Validate HMAC signature
  const signature = req.headers.get("X-CRM-Signature");
  const timestamp = req.headers.get("X-CRM-Timestamp");
  const body = await req.text();
  
  if (!validateSignature(body, signature!, timestamp!, Deno.env.get("CRM_WEBHOOK_SECRET")!)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }
  
  const event = JSON.parse(body);
  
  // Check idempotency
  const { data: existing } = await supabase
    .from("integration_events_received")
    .select("id")
    .eq("idempotency_key", event.idempotency_key)
    .single();
  
  if (existing) {
    return new Response(JSON.stringify({ success: true, message: "Already processed" }));
  }
  
  // Process event
  switch (event.event_type) {
    case "deal.confirmed":
      await handleDealConfirmed(supabase, event.payload);
      break;
    case "deal.cancelled":
      await handleDealCancelled(supabase, event.payload);
      break;
    case "deal.lines_updated":
      await handleDealLinesUpdated(supabase, event.payload);
      break;
  }
  
  // Record event
  await supabase.from("integration_events_received").insert({
    event_type: event.event_type,
    idempotency_key: event.idempotency_key,
    payload: event.payload,
    processed_at: new Date().toISOString()
  });
  
  return new Response(JSON.stringify({ success: true }));
});
```

#### `integration-reconciler` (CRON: every 6 hours)
```typescript
// supabase/functions/integration-reconciler/index.ts
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  // Start sync log
  const { data: syncLog } = await supabase
    .from("integration_sync_log")
    .insert({
      sync_type: "reconciliation",
      source_system: "wms",
      target_system: "crm",
      status: "running"
    })
    .select()
    .single();
  
  const discrepancies: any[] = [];
  let recordsChecked = 0;
  let recordsSynced = 0;
  
  // Check stale cache entries
  const { data: staleCache } = await supabase
    .from("crm_customer_cache")
    .select("*")
    .lt("stale_at", new Date().toISOString());
  
  for (const entry of staleCache || []) {
    recordsChecked++;
    // Refresh from CRM API
    // ... refresh logic
    recordsSynced++;
  }
  
  // Check for orphaned reservations
  const { data: orphanedReservations } = await supabase
    .from("reservations")
    .select("*")
    .not("crm_deal_id", "is", null)
    .eq("status", "active");
  
  // Validate each against CRM
  // ... validation logic
  
  // Update sync log
  await supabase
    .from("integration_sync_log")
    .update({
      records_checked: recordsChecked,
      records_synced: recordsSynced,
      discrepancies,
      completed_at: new Date().toISOString(),
      status: "completed"
    })
    .eq("id", syncLog!.id);
  
  return new Response(JSON.stringify({ 
    checked: recordsChecked, 
    synced: recordsSynced,
    discrepancies: discrepancies.length 
  }));
});
```

---

## Database Migrations

### Phase F-0: Foundation

```sql
-- Migration: Add CRM linkage columns
ALTER TABLE orders ADD COLUMN crm_customer_id UUID;
ALTER TABLE orders ADD COLUMN crm_deal_id UUID;
ALTER TABLE reservations ADD COLUMN crm_customer_id UUID;
ALTER TABLE reservations ADD COLUMN crm_deal_id UUID;
ALTER TABLE reservations ADD COLUMN crm_organization_id TEXT;
ALTER TABLE inquiries ADD COLUMN crm_customer_id UUID;

-- Create indexes for CRM lookups
CREATE INDEX idx_orders_crm_customer ON orders(crm_customer_id) WHERE crm_customer_id IS NOT NULL;
CREATE INDEX idx_orders_crm_deal ON orders(crm_deal_id) WHERE crm_deal_id IS NOT NULL;
CREATE INDEX idx_reservations_crm_deal ON reservations(crm_deal_id) WHERE crm_deal_id IS NOT NULL;

-- Integration outbox table
CREATE TABLE integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  target_system TEXT NOT NULL DEFAULT 'crm',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_outbox_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter'))
);

CREATE INDEX idx_outbox_pending ON integration_outbox(status, next_retry_at) 
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_outbox_created ON integration_outbox(created_at);

-- CRM customer cache
CREATE TABLE crm_customer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id UUID NOT NULL,
  crm_organization_id TEXT,
  company_name TEXT NOT NULL,
  unique_code TEXT,
  email TEXT,
  phone TEXT,
  contacts JSONB DEFAULT '[]'::jsonb,
  payment_terms JSONB,
  cached_at TIMESTAMPTZ DEFAULT now(),
  stale_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  
  CONSTRAINT unique_crm_customer UNIQUE (crm_customer_id)
);

CREATE INDEX idx_cache_customer ON crm_customer_cache(crm_customer_id);
CREATE INDEX idx_cache_code ON crm_customer_cache(unique_code);
CREATE INDEX idx_cache_stale ON crm_customer_cache(stale_at);

-- Integration sync log
CREATE TABLE integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  source_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  records_checked INTEGER DEFAULT 0,
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  discrepancies JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  error_message TEXT
);

-- Integration events received (for idempotency)
CREATE TABLE integration_events_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_idempotency ON integration_events_received(idempotency_key);

-- Feature flags
CREATE TABLE integration_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

INSERT INTO integration_feature_flags (flag_key, flag_value, description) VALUES
  ('integration_enabled', false, 'Master switch for CRM integration'),
  ('crm_customer_sync', false, 'Enable customer data sync from CRM'),
  ('crm_reservation_events', false, 'Send reservation events to CRM'),
  ('crm_order_events', false, 'Send order events to CRM'),
  ('crm_shipment_events', false, 'Send shipment events to CRM'),
  ('crm_inventory_events', false, 'Send inventory events to CRM'),
  ('crm_masked_stock', true, 'Return masked stock levels to CRM API');
```

### Phase F-1: Outbox Triggers

```sql
-- Trigger function for reservation events
CREATE OR REPLACE FUNCTION trg_notify_crm_reservation()
RETURNS TRIGGER AS $$
DECLARE
  v_flag_enabled BOOLEAN;
BEGIN
  -- Check feature flag
  SELECT flag_value INTO v_flag_enabled 
  FROM integration_feature_flags 
  WHERE flag_key = 'crm_reservation_events';
  
  IF NOT COALESCE(v_flag_enabled, false) THEN
    RETURN NEW;
  END IF;
  
  -- Only process if linked to CRM
  IF NEW.crm_deal_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Insert into outbox
  INSERT INTO integration_outbox (
    organization_id,
    event_type,
    payload,
    target_system,
    idempotency_key
  ) VALUES (
    NEW.crm_organization_id::uuid,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'reservation.created'
      WHEN NEW.status = 'released' THEN 'reservation.released'
      WHEN NEW.status = 'cancelled' THEN 'reservation.released'
      ELSE 'reservation.updated'
    END,
    jsonb_build_object(
      'wms_reservation_id', NEW.id,
      'crm_organization_id', NEW.crm_organization_id,
      'crm_customer_id', NEW.crm_customer_id,
      'crm_deal_id', NEW.crm_deal_id,
      'reservation_number', NEW.reservation_number,
      'status', NEW.status,
      'expires_at', NEW.expiry_date
    ),
    'crm',
    NEW.id::text || '_' || TG_OP || '_v' || COALESCE(NEW.version, 1)::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_reservation_crm_notify
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_crm_reservation();

-- Similar triggers for orders, shipments, inquiries...
```

---

## RLS Policies

```sql
-- Outbox: Service role only for writes
ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to outbox"
  ON integration_outbox FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Cache: Service role writes, authenticated reads
ALTER TABLE crm_customer_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage cache"
  ON crm_customer_cache FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated users can read cache"
  ON crm_customer_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Sync log: Service role writes, authenticated reads
ALTER TABLE integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage sync log"
  ON integration_sync_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated users can read sync log"
  ON integration_sync_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- Feature flags: Service role + admin writes
ALTER TABLE integration_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage flags"
  ON integration_feature_flags FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admin users can manage flags"
  ON integration_feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read flags"
  ON integration_feature_flags FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## Frontend Components

### `CRMCustomerAutocomplete.tsx`
```tsx
// src/components/crm/CRMCustomerAutocomplete.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Autocomplete } from "@/components/ui/autocomplete";

interface CRMCustomer {
  id: string;
  company_name: string;
  unique_code: string;
  email?: string;
}

interface Props {
  value?: string;
  onChange: (customer: CRMCustomer | null) => void;
  disabled?: boolean;
}

export function CRMCustomerAutocomplete({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  
  const { data: customers, isLoading } = useQuery({
    queryKey: ["crm-customers", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      
      const { data, error } = await supabase.functions.invoke("crm-search-customers", {
        body: { query, limit: 10 }
      });
      
      if (error) throw error;
      return data.data || [];
    },
    enabled: query.length >= 2
  });
  
  return (
    <Autocomplete
      placeholder="Search CRM customers..."
      value={value}
      onInputChange={setQuery}
      options={customers?.map((c: CRMCustomer) => ({
        value: c.id,
        label: `${c.company_name} (${c.unique_code})`,
        data: c
      })) || []}
      onSelect={(option) => onChange(option?.data || null)}
      loading={isLoading}
      disabled={disabled}
    />
  );
}
```

### `IntegrationStatusDashboard.tsx`
```tsx
// src/components/admin/IntegrationStatusDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function IntegrationStatusDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["integration-stats"],
    queryFn: async () => {
      const [outbox, syncLog, flags] = await Promise.all([
        supabase.from("integration_outbox")
          .select("status", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("integration_sync_log")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(1)
          .single(),
        supabase.from("integration_feature_flags")
          .select("flag_key, flag_value")
      ]);
      
      return {
        pendingEvents: outbox.count || 0,
        lastSync: syncLog.data,
        flags: flags.data || []
      };
    }
  });
  
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Pending Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.pendingEvents || 0}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Last Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {stats?.lastSync?.completed_at 
              ? new Date(stats.lastSync.completed_at).toLocaleString()
              : "Never"}
          </div>
          <Badge variant={stats?.lastSync?.status === "completed" ? "default" : "destructive"}>
            {stats?.lastSync?.status || "Unknown"}
          </Badge>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.flags.map((flag: any) => (
              <div key={flag.flag_key} className="flex justify-between">
                <span className="text-sm">{flag.flag_key}</span>
                <Badge variant={flag.flag_value ? "default" : "secondary"}>
                  {flag.flag_value ? "ON" : "OFF"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### `DeadLetterQueueViewer.tsx`
```tsx
// src/components/admin/DeadLetterQueueViewer.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export function DeadLetterQueueViewer() {
  const queryClient = useQueryClient();
  
  const { data: deadLetters } = useQuery({
    queryKey: ["dead-letter-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_outbox")
        .select("*")
        .eq("status", "dead_letter")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
  
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("integration_outbox")
        .update({ status: "pending", retry_count: 0, next_retry_at: null })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dead-letter-queue"] });
      toast.success("Event queued for retry");
    }
  });
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event Type</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last Error</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deadLetters?.map((event) => (
          <TableRow key={event.id}>
            <TableCell>{event.event_type}</TableCell>
            <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
            <TableCell className="max-w-xs truncate">{event.last_error}</TableCell>
            <TableCell>
              <Button 
                size="sm" 
                onClick={() => retryMutation.mutate(event.id)}
              >
                Retry
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### `IntegrationFeatureFlags.tsx`
```tsx
// src/components/admin/IntegrationFeatureFlags.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function IntegrationFeatureFlags() {
  const queryClient = useQueryClient();
  
  const { data: flags } = useQuery({
    queryKey: ["integration-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_feature_flags")
        .select("*")
        .order("flag_key");
      
      if (error) throw error;
      return data;
    }
  });
  
  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("integration_feature_flags")
        .update({ flag_value: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-flags"] });
      toast.success("Flag updated");
    }
  });
  
  return (
    <div className="space-y-4">
      {flags?.map((flag) => (
        <div key={flag.id} className="flex items-center justify-between">
          <div>
            <Label>{flag.flag_key}</Label>
            <p className="text-sm text-muted-foreground">{flag.description}</p>
          </div>
          <Switch
            checked={flag.flag_value}
            onCheckedChange={(checked) => 
              toggleMutation.mutate({ id: flag.id, value: checked })
            }
          />
        </div>
      ))}
    </div>
  );
}
```

---

## Feature Flags

| Flag Key | Default | Description |
|----------|---------|-------------|
| `integration_enabled` | `false` | Master switch for all CRM integration |
| `crm_customer_sync` | `false` | Enable customer search/lookup from CRM |
| `crm_reservation_events` | `false` | Send reservation events to CRM |
| `crm_order_events` | `false` | Send order events to CRM |
| `crm_shipment_events` | `false` | Send shipment events to CRM |
| `crm_inventory_events` | `false` | Send inventory/stock events to CRM |
| `crm_masked_stock` | `true` | Return masked stock levels in API |

---

## Implementation Phases

### Phase F-0: Foundation (1-2 days)

**WMS Tasks:**
- [ ] Create migration for CRM linkage columns
- [ ] Create `integration_outbox` table
- [ ] Create `crm_customer_cache` table
- [ ] Create `integration_sync_log` table
- [ ] Create `integration_events_received` table
- [ ] Create `integration_feature_flags` table with defaults
- [ ] Add RLS policies for all new tables
- [ ] Configure secrets in Vault (`CRM_API_KEY`, `CRM_API_URL`, `CRM_WEBHOOK_SECRET`)

**Acceptance Criteria:**
- All migrations apply without error
- RLS policies pass security audit
- Vault secrets accessible from Edge Functions
- Feature flags default to disabled

### Phase F-1: Customer Sync + Reservation Flow (3-4 days)

**WMS Tasks:**
- [ ] Create `crm-get-customer` Edge Function
- [ ] Create `crm-search-customers` Edge Function
- [ ] Create `process-integration-outbox` Edge Function (CRON)
- [ ] Create `trg_notify_crm_reservation` trigger
- [ ] Create `CRMCustomerAutocomplete.tsx` component
- [ ] Integrate autocomplete in `ReservationDialog.tsx`
- [ ] Integrate autocomplete in order forms
- [ ] Display CRM customer info in order details

**Acceptance Criteria:**
- Customer search returns CRM data < 500ms
- Orders created with `crm_customer_id` populated
- Reservations trigger `reservation.created` webhook
- CRM receives webhook within 60s (p99)
- Webhook delivery success rate > 99%

### Phase F-2: Order Fulfillment + Shipment (3-4 days)

**WMS Tasks:**
- [ ] Create order event triggers (`order.created`, `order.fulfilled`, `order.cancelled`)
- [ ] Create shipment event trigger (`shipment.posted`)
- [ ] Create reservation release trigger
- [ ] Create inquiry event triggers
- [ ] Create inventory event triggers
- [ ] Update `api-get-inventory` for `masked=true` support
- [ ] Add HMAC signing to all outgoing webhooks

**Acceptance Criteria:**
- WMS order fulfilled updates CRM within 60s
- Stock changes trigger events within 15 minutes
- HMAC validation rejects invalid signatures
- `api-get-inventory` supports `masked=true`

### Phase F-3: Edge Cases & Polish (2-3 days)

**WMS Tasks:**
- [ ] Create `integration-reconciler` CRON function
- [ ] Create `wms-webhook-receiver` Edge Function
- [ ] Handle `deal.cancelled` event
- [ ] Handle `deal.lines_updated` event
- [ ] Create `IntegrationStatusDashboard.tsx`
- [ ] Create `DeadLetterQueueViewer.tsx`
- [ ] Create `IntegrationFeatureFlags.tsx`
- [ ] Add deep links to CRM in order details
- [ ] Add integration tab to Admin page

**Acceptance Criteria:**
- CRON detects and heals stale data every 6 hours
- Failed webhooks retried with exponential backoff
- Admin can view/retry failed events
- Deep links work bidirectionally
- Cancel flow unreserves stock correctly
- Data consistency > 99.9%

---

## Testing Strategy

### Unit Tests
- HMAC signature generation/validation
- Stock status calculation (`getStockStatus`)
- Idempotency key generation
- Cache TTL logic

### Integration Tests
- Outbox → Webhook delivery cycle
- Customer search → Cache update
- Reservation create → CRM notification
- Deal confirmed → Reservation creation

### End-to-End Tests
- Full order flow: Customer select → Order → Fulfill → Ship
- Cancel flow: Deal cancelled → Reservation released
- Quantity change: Deal lines updated → Reservation adjusted

---

## Rollback Plan

### Immediate (< 1 minute)
1. Disable all feature flags via Admin UI
2. All event processing stops immediately

### Quick (< 5 minutes)
1. Stop CRON functions (`process-integration-outbox`, `integration-reconciler`)
2. Events remain in outbox for later processing

### Moderate (< 30 minutes)
1. Disable database triggers
2. Events stop being added to outbox

### Full Rollback (with backup)
1. Export data from new tables
2. Drop new columns and tables
3. Restore from backup if needed

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Deal → Reservation Sync | p99 < 60s | Time from CRM event to WMS reservation created |
| Customer Lookup | < 500ms | Time from search to results displayed |
| Webhook Delivery | > 99% | Successful deliveries / total attempts |
| Dead Letter Rate | < 1% | Dead letter events / total events |
| Data Consistency | > 99.9% | Matching records after reconciliation |
| Zero Duplicate Events | 0 | Duplicate idempotency keys rejected |
| Cache Hit Rate | > 80% | Cache hits / total customer lookups |

---

## Coordination Points

### Required from CRM Team
1. API key for WMS to call CRM endpoints
2. Webhook secret for WMS to sign payloads
3. CRM webhook endpoint URL
4. API endpoint URLs for customer search/lookup

### Required from WMS Team
1. API key for CRM to call WMS endpoints
2. Webhook secret for CRM to sign payloads
3. WMS webhook endpoint URL
4. Stock availability API URL

### Shared Decisions
- Webhook retry policy (5 retries, exponential backoff)
- Cache TTL (24 hours)
- Reconciliation frequency (every 6 hours)
- Stock masking threshold (100 meters)
