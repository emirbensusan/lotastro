// Webhook Retry Processor
// CRON job that retries failed webhook deliveries with exponential backoff
// Schedule: Every 5 minutes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Exponential backoff schedule: 1min, 5min, 30min, 2hr, 24hr
const RETRY_DELAYS_MS = [
  1 * 60 * 1000,       // 1 minute
  5 * 60 * 1000,       // 5 minutes
  30 * 60 * 1000,      // 30 minutes
  2 * 60 * 60 * 1000,  // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
];

/**
 * Sign a webhook payload using HMAC-SHA256
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Attempt to deliver a webhook
 */
async function deliverWebhook(
  endpointUrl: string,
  payload: Record<string, unknown>,
  secret: string,
  subscriptionId: string
): Promise<{ success: boolean; statusCode?: number; error?: string; durationMs: number }> {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);
  
  try {
    const signature = await signPayload(payloadString, secret || 'default-secret');
    const timestamp = Math.floor(Date.now() / 1000);
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Event': payload.event as string,
        'X-Webhook-Id': subscriptionId,
        'X-Webhook-Retry': 'true',
        'User-Agent': 'LotAstro-Webhook/1.0',
      },
      body: payloadString,
    });

    const durationMs = Date.now() - startTime;

    if (response.ok) {
      return { success: true, statusCode: response.status, durationMs };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { 
        success: false, 
        statusCode: response.status, 
        error: errorText.slice(0, 500), 
        durationMs 
      };
    }
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage, durationMs };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[process-webhook-retries] Starting retry processor');

  // Validate CRON secret if present
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error('[process-webhook-retries] Invalid CRON secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find deliveries ready for retry
    const { data: pendingRetries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(`
        id,
        subscription_id,
        event,
        event_type,
        payload,
        retry_count,
        subscription:webhook_subscriptions (
          id,
          endpoint_url,
          secret,
          max_retries,
          is_active
        )
      `)
      .eq('success', false)
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[process-webhook-retries] Error fetching retries:', fetchError);
      throw fetchError;
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      console.log('[process-webhook-retries] No pending retries found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending retries',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-webhook-retries] Processing ${pendingRetries.length} retries`);

    let successCount = 0;
    let failedCount = 0;
    let deadLetterCount = 0;

    for (const delivery of pendingRetries) {
      const subscription = (delivery.subscription as unknown as {
        id: string;
        endpoint_url: string;
        secret: string;
        max_retries: number;
        is_active: boolean;
      });

      // Skip if subscription is inactive or missing
      if (!subscription || !subscription.is_active) {
        console.log(`[process-webhook-retries] Skipping delivery ${delivery.id} - subscription inactive`);
        continue;
      }

      const maxRetries = subscription.max_retries || 5;
      const currentRetry = (delivery.retry_count || 0) + 1;
      const eventName = delivery.event || delivery.event_type || 'unknown';

      console.log(`[process-webhook-retries] Retrying delivery ${delivery.id} (attempt ${currentRetry}/${maxRetries})`);

      // Attempt delivery
      const result = await deliverWebhook(
        subscription.endpoint_url,
        delivery.payload as Record<string, unknown>,
        subscription.secret,
        subscription.id
      );

      if (result.success) {
        // Success - update delivery record
        await supabase
          .from('webhook_deliveries')
          .update({
            success: true,
            status_code: result.statusCode,
            response_status: result.statusCode,
            duration_ms: result.durationMs,
            delivered_at: new Date().toISOString(),
            error_message: null,
            next_retry_at: null,
          })
          .eq('id', delivery.id);

        // Reset subscription failure count
        await supabase
          .from('webhook_subscriptions')
          .update({
            failure_count: 0,
            last_triggered_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        successCount++;
        console.log(`[process-webhook-retries] Delivery ${delivery.id} succeeded on retry`);
      } else if (currentRetry >= maxRetries) {
        // Max retries reached - mark as dead letter
        await supabase
          .from('webhook_deliveries')
          .update({
            retry_count: currentRetry,
            status_code: result.statusCode,
            response_status: result.statusCode,
            duration_ms: result.durationMs,
            error_message: `Dead letter: ${result.error}`,
            next_retry_at: null, // No more retries
          })
          .eq('id', delivery.id);

        deadLetterCount++;
        console.log(`[process-webhook-retries] Delivery ${delivery.id} moved to dead letter`);
      } else {
        // Schedule next retry with exponential backoff
        const delayMs = RETRY_DELAYS_MS[Math.min(currentRetry, RETRY_DELAYS_MS.length - 1)];
        const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

        await supabase
          .from('webhook_deliveries')
          .update({
            retry_count: currentRetry,
            status_code: result.statusCode,
            response_status: result.statusCode,
            duration_ms: result.durationMs,
            error_message: result.error,
            next_retry_at: nextRetryAt,
          })
          .eq('id', delivery.id);

        failedCount++;
        console.log(`[process-webhook-retries] Delivery ${delivery.id} failed, next retry at ${nextRetryAt}`);
      }
    }

    console.log(`[process-webhook-retries] Completed: ${successCount} success, ${failedCount} failed, ${deadLetterCount} dead letter`);

    return new Response(JSON.stringify({
      success: true,
      processed: pendingRetries.length,
      succeeded: successCount,
      failed: failedCount,
      dead_letter: deadLetterCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[process-webhook-retries] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
