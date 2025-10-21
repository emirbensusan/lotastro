import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ReversalRequestSchema = z.object({
  audit_id: z.string().uuid('Invalid audit ID format'),
  reason: z.string().optional(),
});

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

    const body = await req.json();
    
    // Validate input with Zod
    const parseResult = ReversalRequestSchema.safeParse(body);
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.flatten());
      return new Response(JSON.stringify({ 
        error: 'Invalid request data',
        details: parseResult.error.flatten().fieldErrors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { audit_id, reason } = parseResult.data;
    console.log('Processing reversal request:', { audit_id, reason });

    const { data: auditLog, error: fetchError } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (fetchError || !auditLog) {
      console.error('Audit log not found:', { audit_id, fetchError });
      return new Response(JSON.stringify({ 
        error: 'Audit log not found',
        details: 'The specified audit log entry does not exist'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call with bypass parameter since edge function already validated admin
    const { data: validationResult, error: validationError } = await supabaseAdmin.rpc('can_reverse_action', {
      p_audit_id: audit_id,
      p_bypass_auth_check: true  // Edge function already validated admin access
    });

    if (validationError) {
      console.error('Validation RPC error:', validationError);
      return new Response(JSON.stringify({ 
        error: 'Failed to validate reversal',
        details: validationError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!validationResult || !validationResult[0]?.can_reverse) {
      const reason = validationResult?.[0]?.reason || 'Cannot reverse action';
      console.error('Reversal validation failed:', { audit_id, reason });
      
      return new Response(JSON.stringify({ 
        error: 'Cannot reverse this action',
        reason: reason,
        details: 'This action cannot be reversed. It may have already been reversed or have dependent actions.',
        can_reverse: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Reversal validation passed:', { 
      audit_id, 
      strategy: validationResult[0].reversal_strategy 
    });

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
      error: 'Failed to reverse action',
      details: error.message,
      hint: 'Check the audit log for this action and verify it can be reversed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
