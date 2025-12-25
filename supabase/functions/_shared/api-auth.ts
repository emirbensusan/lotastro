// Shared API authentication helper for integration endpoints
// Used by: api-get-inventory, api-get-catalog, api-create-order, webhook-dispatcher

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
  apiKey: string | null
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
    if (keyData.rate_limit_per_minute) {
      const isRateLimited = await checkRateLimit(supabase, keyData.id, keyData.rate_limit_per_minute);
      if (isRateLimited) {
        console.log('[api-auth] Rate limit exceeded for:', keyData.name);
        return { valid: false, error: 'Rate limit exceeded. Try again later.' };
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
      permissions: keyData.permissions 
    };
  } catch (err) {
    console.error('[api-auth] Error validating API key:', err);
    return { valid: false, error: 'Internal error validating API key' };
  }
}

/**
 * Check if the API key has exceeded its rate limit
 * Uses a simple sliding window approach
 */
async function checkRateLimit(
  supabase: any, 
  keyId: string, 
  limitPerMinute: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
  
  // Count recent requests (would need api_request_log table for full implementation)
  // For now, we'll use a simpler approach without a separate log table
  // In production, you'd want a Redis-based rate limiter or a dedicated log table
  
  // Placeholder: always allow (implement with Redis or dedicated table)
  return false;
}

/**
 * Log an API request for audit purposes
 */
export async function logApiRequest(
  supabase: any,
  keyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number
): Promise<void> {
  try {
    // Log to console for now (could be extended to a dedicated table)
    console.log(`[api-request] key=${keyId} endpoint=${endpoint} method=${method} status=${statusCode} time=${responseTimeMs}ms`);
  } catch (err) {
    console.error('[api-auth] Error logging request:', err);
  }
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
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: any, 
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...apiCorsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string, 
  status: number = 400
): Response {
  return jsonResponse({ error: message }, status);
}
