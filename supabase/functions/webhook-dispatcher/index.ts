// Webhook dispatcher: Send events to registered webhook endpoints
// Called internally when events occur (order created, inventory updated, etc.)
// Auth: Internal only (service role key) or API key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  validateApiKey, 
  hasPermission, 
  apiCorsHeaders, 
  jsonResponse, 
  errorResponse 
} from '../_shared/api-auth.ts';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

interface WebhookDeliveryResult {
  subscription_id: string;
  endpoint_url: string;
  success: boolean;
  status_code?: number;
  error?: string;
  duration_ms: number;
}

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
 * Deliver webhook to a single endpoint
 */
async function deliverWebhook(
  subscription: any,
  payload: WebhookPayload
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);
  
  try {
    // Sign the payload
    const signature = await signPayload(payloadString, subscription.secret || 'default-secret');
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Send the webhook
    const response = await fetch(subscription.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Event': payload.event,
        'X-Webhook-Id': subscription.id,
        'User-Agent': 'LotAstro-Webhook/1.0',
      },
      body: payloadString,
    });

    const durationMs = Date.now() - startTime;

    if (response.ok) {
      console.log(`[webhook-dispatcher] Delivered to ${subscription.endpoint_url}: ${response.status} in ${durationMs}ms`);
      return {
        subscription_id: subscription.id,
        endpoint_url: subscription.endpoint_url,
        success: true,
        status_code: response.status,
        duration_ms: durationMs,
      };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[webhook-dispatcher] Failed to deliver to ${subscription.endpoint_url}: ${response.status} - ${errorText}`);
      return {
        subscription_id: subscription.id,
        endpoint_url: subscription.endpoint_url,
        success: false,
        status_code: response.status,
        error: errorText.slice(0, 500),
        duration_ms: durationMs,
      };
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[webhook-dispatcher] Error delivering to ${subscription.endpoint_url}:`, error);
    return {
      subscription_id: subscription.id,
      endpoint_url: subscription.endpoint_url,
      success: false,
      error: error.message,
      duration_ms: durationMs,
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: apiCorsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for internal call (service role) or API key
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('x-api-key');
    
    let authorized = false;
    let callerService = 'internal';

    // Check service role auth (internal calls)
    if (authHeader?.includes(supabaseServiceKey)) {
      authorized = true;
      callerService = 'internal';
    }
    
    // Check API key auth (external calls)
    if (!authorized && apiKey) {
      const validation = await validateApiKey(supabase, apiKey);
      if (validation.valid && hasPermission(validation.permissions, 'dispatch_webhooks')) {
        authorized = true;
        callerService = validation.service || 'api';
      }
    }

    if (!authorized) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse request body
    let body: { event: string; data: any };
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    if (!body.event || typeof body.event !== 'string') {
      return errorResponse('event is required', 400);
    }

    if (!body.data) {
      return errorResponse('data is required', 400);
    }

    console.log(`[webhook-dispatcher] Dispatching event: ${body.event} from ${callerService}`);

    // Get active subscriptions for this event
    const { data: subscriptions, error: subError } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('is_active', true)
      .contains('events', [body.event]);

    if (subError) {
      console.error('[webhook-dispatcher] Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[webhook-dispatcher] No active subscriptions for event: ${body.event}`);
      return jsonResponse({
        success: true,
        event: body.event,
        subscriptions_found: 0,
        deliveries: [],
      });
    }

    console.log(`[webhook-dispatcher] Found ${subscriptions.length} subscription(s) for event: ${body.event}`);

    // Build webhook payload
    const payload: WebhookPayload = {
      event: body.event,
      timestamp: new Date().toISOString(),
      data: body.data,
    };

    // Deliver to all subscriptions in parallel
    const deliveryPromises = subscriptions.map(sub => deliverWebhook(sub, payload));
    const results = await Promise.all(deliveryPromises);

    // Log delivery results
    const deliveryLogs = results.map(result => ({
      subscription_id: result.subscription_id,
      event: body.event,
      payload: payload,
      status_code: result.status_code || null,
      success: result.success,
      error_message: result.error || null,
      delivered_at: result.success ? new Date().toISOString() : null,
      duration_ms: result.duration_ms,
    }));

    // Insert delivery logs
    const { error: logError } = await supabase
      .from('webhook_deliveries')
      .insert(deliveryLogs);

    if (logError) {
      console.error('[webhook-dispatcher] Error logging deliveries:', logError);
    }

    // Update subscription stats
    for (const result of results) {
      if (result.success) {
        await supabase
          .from('webhook_subscriptions')
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: 0,
          })
          .eq('id', result.subscription_id);
      } else {
        // Increment failure count
        await supabase.rpc('increment_webhook_failure', {
          p_subscription_id: result.subscription_id,
        }).catch(() => {
          // If RPC doesn't exist, just log
          console.log(`[webhook-dispatcher] Could not increment failure count for ${result.subscription_id}`);
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[webhook-dispatcher] Completed: ${successCount} success, ${failureCount} failed`);

    return jsonResponse({
      success: true,
      event: body.event,
      subscriptions_found: subscriptions.length,
      delivered: successCount,
      failed: failureCount,
      deliveries: results.map(r => ({
        subscription_id: r.subscription_id,
        success: r.success,
        status_code: r.status_code,
        error: r.error,
        duration_ms: r.duration_ms,
      })),
    });

  } catch (error: any) {
    console.error('[webhook-dispatcher] Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
