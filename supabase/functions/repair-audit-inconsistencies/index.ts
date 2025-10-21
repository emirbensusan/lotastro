import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RepairRequest {
  audit_id?: string;
  lot_id?: string;
  action: 'reset_reversed_flag' | 'direct_reversal';
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check admin permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: RepairRequest = await req.json();
    console.log(`[${correlationId}] Repair request:`, body);

    if (body.action === 'reset_reversed_flag' && body.audit_id) {
      // Reset is_reversed flag for inconsistent audit
      const { data: audit } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', body.audit_id)
        .single();

      if (!audit) {
        return new Response(JSON.stringify({ error: 'Audit log not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if entity still exists
      const tableName = audit.entity_type === 'lot' ? 'lots' : audit.entity_type;
      const { data: entity } = await supabase
        .from(tableName)
        .select('id')
        .eq('id', audit.entity_id)
        .single();

      if (!entity) {
        return new Response(JSON.stringify({ 
          error: 'Entity does not exist, cannot reset flag',
          audit_id: body.audit_id 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Reset the flag
      await supabase
        .from('audit_logs')
        .update({
          is_reversed: false,
          reversed_at: null,
          reversed_by: null,
          reversal_audit_id: null
        })
        .eq('id', body.audit_id);

      // Log the repair action
      await supabase.from('audit_logs').insert({
        action: 'UPDATE',
        entity_type: 'audit_logs',
        entity_id: body.audit_id,
        entity_identifier: `Audit repair for ${audit.entity_identifier}`,
        user_id: user.id,
        user_email: user.email!,
        user_role: 'admin',
        old_data: { is_reversed: true },
        new_data: { is_reversed: false },
        notes: `Admin repair: Reset is_reversed flag. Reason: ${body.reason || 'Inconsistent state - entity still exists'}`
      });

      console.log(`[${correlationId}] Reset is_reversed flag for audit ${body.audit_id}`);

      return new Response(JSON.stringify({
        success: true,
        action: 'reset_reversed_flag',
        audit_id: body.audit_id,
        correlation_id: correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (body.action === 'direct_reversal' && body.lot_id) {
      // Perform direct reversal of a lot without a CREATE audit
      const { data: lot, error: lotError } = await supabase
        .from('lots')
        .select('*')
        .eq('id', body.lot_id)
        .single();

      if (lotError || !lot) {
        console.error(`[${correlationId}] Lot query failed:`, lotError);
        return new Response(JSON.stringify({ 
          error: 'Lot not found',
          details: lotError?.message,
          lot_id: body.lot_id 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get goods_in_rows and incoming_stock_id by joining through goods_in_receipts
      const { data: rows, error: rowsError } = await supabase
        .from('goods_in_rows')
        .select('*, goods_in_receipts!inner(incoming_stock_id)')
        .eq('lot_id', body.lot_id);

      if (rowsError || !rows || rows.length === 0) {
        console.error(`[${correlationId}] Goods_in_rows query failed:`, rowsError);
        return new Response(JSON.stringify({ 
          error: 'No goods_in_rows found for this lot',
          details: rowsError?.message,
          lot_id: body.lot_id
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const incomingStockId = rows[0].goods_in_receipts?.incoming_stock_id;
      
      if (!incomingStockId) {
        console.error(`[${correlationId}] Missing incoming_stock_id in query result`);
        return new Response(JSON.stringify({ 
          error: 'Data structure error: Could not determine incoming_stock_id',
          lot_id: body.lot_id
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const totalMeters = lot.meters;

      // Delete rolls
      await supabase.from('rolls').delete().eq('lot_id', body.lot_id);

      // Delete goods_in_rows
      await supabase.from('goods_in_rows').delete().eq('lot_id', body.lot_id);

      // Delete lot
      await supabase.from('lots').delete().eq('id', body.lot_id);

      // Decrement incoming_stock.received_meters
      const { data: incoming } = await supabase
        .from('incoming_stock')
        .select('received_meters')
        .eq('id', incomingStockId)
        .single();

      if (incoming) {
        await supabase
          .from('incoming_stock')
          .update({
            received_meters: Math.max(0, incoming.received_meters - totalMeters)
          })
          .eq('id', incomingStockId);
      }

      // Log the corrective audit
      const { data: auditLog } = await supabase.from('audit_logs').insert({
        action: 'DELETE',
        entity_type: 'lot',
        entity_id: body.lot_id,
        entity_identifier: `Admin direct reversal: ${lot.lot_number}`,
        user_id: user.id,
        user_email: user.email!,
        user_role: 'admin',
        old_data: lot,
        new_data: null,
        notes: `Admin repair: Direct reversal of lot without CREATE audit. Reason: ${body.reason || 'Missing audit entry'}`
      }).select().single();

      console.log(`[${correlationId}] Direct reversal completed for lot ${body.lot_id}`);

      return new Response(JSON.stringify({
        success: true,
        action: 'direct_reversal',
        lot_id: body.lot_id,
        audit_id: auditLog?.id,
        correlation_id: correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action or missing parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      correlation_id: correlationId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
