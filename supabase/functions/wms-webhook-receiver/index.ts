/**
 *V3 WMS Webhook Receiver
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
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key, x-wms-signature, x-wms-timestamp, X-WMS-Signature, X-WMS-Timestamp',
};

interface CRMEvent {
  event_type: string;
  idempotency_key: string;
  timestamp?: number;
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

// Session 2.5: org_access.updated interfaces
interface OrgAccessGrant {
  crm_organization_id: string;
  role_in_org: 'sales_owner' | 'sales_manager' | 'pricing' | 'accounting' | 'admin';
  is_active?: boolean;
}

interface OrgAccessUpdatedPayload {
  user_id: string;
  org_access_seq: number;
  grants: OrgAccessGrant[];
  updated_at?: string;
  updated_by?: string | null;
}

// Verify HMAC signature from CRM (canonical: `${timestamp}.${payload}`)
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
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

// Compute SHA-256 hash of raw payload for drift detection
async function computePayloadHash(rawBody: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawBody);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseSourceSystemFromIdempotencyKey(idempotencyKey: string): string {
  const parts = idempotencyKey.split(':');
  return parts[0] || 'unknown';
}

async function checkIdempotency(
  supabase: ReturnType<typeof createClient>,
  idempotencyKey: string
): Promise<{
  exists: boolean;
  status?: string;
  attemptCount?: number;
  id?: string;
  payloadHash?: string;
  hmacVerified?: boolean;
}> {
  const { data } = await supabase
    .from('integration_inbox')
    .select('id, status, attempt_count, payload_hash, hmac_verified')
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (!data) return { exists: false };

  return {
    exists: true,
    status: data.status,
    attemptCount: data.attempt_count ?? 0,
    id: data.id,
    payloadHash: data.payload_hash ?? undefined,
    hmacVerified: data.hmac_verified ?? false,
  };
}

// Insert into integration_inbox with audit columns
async function insertInboxRow(
  supabase: ReturnType<typeof createClient>,
  event: CRMEvent,
  rawBody: string,
  hmacVerified: boolean,
  status: 'pending' | 'processed' | 'failed',
  receivedSignature: string | null,
  receivedTimestamp: number | null
): Promise<void> {
  const payloadHash = await computePayloadHash(rawBody);
  const sourceSystem = parseSourceSystemFromIdempotencyKey(event.idempotency_key);

  await supabase.from('integration_inbox').insert({
    idempotency_key: event.idempotency_key,
    event_type: event.event_type,
    source_system: sourceSystem,
    payload: event.payload,
    status,
    hmac_verified: hmacVerified,
    payload_hash: payloadHash,
    processed_at: status === 'processed' ? new Date().toISOString() : null,
    // Audit columns (Session 1.3)
    received_signature: receivedSignature ?? null,
    received_timestamp: Number.isFinite(receivedTimestamp as number) ? receivedTimestamp : null,
    schema_valid: true,
    validation_errors: null,
  });
}

// ---- Handlers (unchanged) ----

async function handleDealApproved(
  _supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  console.log('[wms-webhook-receiver] deal.approved received:', payload);
  return { success: true, message: 'deal.approved received and logged for future processing' };
}

async function handleDealAccepted(
  _supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  console.log('[wms-webhook-receiver] deal.accepted received:', payload);
  return { success: true, message: 'deal.accepted received and logged for future processing' };
}

async function handleDealWon(
  supabase: ReturnType<typeof createClient>,
  payload: DealWonPayload
): Promise<{ success: boolean; message: string; reservation_id?: string }> {
  console.log('[wms-webhook-receiver] deal.won received:', payload);

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
      // NOTE: If your reservations table requires created_by, this will fail.
      // For DevTools verification we will NOT use deal.won.
    })
    .select('id, reservation_number')
    .single();

  if (reservationError) {
    console.error('[wms-webhook-receiver] Failed to create reservation:', reservationError);
    return { success: false, message: `Failed to create reservation: ${reservationError.message}` };
  }

  const reservationLines = payload.lines.map((line) => ({
    reservation_id: reservation.id,
    quality: line.quality_code,
    color: line.color_code,
    reserved_meters: line.quantity_meters,
    scope: 'INVENTORY',
  }));

  const { error: linesError } = await supabase.from('reservation_lines').insert(reservationLines);

  if (linesError) {
    console.error('[wms-webhook-receiver] Failed to create reservation lines:', linesError);
    await supabase.from('reservations').delete().eq('id', reservation.id);
    return { success: false, message: `Failed to create reservation lines: ${linesError.message}` };
  }

  return {
    success: true,
    message: `Reservation created: ${reservation.reservation_number}`,
    reservation_id: reservation.id,
  };
}

async function handleDealCancelled(
  supabase: ReturnType<typeof createClient>,
  payload: DealCancelledPayload
): Promise<{ success: boolean; message: string }> {
  console.log('[wms-webhook-receiver] deal.cancelled received:', payload);

  const { data: reservation } = await supabase
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

  const { data: order } = await supabase
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
  if (reservation) results.push(`Reservation ${reservation.reservation_number} released`);
  if (order) results.push(`Order ${order.order_number} cancelled with action_required=true`);

  return { success: true, message: results.length ? results.join('; ') : 'No active reservations or orders found for this deal' };
}

async function handleDealLinesUpdated(
  supabase: ReturnType<typeof createClient>,
  payload: DealLinesUpdatedPayload
): Promise<{ success: boolean; message: string }> {
  console.log('[wms-webhook-receiver] deal.lines_updated received:', payload);

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, reservation_number')
    .eq('crm_deal_id', payload.crm_deal_id)
    .eq('status', 'active')
    .single();

  if (!reservation) return { success: false, message: 'No active reservation found for this deal' };

  const updates: string[] = [];

  for (const change of payload.changes) {
    if (change.action === 'line_removed') {
      const { error } = await supabase
        .from('reservation_lines')
        .delete()
        .eq('reservation_id', reservation.id)
        .eq('quality', change.quality_code)
        .eq('color', change.color_code);

      if (!error) updates.push(`Removed line: ${change.quality_code}/${change.color_code}`);
    } else {
      const { error } = await supabase
        .from('reservation_lines')
        .update({ reserved_meters: change.new_quantity })
        .eq('reservation_id', reservation.id)
        .eq('quality', change.quality_code)
        .eq('color', change.color_code);

      if (!error) updates.push(`Updated ${change.quality_code}/${change.color_code}: ${change.old_quantity} → ${change.new_quantity}`);
    }
  }

  return { success: true, message: `Reservation ${reservation.reservation_number} updated: ${updates.join('; ')}` };
}

// Session 2.5: org_access.updated handler
async function handleOrgAccessUpdated(
  supabase: ReturnType<typeof createClient>,
  payload: OrgAccessUpdatedPayload
): Promise<{ success: boolean; message: string }> {
  const { user_id, org_access_seq, grants } = payload;

  // Validate required fields
  if (!user_id || typeof org_access_seq !== 'number') {
    return { 
      success: false, 
      message: 'Missing required fields: user_id or org_access_seq' 
    };
  }

  // ========================================
  // SEQUENCE GUARD: Read from sync_state table (survives empty snapshots)
  // ========================================
  const { data: syncState, error: syncError } = await supabase
    .from('user_org_grants_sync_state')
    .select('last_org_access_seq')
    .eq('user_id', user_id)
    .maybeSingle();  // Use maybeSingle() to handle first-event case

  if (syncError) {
    console.error('[org_access.updated] Sync state lookup failed:', syncError);
    return { success: false, message: `Sync state lookup failed: ${syncError.message}` };
  }

  const currentSeq = syncState?.last_org_access_seq ?? 0;

  if (currentSeq >= org_access_seq) {
    // Log as contract violation (sequence out of order)
    await supabase.from('integration_contract_violations').insert({
      event_type: 'org_access.updated',
      idempotency_key: `crm:org_access:${user_id}-${org_access_seq}:updated:v1`,
      source_system: 'crm',
      violation_type: 'sequence_out_of_order',
      violation_message: `Received seq ${org_access_seq} but current is ${currentSeq}`,
      field_name: 'org_access_seq',
      field_value: String(org_access_seq),
      expected_value: `> ${currentSeq}`,
    });

    console.warn(
      `[org_access.updated] Ignoring out-of-order event: ` +
      `received seq ${org_access_seq}, current ${currentSeq}`
    );

    return {
      success: true,
      message: `Ignored: sequence ${org_access_seq} <= current ${currentSeq}`,
    };
  }

  // ========================================
  // VALIDATE + FILTER GRANTS
  // ========================================
  const rawGrants = grants || [];
  
  // Filter out grants with missing/invalid crm_organization_id
  const malformedGrants = rawGrants.filter(
    g => typeof g.crm_organization_id !== 'string' || g.crm_organization_id.length === 0
  );
  
  if (malformedGrants.length > 0) {
    await supabase.from('integration_contract_violations').insert({
      event_type: 'org_access.updated',
      idempotency_key: `crm:org_access:${user_id}-${org_access_seq}:updated:v1`,
      source_system: 'crm',
      violation_type: 'schema_violation',
      violation_message: `Received ${malformedGrants.length} grants with missing/invalid crm_organization_id`,
      field_name: 'grants[].crm_organization_id',
      field_value: 'undefined or empty',
      expected_value: 'valid UUID string',
    });

    console.warn(
      `[org_access.updated] Schema violation: ${malformedGrants.length} malformed grants filtered out`
    );
  }

  // Filter out inactive grants (contract requires active-only snapshot)
  const inactiveGrants = rawGrants.filter(g => g.is_active === false);
  
  if (inactiveGrants.length > 0) {
    await supabase.from('integration_contract_violations').insert({
      event_type: 'org_access.updated',
      idempotency_key: `crm:org_access:${user_id}-${org_access_seq}:updated:v1`,
      source_system: 'crm',
      violation_type: 'schema_violation',
      violation_message: `Received ${inactiveGrants.length} inactive grants in snapshot (contract requires active-only)`,
      field_name: 'grants[].is_active',
      field_value: 'false',
      expected_value: 'true or omitted',
    });

    console.warn(
      `[org_access.updated] Schema violation: ${inactiveGrants.length} inactive grants filtered out`
    );
  }

  // Apply both filters: valid org_id AND active
  const validGrants = rawGrants.filter(
    g => typeof g.crm_organization_id === 'string' && 
         g.crm_organization_id.length > 0 &&
         g.is_active !== false
  );

  // Deduplicate by crm_organization_id (last wins)
  const deduplicatedGrants = new Map<string, OrgAccessGrant>();
  for (const grant of validGrants) {
    deduplicatedGrants.set(grant.crm_organization_id, grant);
  }

  const grantArray = Array.from(deduplicatedGrants.values()).map(g => ({
    crm_organization_id: g.crm_organization_id,
    role_in_org: g.role_in_org,
    is_active: true,  // Always true after filtering
  }));

  // ========================================
  // ATOMIC SNAPSHOT REPLACEMENT via RPC
  // ========================================
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'replace_user_org_grants_snapshot',
    {
      p_user_id: user_id,
      p_org_access_seq: org_access_seq,
      p_grants: grantArray,
    }
  );

  if (rpcError) {
    console.error('[org_access.updated] RPC failed:', rpcError);
    return { success: false, message: `Snapshot replacement failed: ${rpcError.message}` };
  }

  const insertedCount = (rpcResult as { inserted_count?: number })?.inserted_count ?? grantArray.length;

  console.log(
    `[org_access.updated] User ${user_id}: replaced grants with ${insertedCount} orgs (seq ${org_access_seq})`
  );

  return {
    success: true,
    message: insertedCount > 0
      ? `Synced ${insertedCount} grants for user (seq ${org_access_seq})`
      : `Removed all grants for user (seq ${org_access_seq})`,
  };
}

// ---- HTTP handler ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const hmacSecret = Deno.env.get('WMS_CRM_HMAC_SECRET') || Deno.env.get('CRM_WEBHOOK_SECRET');

    // Recommended: fail hard if secret missing (prevents silently accepting unsigned events)
    if (!hmacSecret || hmacSecret.length < 16) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: WMS_CRM_HMAC_SECRET missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();

    // Parse JSON
    let event: CRMEvent;
    try {
      event = JSON.parse(rawBody) as CRMEvent;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!event?.event_type || !event?.idempotency_key || !event?.payload) {
      return new Response(JSON.stringify({ error: 'Missing required fields: event_type, idempotency_key, payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify HMAC
    let hmacVerified = false;

    const signature =
      req.headers.get('X-WMS-Signature') ||
      req.headers.get('x-wms-signature') ||
      req.headers.get('x-crm-signature');

    const timestamp =
      req.headers.get('X-WMS-Timestamp') ||
      req.headers.get('x-wms-timestamp') ||
      req.headers.get('x-crm-timestamp');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing X-WMS-Signature header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!timestamp) {
      return new Response(JSON.stringify({ error: 'Missing X-WMS-Timestamp header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timestampSec = parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(timestampSec) || Math.abs(nowSec - timestampSec) > 5 * 60) {
      return new Response(JSON.stringify({ error: 'Timestamp expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifySignature(rawBody, signature, timestamp, hmacSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    hmacVerified = true;

    // Idempotency
    const existing = await checkIdempotency(supabase, event.idempotency_key);

    if (existing.exists) {
      if (['processed', 'processing', 'pending'].includes(existing.status || '')) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Event already processed (idempotent)',
            idempotency_key: event.idempotency_key,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existing.status === 'failed' && existing.id) {
        // DRIFT DETECTION: Compare payload hashes before allowing retry
        const newHash = await computePayloadHash(rawBody);

        if (existing.payloadHash && existing.payloadHash !== newHash) {
          const driftAttempt = (existing.attemptCount ?? 0) + 1;

          // Log drift violation to integration_contract_violations
          await supabase.from('integration_contract_violations').insert({
            event_type: event.event_type,
            idempotency_key: event.idempotency_key,
            source_system: parseSourceSystemFromIdempotencyKey(event.idempotency_key),
            violation_type: 'payload_hash_drift',
            violation_message: 'Payload changed on retry - same idempotency_key but different content',
            field_name: 'payload_hash',
            field_value: newHash,
            expected_value: existing.payloadHash,
            inbox_id: existing.id,
          });

          // Also update inbox row with error marker + increment attempt_count + set hmac_verified=true
          await supabase
            .from('integration_inbox')
            .update({
              error_message: 'Payload drift detected on retry',
              last_attempt_at: new Date().toISOString(),
              attempt_count: driftAttempt,
              hmac_verified: true,
            })
            .eq('id', existing.id);

          // Reject with 409 Conflict (do NOT flip to pending)
          return new Response(
            JSON.stringify({
              error: 'Payload drift detected',
              message: 'Same idempotency_key but different payload content',
              idempotency_key: event.idempotency_key,
              attempt: driftAttempt, // tiny extra for consistency
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hashes match - proceed with retry
        await supabase
          .from('integration_inbox')
          .update({
            status: 'pending',
            attempt_count: (existing.attemptCount ?? 0) + 1,
            hmac_verified: true,
            last_attempt_at: new Date().toISOString(),
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

    // Route to handler
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
      case 'org_access.updated':
        result = await handleOrgAccessUpdated(
          supabase, 
          event.payload as unknown as OrgAccessUpdatedPayload
        );
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown event type: ${event.event_type}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Write inbox row with audit columns (Session 1.3)
    const parsedTimestamp = parseInt(timestamp, 10);
    await insertInboxRow(
      supabase,
      event,
      rawBody,
      hmacVerified,
      result.success ? 'processed' : 'failed',
      signature,
      Number.isFinite(parsedTimestamp) ? parsedTimestamp : null
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[wms-webhook-receiver] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
