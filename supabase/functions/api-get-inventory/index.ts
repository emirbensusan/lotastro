// API endpoint: Get inventory summary
// Consumer: CRM, Portal, Ops Console
// Auth: API key via x-api-key header

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  validateApiKey, 
  hasPermission, 
  logApiRequest,
  apiCorsHeaders, 
  jsonResponse, 
  errorResponse 
} from '../_shared/api-auth.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: apiCorsHeaders });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const validation = await validateApiKey(supabase, apiKey);

    if (!validation.valid) {
      return errorResponse(validation.error || 'Unauthorized', 401);
    }

    // Check permission
    if (!hasPermission(validation.permissions, 'read_inventory')) {
      return errorResponse('Permission denied: read_inventory required', 403);
    }

    // Parse query parameters
    const url = new URL(req.url);
    const quality = url.searchParams.get('quality');
    const color = url.searchParams.get('color');
    const includeIncoming = url.searchParams.get('include_incoming') === 'true';

    console.log(`[api-get-inventory] Request from ${validation.service}: quality=${quality}, color=${color}, includeIncoming=${includeIncoming}`);

    // Get inventory pivot summary
    const { data: inventoryData, error: inventoryError } = await supabase
      .rpc('get_inventory_pivot_summary');

    if (inventoryError) {
      console.error('[api-get-inventory] Error fetching inventory:', inventoryError);
      throw inventoryError;
    }

    // Filter if quality or color specified
    let filteredData = inventoryData || [];
    
    if (quality) {
      filteredData = filteredData.filter((item: any) => 
        item.quality?.toLowerCase().includes(quality.toLowerCase()) ||
        item.normalized_quality?.toLowerCase().includes(quality.toLowerCase())
      );
    }
    
    if (color) {
      filteredData = filteredData.filter((item: any) => 
        item.color?.toLowerCase().includes(color.toLowerCase())
      );
    }

    // Format response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      count: filteredData.length,
      filters: {
        quality: quality || null,
        color: color || null,
        include_incoming: includeIncoming,
      },
      data: filteredData.map((item: any) => ({
        quality: item.quality,
        normalized_quality: item.normalized_quality,
        color: item.color,
        in_stock_meters: item.total_meters || 0,
        in_stock_rolls: item.total_rolls || 0,
        lot_count: item.lot_count || 0,
        incoming_meters: includeIncoming ? (item.incoming_meters || 0) : undefined,
        reserved_meters: item.total_reserved_meters || 0,
        available_meters: item.available_meters || 0,
      })),
    };

    // Log the request
    await logApiRequest(
      supabase,
      validation.keyData!.id,
      '/api-get-inventory',
      'GET',
      200,
      Date.now() - startTime
    );

    console.log(`[api-get-inventory] Returning ${response.count} items in ${Date.now() - startTime}ms`);

    return jsonResponse(response);

  } catch (error: any) {
    console.error('[api-get-inventory] Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
