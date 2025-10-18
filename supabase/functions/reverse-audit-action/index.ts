import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReversalRequest {
  audit_id: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabaseAdmin
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

    const { audit_id, reason }: ReversalRequest = await req.json();

    const { data: auditLog, error: fetchError } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (fetchError || !auditLog) {
      return new Response(JSON.stringify({ error: 'Audit log not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: validationResult } = await supabaseAdmin.rpc('can_reverse_action', {
      p_audit_id: audit_id
    });

    if (!validationResult || !validationResult[0]?.can_reverse) {
      return new Response(JSON.stringify({ 
        error: validationResult?.[0]?.reason || 'Cannot reverse action',
        can_reverse: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const strategy = validationResult[0].reversal_strategy;
    let reversalAuditId: string;

    const tableMap: Record<string, string> = {
      'lot': 'lots',
      'roll': 'rolls',
      'order': 'orders',
      'order_lot': 'order_lots',
      'supplier': 'suppliers',
      'profile': 'profiles'
    };

    const tableName = tableMap[auditLog.entity_type] || `${auditLog.entity_type}s`;

    switch (strategy) {
      case 'DELETE':
        await supabaseAdmin
          .from(tableName)
          .delete()
          .eq('id', auditLog.entity_id);
        
        const { data: deleteAuditData } = await supabaseAdmin.rpc('log_audit_action', {
          p_action: 'DELETE',
          p_entity_type: auditLog.entity_type,
          p_entity_id: auditLog.entity_id,
          p_entity_identifier: auditLog.entity_identifier,
          p_old_data: auditLog.new_data,
          p_new_data: null,
          p_notes: `Reversed creation. Reason: ${reason || 'No reason provided'}`
        });
        reversalAuditId = deleteAuditData;
        break;

      case 'RESTORE':
        await supabaseAdmin
          .from(tableName)
          .insert(auditLog.old_data);
        
        const { data: restoreAuditData } = await supabaseAdmin.rpc('log_audit_action', {
          p_action: 'CREATE',
          p_entity_type: auditLog.entity_type,
          p_entity_id: auditLog.entity_id,
          p_entity_identifier: auditLog.entity_identifier,
          p_old_data: null,
          p_new_data: auditLog.old_data,
          p_notes: `Restored deleted record. Reason: ${reason || 'No reason provided'}`
        });
        reversalAuditId = restoreAuditData;
        break;

      case 'REVERT':
        await supabaseAdmin
          .from(tableName)
          .update(auditLog.old_data)
          .eq('id', auditLog.entity_id);
        
        const { data: revertAuditData } = await supabaseAdmin.rpc('log_audit_action', {
          p_action: 'UPDATE',
          p_entity_type: auditLog.entity_type,
          p_entity_id: auditLog.entity_id,
          p_entity_identifier: auditLog.entity_identifier,
          p_old_data: auditLog.new_data,
          p_new_data: auditLog.old_data,
          p_notes: `Reverted update. Reason: ${reason || 'No reason provided'}`
        });
        reversalAuditId = revertAuditData;
        break;

      default:
        throw new Error('Unknown reversal strategy');
    }

    await supabaseAdmin
      .from('audit_logs')
      .update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
        reversed_by: user.id,
        reversal_audit_id: reversalAuditId
      })
      .eq('id', audit_id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Action reversed successfully',
      reversal_audit_id: reversalAuditId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reversal error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
