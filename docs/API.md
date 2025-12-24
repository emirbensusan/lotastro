# LotAstro WMS - API Documentation

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Backend**: Supabase (PostgreSQL + Edge Functions)

---

## Overview

LotAstro WMS uses Supabase as its backend, providing:
- **PostgreSQL Database**: Direct access via Supabase client
- **Row Level Security (RLS)**: Authorization at database level
- **Edge Functions**: Serverless Deno functions for complex operations
- **Realtime**: WebSocket subscriptions for live updates

---

## 1. Authentication

### Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   Supabase  │───▶│   Auth      │───▶│   Database  │
│   (React)   │    │   Client    │    │   Service   │    │   (RLS)     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Sign In

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure_password'
});

// Response
interface AuthResponse {
  user: User | null;
  session: Session | null;
}
```

### Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'newuser@example.com',
  password: 'secure_password',
  options: {
    data: {
      full_name: 'New User'
    }
  }
});
```

### Sign Out

```typescript
const { error } = await supabase.auth.signOut();
```

### Session Management

```typescript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Handle sign in
  } else if (event === 'SIGNED_OUT') {
    // Handle sign out
  }
});
```

### JWT Token

The JWT is automatically included in all Supabase requests. For Edge Functions:

```typescript
// Authorization header is automatically set
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* payload */ }
});
```

---

## 2. Database Operations (CRUD)

### Lots

#### List Lots

```typescript
const { data, error } = await supabase
  .from('lots')
  .select(`
    *,
    supplier:suppliers(id, name),
    rolls(*)
  `)
  .eq('status', 'available')
  .order('created_at', { ascending: false });
```

#### Get Single Lot

```typescript
const { data, error } = await supabase
  .from('lots')
  .select(`
    *,
    supplier:suppliers(id, name, contact_email),
    rolls(*)
  `)
  .eq('id', lotId)
  .single();
```

#### Create Lot

```typescript
const { data, error } = await supabase
  .from('lots')
  .insert({
    lot_number: 'LOT-2025-001',
    quality: 'SELENA',
    color: 'Navy Blue',
    supplier_id: supplierId,
    meters: 500,
    roll_count: 5,
    warehouse_location: 'A1-R3'
  })
  .select()
  .single();
```

#### Update Lot

```typescript
const { data, error } = await supabase
  .from('lots')
  .update({
    meters: 450,
    notes: 'Updated after partial sale'
  })
  .eq('id', lotId)
  .select()
  .single();
```

#### Delete Lot

```typescript
const { error } = await supabase
  .from('lots')
  .delete()
  .eq('id', lotId);
```

### Orders

#### Create Order with Lines

```typescript
// Start transaction using RPC or multiple operations
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    customer_name: 'ACME Textiles',
    created_by: userId
  })
  .select()
  .single();

if (order) {
  const { error: linesError } = await supabase
    .from('order_lots')
    .insert(lines.map(line => ({
      order_id: order.id,
      lot_id: line.lotId,
      quality: line.quality,
      color: line.color,
      roll_count: line.rollCount,
      selected_roll_ids: JSON.stringify(line.rollIds)
    })));
}
```

### Manufacturing Orders

#### List with Status History

```typescript
const { data, error } = await supabase
  .from('manufacturing_orders')
  .select(`
    *,
    supplier:suppliers(id, name),
    status_history:mo_status_history(
      id,
      old_status,
      new_status,
      notes,
      changed_at,
      changed_by
    )
  `)
  .order('created_at', { ascending: false });
```

#### Update Status

```typescript
// Update MO and log history
const { error: updateError } = await supabase
  .from('manufacturing_orders')
  .update({ 
    status: 'in_production',
    updated_by: userId
  })
  .eq('id', moId);

const { error: historyError } = await supabase
  .from('mo_status_history')
  .insert({
    manufacturing_order_id: moId,
    old_status: 'pending',
    new_status: 'in_production',
    notes: 'Production started',
    changed_by: userId
  });
```

### Reservations

#### Create Reservation with Lines

```typescript
const { data: reservation, error } = await supabase
  .from('reservations')
  .insert({
    customer_name: 'Fashion Co',
    hold_until: '2025-01-20',
    created_by: userId
  })
  .select()
  .single();

if (reservation) {
  // Add reservation lines
  await supabase
    .from('reservation_lines')
    .insert({
      reservation_id: reservation.id,
      lot_id: lotId,
      quality: 'MONTANA',
      color: 'Black',
      reserved_meters: 100,
      scope: 'stock'
    });

  // Update lot reserved_meters
  await supabase.rpc('update_lot_reservation', {
    p_lot_id: lotId,
    p_meters: 100
  });
}
```

---

## 3. Database RPC Functions

### Dashboard Statistics

```typescript
const { data, error } = await supabase.rpc('get_dashboard_stats');

// Response
interface DashboardStats {
  total_lots: number;
  total_meters: number;
  pending_orders: number;
  active_reservations: number;
  open_manufacturing_orders: number;
  low_stock_alerts: number;
}
```

### Inventory Pivot Summary

```typescript
const { data, error } = await supabase.rpc('get_inventory_pivot_summary', {
  p_quality_filter: 'SELENA'
});

// Response
interface PivotRow {
  quality: string;
  color: string;
  total_meters: number;
  reserved_meters: number;
  available_meters: number;
  lot_count: number;
  roll_count: number;
}
```

### Inventory with Reservations

```typescript
const { data, error } = await supabase.rpc('get_inventory_with_reservations', {
  p_quality: 'MONTANA',
  p_color: 'Navy'
});
```

### Normalize Quality Code

```typescript
const { data, error } = await supabase.rpc('normalize_quality', {
  p_quality: 'selena 100'
});

// Returns: 'SELENA'
```

### Log Audit Action

```typescript
const { error } = await supabase.rpc('log_audit_action', {
  p_entity_type: 'lot',
  p_entity_id: lotId,
  p_action: 'update',
  p_old_data: JSON.stringify(oldData),
  p_new_data: JSON.stringify(newData),
  p_notes: 'Updated meters after measurement'
});
```

---

## 4. Edge Functions

### Function Inventory

| Function | Purpose | Auth | Method |
|----------|---------|------|--------|
| `admin-change-password` | Change user password | Admin | POST |
| `admin-deactivate-user` | Deactivate user account | Admin | POST |
| `admin-delete-user` | Hard delete user | Admin | DELETE |
| `admin-reconcile-users` | Sync auth.users with profiles | Admin | POST |
| `autocomplete-colors` | Get color suggestions | Yes | POST |
| `autocomplete-qualities` | Get quality suggestions | Yes | POST |
| `check-stock-alerts` | Check for low stock | CRON | POST |
| `cleanup-old-audit-logs` | Delete old audit entries | CRON | POST |
| `cleanup-old-drafts` | Remove expired drafts | CRON | POST |
| `confirm-draft` | Convert draft to order | Yes | POST |
| `extract-order` | AI extract order from input | Yes | POST |
| `forecast-engine` | Run forecast calculations | Yes | POST |
| `forecast-import-history` | Import demand history | Yes | POST |
| `generate-report-attachment` | Generate report file | Yes | POST |
| `get-report-schema` | Get database schema for reports | Yes | GET |
| `migrate-catalog-items` | Migrate catalog data | Admin | POST |
| `process-email-retries` | Retry failed emails | CRON | POST |
| `process-ocr-queue` | Process pending OCR jobs | CRON | POST |
| `repair-audit-inconsistencies` | Fix audit data issues | Admin | POST |
| `reverse-audit-action` | Undo an audited action | Admin | POST |
| `send-forecast-digest` | Email forecast summary | CRON | POST |
| `send-in-app-notification` | Send push notification | Yes | POST |
| `send-invitation` | Email user invitation | Admin | POST |
| `send-mo-reminders` | Email MO reminders | CRON | POST |
| `send-overdue-digest` | Email overdue items | CRON | POST |
| `send-pending-approvals-digest` | Email pending approvals | CRON | POST |
| `send-reservation-reminders` | Email reservation alerts | CRON | POST |
| `send-scheduled-report` | Send scheduled report | CRON | POST |
| `send-test-email` | Test email template | Yes | POST |
| `stock-take-ocr` | OCR process for stock take | Yes | POST |
| `test-extraction` | Test AI extraction | Yes | POST |
| `validate-extraction` | Validate extracted data | Yes | POST |

---

### AI Order Extraction

**Endpoint**: `extract-order`

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('extract-order', {
  body: {
    text: 'Order from customer:\n500m SELENA Navy\n300m MONTANA Black',
    source_type: 'manual',
    source_object_path: null
  }
});
```

**Response**:
```typescript
interface ExtractOrderResponse {
  success: boolean;
  draft_id: string;
  lines: {
    line_no: number;
    quality: string | null;
    color: string | null;
    meters: number | null;
    confidence_score: number;
    extraction_status: 'complete' | 'partial' | 'failed';
    source_row: string;
  }[];
  token_usage: {
    tokens_in: number;
    tokens_out: number;
  };
}
```

### Send Invitation

**Endpoint**: `send-invitation`

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('send-invitation', {
  body: {
    invitation_id: 'uuid',
    language: 'tr'
  }
});
```

**Response**:
```typescript
interface SendInvitationResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}
```

### Forecast Engine

**Endpoint**: `forecast-engine`

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('forecast-engine', {
  body: {
    run_type: 'full',
    quality_filter: ['SELENA', 'MONTANA'] // optional
  }
});
```

**Response**:
```typescript
interface ForecastEngineResponse {
  success: boolean;
  run_id: string;
  processed_combinations: number;
  alerts_generated: number;
  recommendations_count: number;
  duration_ms: number;
}
```

### Stock Take OCR

**Endpoint**: `stock-take-ocr`

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('stock-take-ocr', {
  body: {
    image_path: 'count_photos/session_123/roll_001.jpg',
    roll_id: 'uuid'
  }
});
```

**Response**:
```typescript
interface StockTakeOCRResponse {
  success: boolean;
  extracted: {
    quality: string | null;
    color: string | null;
    lot_number: string | null;
    meters: number | null;
  };
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  raw_text: string;
}
```

### Test Extraction

**Endpoint**: `test-extraction`

**Request**:
```typescript
const { data, error } = await supabase.functions.invoke('test-extraction', {
  body: {
    text: 'Sample order text...'
  }
});
```

**Response**:
```typescript
interface TestExtractionResponse {
  success: boolean;
  preprocessing: {
    original_length: number;
    cleaned_length: number;
    lines_found: number;
  };
  extraction: {
    total_rows: number;
    complete_count: number;
    partial_count: number;
    failed_count: number;
    avg_confidence: number;
  };
  rows: ExtractedRow[];
  database_context: {
    qualities_count: number;
    colors_count: number;
  };
  summary: string;
}
```

---

## 5. Error Handling

### Standard Error Format

```typescript
interface APIError {
  error: string;
  details?: string;
  code?: string;
  hint?: string;
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PGRST301` | 401 | JWT expired |
| `PGRST302` | 403 | RLS policy violation |
| `23505` | 409 | Unique constraint violation |
| `23503` | 409 | Foreign key violation |
| `42P01` | 404 | Table not found |

### Error Handling Pattern

```typescript
const { data, error } = await supabase
  .from('lots')
  .insert({ /* ... */ });

if (error) {
  if (error.code === '23505') {
    toast.error('A lot with this number already exists');
  } else if (error.code === 'PGRST302') {
    toast.error('You do not have permission to perform this action');
  } else {
    console.error('Database error:', error);
    toast.error('An error occurred. Please try again.');
  }
  return;
}
```

---

## 6. React Query Integration

### Custom Hook Pattern

```typescript
// hooks/useLots.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useLots = (filters?: LotFilters) => {
  return useQuery({
    queryKey: ['lots', filters],
    queryFn: async () => {
      let query = supabase
        .from('lots')
        .select(`*, supplier:suppliers(id, name), rolls(*)`);

      if (filters?.quality) {
        query = query.eq('quality', filters.quality);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
};

export const useCreateLot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lot: NewLot) => {
      const { data, error } = await supabase
        .from('lots')
        .insert(lot)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots'] });
    }
  });
};
```

### Usage in Components

```typescript
function LotsPage() {
  const { data: lots, isLoading, error } = useLots({ status: 'available' });
  const createLot = useCreateLot();

  const handleCreate = async (lotData: NewLot) => {
    try {
      await createLot.mutateAsync(lotData);
      toast.success('Lot created successfully');
    } catch (error) {
      toast.error('Failed to create lot');
    }
  };

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return <LotsList lots={lots} onCreate={handleCreate} />;
}
```

---

## 7. Rate Limits

### Supabase Limits

| Resource | Free Tier | Pro Tier |
|----------|-----------|----------|
| API Requests | 500K/month | 2M/month |
| Edge Function Invocations | 500K/month | 2M/month |
| Edge Function Memory | 256MB | 512MB |
| Edge Function Timeout | 60s | 60s |
| Database Connections | 60 | 200 |
| Storage | 1GB | 8GB |

### Best Practices

1. **Batch Operations**: Use bulk inserts instead of individual inserts
2. **Query Optimization**: Use `.select()` to limit returned columns
3. **Pagination**: Always paginate large result sets
4. **Caching**: Use React Query's caching capabilities

```typescript
// Paginated query
const { data, error } = await supabase
  .from('lots')
  .select('*', { count: 'exact' })
  .range(offset, offset + pageSize - 1);
```

---

## 8. Realtime Subscriptions

### Subscribe to Table Changes

```typescript
const subscription = supabase
  .channel('lots-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'lots' },
    (payload) => {
      console.log('Change received:', payload);
      queryClient.invalidateQueries({ queryKey: ['lots'] });
    }
  )
  .subscribe();

// Cleanup
return () => {
  subscription.unsubscribe();
};
```

### Subscribe to Specific Row

```typescript
const subscription = supabase
  .channel(`lot-${lotId}`)
  .on(
    'postgres_changes',
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'lots',
      filter: `id=eq.${lotId}`
    },
    (payload) => {
      console.log('Lot updated:', payload.new);
    }
  )
  .subscribe();
```

---

## 9. Storage API

### Upload File

```typescript
const { data, error } = await supabase.storage
  .from('catalog-images')
  .upload(`${userId}/${timestamp}_${filename}`, file, {
    cacheControl: '3600',
    upsert: false
  });
```

### Get Public URL

```typescript
const { data } = supabase.storage
  .from('catalog-images')
  .getPublicUrl('path/to/file.jpg');

// data.publicUrl
```

### Download File

```typescript
const { data, error } = await supabase.storage
  .from('catalog-spec-sheets')
  .download('path/to/file.pdf');

// data is a Blob
```

### List Files

```typescript
const { data, error } = await supabase.storage
  .from('catalog-images')
  .list(userId, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  });
```

---

## 10. Security Headers

### Edge Function CORS

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}

// Include in response
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### CRON Protection

```typescript
const cronSecret = Deno.env.get('CRON_SECRET');
const requestSecret = req.headers.get('x-cron-secret');

if (!cronSecret || requestSecret !== cronSecret) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: corsHeaders }
  );
}
```

---

## 11. API Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-10 | 1.0.0 | Initial API documentation |
| 2024-12-15 | - | Added stock-take-ocr function |
| 2024-11-20 | - | Added forecast-engine function |
| 2024-10-01 | - | Added extract-order AI function |
