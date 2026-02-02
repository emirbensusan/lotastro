/**
 * WMS Webhook Receiver
 * 
 * Handles inbound CRM events per integration_contract_v1.md Section 2.2:
 * - deal.approved
 * - deal.accepted
 * - deal.won
 * - deal.cancelled
 * - deal.lines_updated
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-crm-signature, x-crm-timestamp',
};

interface CRMEvent {
  event_type: string;
  idempotency_key: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

interface DealLine {
  crm_line_id: string;
  quality_code: string;
  color_code: string;
  quantity_meters: number;
}

interface DealWonPayload {
  crm_deal_id: string;
  crm_organization_id?: string;
  crm_customer_id?: string;
  customer_ref?: string;
  deal_number?: string;
  lines: DealLine[];
  requested_delivery_date?: string;
  priority?: string;
}

interface DealCancelledPayload {
  crm_deal_id: string;
  reason?: string;
  notes?: string;
}

interface DealLineChange {
  crm_line_id: string;
  action: 'quantity_reduced' | 'quantity_increased' | 'line_removed';
  quality_code: string;
  color_code: string;
  old_quantity: number;
  new_quantity: number;
}

interface DealLinesUpdatedPayload {
  crm_deal_id: string;
  changes: DealLineChange[];
}

// Verify HMAC signature from CRM
async function verifySignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const message = `${timestamp}.${payload}`;
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === expectedSignature;
}

// Check idempotency - has this event already been processed?
// Returns existing record with attempt_count for null-safe retry (per Contract Appendix D.3)
async function checkIdempotency(
  supabase: ReturnType<typeof createClient>,
  idempotencyKey: string
): Promise<{ exists: boolean; status?: string; attemptCount?: number; id?: string }> {
  const { data } = await supabase
    .from('integration_outbox')
    .select('id, status, attempt_count')
    .eq('idempotency_key', idempotencyKey)
    .single();
  
  if (!data) {
    return { exists: false };
  }
  
  return { 
    exists: true, 
    status: data.status, 
    attemptCount: data.attempt_count ?? 0,
    id: data.id 
  };
}

// Log received event
async function logReceivedEvent(
  supabase: ReturnType<typeof createClient>,
  event: CRMEvent,
  status: 'received' | 'processed' | 'error',
  error?: string
): Promise<void> {
  await supabase.from('integration_outbox').insert({
    event_type: event.event_type,
    payload: event.payload,
    target_system: 'wms',
    status: status === 'processed' ? 'sent' : status === 'error' ? 'failed' : 'pending',
    idempotency_key: event.idempotency_key,
    last_error: error,
    processed_at: status === 'processed' ? new Date().toISOString() : null,
  });
}

// Handle deal.approved event
async function handleDealApproved(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  // Log for future use - deal.approved may trigger pre-reservation logic
  console.log('[wms-webhook-receiver] deal.approved received:', payload);
  
  return {
    success: true,
    message: 'deal.approved received and logged for future processing',
  };
}

// Handle deal.accepted event
async function handleDealAccepted(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  // Log for future use - deal.accepted may trigger quote confirmation
  console.log('[wms-webhook-receiver] deal.accepted received:', payload);
  
  return {
    success: true,
    message: 'deal.accepted received and logged for future processing',
  };
}

// Handle deal.won event - creates reservation or order
async function handleDealWon(
  supabase: ReturnType<typeof createClient>,
  payload: DealWonPayload
): Promise<{ success: boolean; message: string; reservation_id?: string }> {
  console.log('[wms-webhook-receiver] deal.won received:', payload);
  
  // Check if reservation already exists for this deal
  const { data: existingReservation } = await supabase
    .from('reservations')
    .select('id, reservation_number')
    .eq('crm_deal_id', payload.crm_deal_id)
    .single();
  
  if (existingReservation) {
    return {
      success: true,
      message: `Reservation already exists: ${existingReservation.reservation_number}`,
      reservation_id: existingReservation.id,
    };
  }
  
  // Calculate total meters from lines
  const totalMeters = payload.lines.reduce((sum, line) => sum + line.quantity_meters, 0);
  
  // Create reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      customer_name: payload.customer_ref || 'CRM Customer',
      crm_deal_id: payload.crm_deal_id,
      crm_customer_id: payload.crm_customer_id,
      crm_organization_id: payload.crm_organization_id,
      status: 'active',
      hold_until: payload.requested_delivery_date,
      notes: `Created from CRM Deal: ${payload.deal_number || payload.crm_deal_id}`,
    })
    .select('id, reservation_number')
    .single();
  
  if (reservationError) {
    console.error('[wms-webhook-receiver] Failed to create reservation:', reservationError);
    return {
      success: false,
      message: `Failed to create reservation: ${reservationError.message}`,
    };
  }
  
  // Create reservation lines
  const reservationLines = payload.lines.map(line => ({
    reservation_id: reservation.id,
    quality: line.quality_code,
    color: line.color_code,
    reserved_meters: line.quantity_meters,
    scope: 'INVENTORY',
  }));
  
  const { error: linesError } = await supabase
    .from('reservation_lines')
    .insert(reservationLines);
  
  if (linesError) {
    console.error('[wms-webhook-receiver] Failed to create reservation lines:', linesError);
    // Rollback reservation
    await supabase.from('reservations').delete().eq('id', reservation.id);
    return {
      success: false,
      message: `Failed to create reservation lines: ${linesError.message}`,
    };
  }
  
  console.log('[wms-webhook-receiver] Created reservation:', reservation.reservation_number);
  
  return {
    success: true,
    message: `Reservation created: ${reservation.reservation_number}`,
    reservation_id: reservation.id,
  };
}

// Handle deal.cancelled event - releases reservation and marks order action_required
async function handleDealCancelled(
  supabase: ReturnType<typeof createClient>,
  payload: DealCancelledPayload
): Promise<{ success: boolean; message: string }> {
  console.log('[wms-webhook-receiver] deal.cancelled received:', payload);
  
  // Find and update reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .update({
      status: 'released',
      release_reason: 'cancelled',
      canceled_at: new Date().toISOString(),
      cancel_other_text: payload.notes || payload.reason,
    })
    .eq('crm_deal_id', payload.crm_deal_id)
    .eq('status', 'active')
    .select('id, reservation_number')
    .single();
  
  // Find and update order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      action_required: true,
    })
    .eq('crm_deal_id', payload.crm_deal_id)
    .neq('status', 'cancelled')
    .select('id, order_number')
    .single();
  
  const results: string[] = [];
  
  if (reservation) {
    results.push(`Reservation ${reservation.reservation_number} released`);
  }
  if (order) {
    results.push(`Order ${order.order_number} cancelled with action_required=true`);
  }
  
  if (results.length === 0) {
    return {
      success: true,
      message: 'No active reservations or orders found for this deal',
    };
  }
  
  return {
    success: true,
    message: results.join('; '),
  };
}

// Handle deal.lines_updated event - adjusts reservation lines
async function handleDealLinesUpdated(
  supabase: ReturnType<typeof createClient>,
  payload: DealLinesUpdatedPayload
): Promise<{ success: boolean; message: string }> {
  console.log('[wms-webhook-receiver] deal.lines_updated received:', payload);
  
  // Find reservation for this deal
  const { data: reservation, error: findError } = await supabase
    .from('reservations')
    .select('id, reservation_number')
    .eq('crm_deal_id', payload.crm_deal_id)
    .eq('status', 'active')
    .single();
  
  if (!reservation) {
    return {
      success: false,
      message: 'No active reservation found for this deal',
    };
  }
  
  const updates: string[] = [];
  
  for (const change of payload.changes) {
    if (change.action === 'line_removed') {
      // Delete the line
      const { error } = await supabase
        .from('reservation_lines')
        .delete()
        .eq('reservation_id', reservation.id)
        .eq('quality', change.quality_code)
        .eq('color', change.color_code);
      
      if (!error) {
        updates.push(`Removed line: ${change.quality_code}/${change.color_code}`);
      }
    } else {
      // Update quantity
      const { error } = await supabase
        .from('reservation_lines')
        .update({ reserved_meters: change.new_quantity })
        .eq('reservation_id', reservation.id)
        .eq('quality', change.quality_code)
        .eq('color', change.color_code);
      
      if (!error) {
        updates.push(`Updated ${change.quality_code}/${change.color_code}: ${change.old_quantity} → ${change.new_quantity}`);
      }
    }
  }
  
  return {
    success: true,
    message: `Reservation ${reservation.reservation_number} updated: ${updates.join('; ')}`,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const crmWebhookSecret = Deno.env.get('CRM_WEBHOOK_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get raw body for signature verification
    const rawBody = await req.text();
    let event: CRMEvent;
    
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify signature if secret is configured
    if (crmWebhookSecret) {
      const signature = req.headers.get('x-crm-signature');
      const timestamp = req.headers.get('x-crm-timestamp');
      
      if (!signature || !timestamp) {
        return new Response(
          JSON.stringify({ error: 'Missing signature or timestamp headers' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check timestamp is within 5 minutes
      const timestampMs = parseInt(timestamp);
      const now = Date.now();
      if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
        return new Response(
          JSON.stringify({ error: 'Timestamp too old' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const isValid = await verifySignature(rawBody, signature, timestamp, crmWebhookSecret);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Check idempotency with full record for retry semantics (per Contract Appendix D.3)
    if (event.idempotency_key) {
      const existing = await checkIdempotency(supabase, event.idempotency_key);
      
      if (existing.exists) {
        // Already processed - return 200 per contract
        if (['sent', 'processing', 'pending'].includes(existing.status || '')) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Event already processed (idempotent)',
              idempotency_key: event.idempotency_key,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Failed status - update to pending for retry with null-safe increment
        if (existing.status === 'failed' && existing.id) {
          await supabase.from('integration_outbox')
            .update({
              status: 'pending',
              attempt_count: (existing.attemptCount ?? 0) + 1,
              last_error: null,
            })
            .eq('id', existing.id);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Queued for retry',
              idempotency_key: event.idempotency_key,
              attempt: (existing.attemptCount ?? 0) + 1,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
    // Route to appropriate handler
    let result: { success: boolean; message: string; [key: string]: unknown };
    
    switch (event.event_type) {
      case 'deal.approved':
        result = await handleDealApproved(supabase, event.payload);
        break;
      case 'deal.accepted':
        result = await handleDealAccepted(supabase, event.payload);
        break;
      case 'deal.won':
        result = await handleDealWon(supabase, event.payload as unknown as DealWonPayload);
        break;
      case 'deal.cancelled':
        result = await handleDealCancelled(supabase, event.payload as unknown as DealCancelledPayload);
        break;
      case 'deal.lines_updated':
        result = await handleDealLinesUpdated(supabase, event.payload as unknown as DealLinesUpdatedPayload);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown event type: ${event.event_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    // Log the event
    await logReceivedEvent(
      supabase,
      event,
      result.success ? 'processed' : 'error',
      result.success ? undefined : result.message
    );
    
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('[wms-webhook-receiver] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
