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
    if (!hasPermission(validation.permissions, 'read_inventory') && !hasPermission(validation.permissions, 'inventory.read')) {
      return errorResponse('Permission denied: inventory.read required', 403);
    }

    // Parse query parameters
    const url = new URL(req.url);
    const quality = url.searchParams.get('quality');
    const color = url.searchParams.get('color');
    const status = url.searchParams.get('status'); // in_stock, low_stock, out_of_stock
    const minMeters = url.searchParams.get('min_meters');
    const maxMeters = url.searchParams.get('max_meters');
    const includeIncoming = url.searchParams.get('include_incoming') === 'true';
    const includeReserved = url.searchParams.get('include_reserved') !== 'false'; // default true
    
    // Pagination
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(url.searchParams.get('page_size') || '100'), 500);
    const offset = (page - 1) * pageSize;

    console.log(`[api-get-inventory] Request from ${validation.service}: quality=${quality}, color=${color}, status=${status}, page=${page}`);

    // Get inventory pivot summary
    const { data: inventoryData, error: inventoryError } = await supabase
      .rpc('get_inventory_pivot_summary');

    if (inventoryError) {
      console.error('[api-get-inventory] Error fetching inventory:', inventoryError);
      throw inventoryError;
    }

    // Filter data
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

    // Status filter
    if (status === 'in_stock') {
      filteredData = filteredData.filter((item: any) => item.total_meters > 0);
    } else if (status === 'low_stock') {
      filteredData = filteredData.filter((item: any) => item.available_meters > 0 && item.available_meters < 100);
    } else if (status === 'out_of_stock') {
      filteredData = filteredData.filter((item: any) => item.available_meters <= 0);
    }

    // Meters range filter
    if (minMeters) {
      const min = parseFloat(minMeters);
      filteredData = filteredData.filter((item: any) => item.available_meters >= min);
    }
    if (maxMeters) {
      const max = parseFloat(maxMeters);
      filteredData = filteredData.filter((item: any) => item.available_meters <= max);
    }

    const totalCount = filteredData.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + pageSize);

    // Format response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      count: paginatedData.length,
      total_count: totalCount,
      pagination: {
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      filters: {
        quality: quality || null,
        color: color || null,
        status: status || null,
        min_meters: minMeters ? parseFloat(minMeters) : null,
        max_meters: maxMeters ? parseFloat(maxMeters) : null,
        include_incoming: includeIncoming,
        include_reserved: includeReserved,
      },
      data: paginatedData.map((item: any) => ({
        quality: item.quality,
        normalized_quality: item.normalized_quality,
        color: item.color,
        in_stock_meters: item.total_meters || 0,
        in_stock_rolls: item.total_rolls || 0,
        lot_count: item.lot_count || 0,
        incoming_meters: includeIncoming ? (item.incoming_meters || 0) : undefined,
        physical_reserved_meters: includeReserved ? (item.physical_reserved_meters || 0) : undefined,
        incoming_reserved_meters: includeReserved ? (item.incoming_reserved_meters || 0) : undefined,
        total_reserved_meters: includeReserved ? (item.total_reserved_meters || 0) : undefined,
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

    console.log(`[api-get-inventory] Returning ${response.count}/${totalCount} items (page ${page}/${totalPages}) in ${Date.now() - startTime}ms`);

    return jsonResponse(response);

  } catch (error: any) {
    console.error('[api-get-inventory] Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
