// Shared API authentication helper for integration endpoints
// Used by: api-get-inventory, api-get-catalog, api-create-order, webhook-dispatcher

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ApiKeyData {
  id: string;
  name: string;
  service: string;
  permissions: Record<string, boolean> | null;
  rate_limit_per_minute: number | null;
  expires_at: string | null;
}

export interface ApiKeyValidation {
  valid: boolean;
  error?: string;
  keyData?: ApiKeyData;
  service?: string;
  permissions?: Record<string, boolean> | null;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

/**
 * Hash an API key using SHA-256
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new API key with prefix
 */
export function generateApiKey(service: string): { key: string; prefix: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const prefix = `la_${service.toLowerCase().slice(0, 4)}_`;
  return { key: prefix + key, prefix };
}

/**
 * Validate an API key against the database
 */
export async function validateApiKey(
  supabase: any,
  apiKey: string | null,
  req?: Request
): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false, error: 'Missing x-api-key header' };
  }

  try {
    // Hash the provided key
    const keyHash = await hashApiKey(apiKey);
    
    // Look up the key in the database
    const { data: keyData, error } = await supabase
      .from('api_keys')
      .select('id, name, service, permissions, rate_limit_per_minute, expires_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !keyData) {
      console.log('[api-auth] Invalid API key or key not found');
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      console.log('[api-auth] API key expired:', keyData.name);
      return { valid: false, error: 'API key expired' };
    }

    // Check rate limit if configured
    let rateLimitInfo: { limit: number; remaining: number; reset: number } | undefined;
    if (keyData.rate_limit_per_minute) {
      const rateCheck = await checkRateLimit(supabase, keyData.id, keyData.rate_limit_per_minute);
      rateLimitInfo = rateCheck.info;
      
      if (rateCheck.exceeded) {
        console.log('[api-auth] Rate limit exceeded for:', keyData.name);
        return { 
          valid: false, 
          error: 'Rate limit exceeded. Try again later.',
          rateLimitInfo 
        };
      }
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    console.log('[api-auth] API key validated:', keyData.name, 'service:', keyData.service);

    return { 
      valid: true, 
      keyData,
      service: keyData.service,
      permissions: keyData.permissions,
      rateLimitInfo
    };
  } catch (err) {
    console.error('[api-auth] Error validating API key:', err);
    return { valid: false, error: 'Internal error validating API key' };
  }
}

/**
 * Check if the API key has exceeded its rate limit
 * Uses a sliding window approach with the api_request_logs table
 */
async function checkRateLimit(
  supabase: any, 
  keyId: string, 
  limitPerMinute: number
): Promise<{ exceeded: boolean; info: { limit: number; remaining: number; reset: number } }> {
  const now = Date.now();
  const windowStart = new Date(now - 60000).toISOString(); // 1 minute ago
  const resetTime = Math.floor((now + 60000) / 1000); // Reset timestamp (Unix seconds)
  
  try {
    // Count recent requests for this API key
    const { count, error } = await supabase
      .from('api_request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', keyId)
      .gte('created_at', windowStart);

    if (error) {
      console.error('[api-auth] Error checking rate limit:', error);
      // On error, allow the request but log it
      return { 
        exceeded: false, 
        info: { limit: limitPerMinute, remaining: limitPerMinute, reset: resetTime } 
      };
    }

    const requestCount = count || 0;
    const remaining = Math.max(0, limitPerMinute - requestCount);
    const exceeded = requestCount >= limitPerMinute;

    return { 
      exceeded, 
      info: { limit: limitPerMinute, remaining, reset: resetTime } 
    };
  } catch (err) {
    console.error('[api-auth] Rate limit check error:', err);
    return { 
      exceeded: false, 
      info: { limit: limitPerMinute, remaining: limitPerMinute, reset: resetTime } 
    };
  }
}

/**
 * Log an API request for audit and rate limiting purposes
 */
export async function logApiRequest(
  supabase: any,
  keyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress?: string,
  requestBodySize?: number,
  responseBodySize?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_request_logs')
      .insert({
        api_key_id: keyId,
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        ip_address: ipAddress || null,
        request_body_size: requestBodySize || null,
        response_body_size: responseBodySize || null,
        error_message: errorMessage || null
      });

    if (error) {
      console.error('[api-auth] Error logging request:', error);
    }
  } catch (err) {
    console.error('[api-auth] Error logging request:', err);
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(req: Request): string | undefined {
  // Check various headers for the client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return undefined;
}

/**
 * Check if the API key has a specific permission
 */
export function hasPermission(
  permissions: Record<string, boolean> | null,
  permission: string
): boolean {
  if (!permissions) return true; // No permissions = all allowed
  return permissions[permission] === true;
}

/**
 * Standard CORS headers for API endpoints
 */
export const apiCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Create a JSON response with CORS headers and rate limit headers
 */
export function jsonResponse(
  data: any, 
  status: number = 200,
  rateLimitInfo?: { limit: number; remaining: number; reset: number }
): Response {
  const headers: Record<string, string> = { 
    ...apiCorsHeaders, 
    'Content-Type': 'application/json' 
  };
  
  // Add rate limit headers if available
  if (rateLimitInfo) {
    headers['X-RateLimit-Limit'] = String(rateLimitInfo.limit);
    headers['X-RateLimit-Remaining'] = String(rateLimitInfo.remaining);
    headers['X-RateLimit-Reset'] = String(rateLimitInfo.reset);
  }
  
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string, 
  status: number = 400,
  rateLimitInfo?: { limit: number; remaining: number; reset: number }
): Response {
  return jsonResponse({ error: message }, status, rateLimitInfo);
}

/**
 * Wrapper for API handlers that handles auth, rate limiting, and logging
 */
export async function withApiAuth(
  req: Request,
  supabase: any,
  handler: (keyData: ApiKeyData) => Promise<{ data: any; status: number }>
): Promise<Response> {
  const startTime = Date.now();
  const apiKey = req.headers.get('x-api-key');
  const clientIP = getClientIP(req);
  const endpoint = new URL(req.url).pathname;
  const method = req.method;
  
  // Validate API key
  const validation = await validateApiKey(supabase, apiKey, req);
  
  if (!validation.valid || !validation.keyData) {
    // Log failed auth attempt
    if (apiKey) {
      // We can't log without a valid key ID, but we log to console
      console.warn(`[api-auth] Failed auth attempt from ${clientIP} for ${endpoint}`);
    }
    return errorResponse(validation.error || 'Unauthorized', 401, validation.rateLimitInfo);
  }
  
  try {
    // Execute the handler
    const result = await handler(validation.keyData);
    
    // Log successful request
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      supabase,
      validation.keyData.id,
      endpoint,
      method,
      result.status,
      responseTime,
      clientIP,
      undefined,
      JSON.stringify(result.data).length
    );
    
    return jsonResponse(result.data, result.status, validation.rateLimitInfo);
  } catch (err: any) {
    // Log error request
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      supabase,
      validation.keyData.id,
      endpoint,
      method,
      500,
      responseTime,
      clientIP,
      undefined,
      undefined,
      err.message
    );
    
    console.error('[api-auth] Handler error:', err);
    return errorResponse(err.message || 'Internal server error', 500, validation.rateLimitInfo);
  }
}
