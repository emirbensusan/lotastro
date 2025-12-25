// API endpoint: Get product catalog
// Consumer: Portal, CRM
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
    if (!hasPermission(validation.permissions, 'read_catalog')) {
      return errorResponse('Permission denied: read_catalog required', 403);
    }

    // Parse query parameters
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // lining, main_fabric, etc.
    const code = url.searchParams.get('code');
    const activeOnly = url.searchParams.get('active_only') !== 'false'; // default true
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log(`[api-get-catalog] Request from ${validation.service}: type=${type}, code=${code}, activeOnly=${activeOnly}`);

    // Build query
    let query = supabase
      .from('catalog_items')
      .select(`
        id,
        lastro_sku_code,
        code,
        color_name,
        type,
        fabric_type,
        weight_g_m2,
        composition,
        weaving_knitted,
        eu_origin,
        description,
        care_instructions,
        status,
        is_active,
        photo_of_design_url,
        created_at,
        updated_at
      `, { count: 'exact' });

    // Apply filters
    if (activeOnly) {
      query = query.eq('is_active', true).eq('status', 'active');
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (code) {
      query = query.ilike('code', `%${code}%`);
    }

    // Apply pagination
    query = query
      .order('code', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: catalogData, error: catalogError, count } = await query;

    if (catalogError) {
      console.error('[api-get-catalog] Error fetching catalog:', catalogError);
      throw catalogError;
    }

    // Format response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (offset + limit) < (count || 0),
      },
      filters: {
        type: type || null,
        code: code || null,
        active_only: activeOnly,
      },
      data: (catalogData || []).map((item: any) => ({
        sku: item.lastro_sku_code,
        code: item.code,
        color_name: item.color_name,
        type: item.type,
        fabric_type: item.fabric_type,
        weight_gsm: item.weight_g_m2,
        composition: item.composition,
        weaving_knitted: item.weaving_knitted,
        eu_origin: item.eu_origin,
        description: item.description,
        care_instructions: item.care_instructions,
        image_url: item.photo_of_design_url,
        status: item.status,
        updated_at: item.updated_at,
      })),
    };

    // Log the request
    await logApiRequest(
      supabase,
      validation.keyData!.id,
      '/api-get-catalog',
      'GET',
      200,
      Date.now() - startTime
    );

    console.log(`[api-get-catalog] Returning ${response.data.length} items (total: ${count}) in ${Date.now() - startTime}ms`);

    return jsonResponse(response);

  } catch (error: any) {
    console.error('[api-get-catalog] Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
