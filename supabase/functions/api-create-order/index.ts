// API endpoint: Create order from external source
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

interface OrderLineInput {
  quality: string;
  color: string;
  meters: number;
  notes?: string;
}

interface CreateOrderInput {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  external_reference?: string;
  delivery_date?: string;
  notes?: string;
  lines: OrderLineInput[];
}

Deno.serve(async (req) => {
  const startTime = Date.now();

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

    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const validation = await validateApiKey(supabase, apiKey);

    if (!validation.valid) {
      return errorResponse(validation.error || 'Unauthorized', 401);
    }

    // Check permission
    if (!hasPermission(validation.permissions, 'create_order')) {
      return errorResponse('Permission denied: create_order required', 403);
    }

    // Parse and validate request body
    let body: CreateOrderInput;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    // Validate required fields
    if (!body.customer_name || typeof body.customer_name !== 'string') {
      return errorResponse('customer_name is required', 400);
    }

    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      return errorResponse('lines array is required and must not be empty', 400);
    }

    // Validate each line
    for (let i = 0; i < body.lines.length; i++) {
      const line = body.lines[i];
      if (!line.quality || typeof line.quality !== 'string') {
        return errorResponse(`lines[${i}].quality is required`, 400);
      }
      if (!line.color || typeof line.color !== 'string') {
        return errorResponse(`lines[${i}].color is required`, 400);
      }
      if (typeof line.meters !== 'number' || line.meters <= 0) {
        return errorResponse(`lines[${i}].meters must be a positive number`, 400);
      }
    }

    console.log(`[api-create-order] Request from ${validation.service}: customer=${body.customer_name}, lines=${body.lines.length}`);

    // Generate order number
    const { data: orderNumber } = await supabase.rpc('generate_order_number');

    if (!orderNumber) {
      throw new Error('Failed to generate order number');
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: body.customer_name.trim(),
        customer_email: body.customer_email?.trim() || null,
        customer_phone: body.customer_phone?.trim() || null,
        external_reference: body.external_reference?.trim() || null,
        delivery_date: body.delivery_date || null,
        notes: body.notes?.trim() || null,
        source: `api:${validation.service}`,
        created_by: null, // API orders don't have a user
      })
      .select()
      .single();

    if (orderError) {
      console.error('[api-create-order] Error creating order:', orderError);
      throw orderError;
    }

    // Create order lines
    const orderLines = body.lines.map((line, index) => ({
      order_id: order.id,
      line_number: index + 1,
      quality: line.quality.trim().toUpperCase(),
      color: line.color.trim().toUpperCase(),
      meters: line.meters,
      notes: line.notes?.trim() || null,
    }));

    const { error: linesError } = await supabase
      .from('order_lines')
      .insert(orderLines);

    if (linesError) {
      console.error('[api-create-order] Error creating order lines:', linesError);
      // Rollback: delete the order
      await supabase.from('orders').delete().eq('id', order.id);
      throw linesError;
    }

    // Calculate total meters
    const totalMeters = body.lines.reduce((sum, line) => sum + line.meters, 0);

    // Format response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        order_number: orderNumber,
        customer_name: body.customer_name,
        external_reference: body.external_reference || null,
        total_lines: body.lines.length,
        total_meters: totalMeters,
        status: 'pending',
        created_at: order.created_at,
      },
      message: `Order ${orderNumber} created successfully with ${body.lines.length} line(s)`,
    };

    // Log the request
    await logApiRequest(
      supabase,
      validation.keyData!.id,
      '/api-create-order',
      'POST',
      201,
      Date.now() - startTime
    );

    console.log(`[api-create-order] Created order ${orderNumber} with ${body.lines.length} lines in ${Date.now() - startTime}ms`);

    return jsonResponse(response, 201);

  } catch (error: any) {
    console.error('[api-create-order] Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
