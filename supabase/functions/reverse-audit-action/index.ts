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

interface StructuredError {
  error: string;
  reason: string;
  details: string;
  step: string;
  correlation_id: string;
}

const TABLE_MAP: Record<string, string> = {
  'lot': 'lots',
  'roll': 'rolls',
  'order': 'orders',
  'order_lot': 'order_lots',
  'supplier': 'suppliers',
  'profile': 'profiles',
  'incoming_stock': 'incoming_stock',
  'goods_in_receipts': 'goods_in_receipts',
  'goods_in_rows': 'goods_in_rows',
  'reservation': 'reservations',
  'reservation_line': 'reservation_lines',
  'order_queue': 'order_queue',
  'field_edit_queue': 'field_edit_queue',
  'role_permission': 'role_permissions',
  'lot_queue': 'lot_queue',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  
  const returnError = (status: number, error: string, reason: string, details: string, step: string) => {
    const errorResponse: StructuredError = {
      error,
      reason,
      details,
      step,
      correlation_id: correlationId
    };
    console.error(`[${correlationId}] Error at step ${step}:`, errorResponse);
    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  };

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return returnError(401, 'unauthorized', 'Authentication required', authError?.message || 'No user found', 'authenticate');
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, email, full_name')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return returnError(403, 'forbidden', 'Admin access required', 'Only administrators can reverse audit actions', 'authorize');
    }

    const body = await req.json();
    
    const parseResult = ReversalRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return returnError(400, 'validation_failed', 'Invalid request data', JSON.stringify(parseResult.error.flatten().fieldErrors), 'validate_input');
    }

    const { audit_id, reason } = parseResult.data;
    console.log(`[${correlationId}] Processing reversal:`, { audit_id, reason, user_id: user.id });

    const { data: auditLog, error: fetchError } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('id', audit_id)
      .single();

    if (fetchError || !auditLog) {
      return returnError(404, 'not_found', 'Audit log not found', fetchError?.message || 'No audit entry exists with this ID', 'fetch_audit');
    }

    const { data: validationResult, error: validationError } = await supabaseAdmin.rpc('can_reverse_action', {
      p_audit_id: audit_id,
      p_bypass_auth_check: true
    });

    if (validationError) {
      return returnError(500, 'validation_failed', 'Failed to validate reversal', validationError.message, 'validate_reversal');
    }

    // Enhanced: If "already reversed" but entity exists, treat as recoverable inconsistency
    if (!validationResult || !validationResult[0]?.can_reverse) {
      const validationReason = validationResult?.[0]?.reason || 'Cannot reverse action';
      
      if (validationReason === 'Action already reversed') {
        console.log(`[${correlationId}] Detected "already reversed" flag, checking entity existence...`);
        
        // Check if entity still exists
        const tableName = TABLE_MAP[auditLog.entity_type];
        const { data: entityCheck } = await supabaseAdmin
          .from(tableName)
          .select('id')
          .eq('id', auditLog.entity_id)
          .single();

        if (entityCheck) {
          console.log(`[${correlationId}] INCONSISTENCY DETECTED: is_reversed=true but entity exists. Proceeding with reversal as repair.`);
          // Continue with reversal - don't return error
        } else {
          return returnError(400, 'cannot_reverse', validationReason, 'Action already reversed and entity does not exist.', 'check_reversibility');
        }
      } else {
        return returnError(400, 'cannot_reverse', validationReason, 'This action cannot be reversed. It may have dependent actions.', 'check_reversibility');
      }
    }

    console.log(`[${correlationId}] Reversal validated:`, { 
      audit_id, 
      strategy: validationResult[0].reversal_strategy,
      entity_type: auditLog.entity_type,
      action: auditLog.action
    });

    const strategy = validationResult[0].reversal_strategy;
    const tableName = TABLE_MAP[auditLog.entity_type];
    
    if (!tableName) {
      return returnError(400, 'unknown_entity', `Unknown entity type: ${auditLog.entity_type}`, 'No table mapping found for this entity type', 'resolve_table');
    }

    let reversalAuditId: string;

    switch (strategy) {
      case 'DELETE':
        // Special handling for lot CREATE reversal (goods receipt composite reversal)
        if (auditLog.entity_type === 'lot' && auditLog.action === 'CREATE') {
          console.log(`[${correlationId}] Composite reversal for goods receipt lot`);
          
          // Step 1: Collect related rolls
          const { data: rolls, error: rollsError } = await supabaseAdmin
            .from('rolls')
            .select('id, meters')
            .eq('lot_id', auditLog.entity_id);
          
          if (rollsError) {
            return returnError(500, 'db_error', 'Failed to fetch related rolls', rollsError.message, 'collect_rolls');
          }
          
          console.log(`[${correlationId}] Found ${rolls?.length || 0} rolls to delete`);
          
          // Step 2: Collect goods_in_rows with fallback
          const { data: goodsInRows, error: rowsError } = await supabaseAdmin
            .from('goods_in_rows')
            .select('id, receipt_id, meters')
            .eq('lot_id', auditLog.entity_id);
          
          if (rowsError) {
            return returnError(500, 'db_error', 'Failed to fetch goods_in_rows', rowsError.message, 'collect_goods_rows');
          }
          
          console.log(`[${correlationId}] Found ${goodsInRows?.length || 0} goods_in_rows to process`);
          
          // Fallback: If no goods_in_rows found, use audit new_data
          let receiptMeters = new Map<string, number>();
          let receiptIds = new Set<string>();
          let fallbackIncomingStockId: string | null = null;
          let fallbackMeters = 0;
          
          if (!goodsInRows || goodsInRows.length === 0) {
            console.log(`[${correlationId}] No goods_in_rows found, using fallback from audit new_data`);
            fallbackIncomingStockId = auditLog.new_data?.incoming_stock_id;
            fallbackMeters = auditLog.new_data?.lot?.meters || auditLog.new_data?.lots?.[0]?.meters || 0;
          } else {
            // Step 3: Group by receipt_id and decrement incoming_stock
            for (const row of goodsInRows) {
              receiptIds.add(row.receipt_id);
              const current = receiptMeters.get(row.receipt_id) || 0;
              receiptMeters.set(row.receipt_id, current + Number(row.meters));
            }
          }
          
          if (receiptIds.size > 0) {
            const { data: receipts, error: receiptsError } = await supabaseAdmin
              .from('goods_in_receipts')
              .select('id, incoming_stock_id')
              .in('id', Array.from(receiptIds));
            
            if (receiptsError) {
              return returnError(500, 'db_error', 'Failed to fetch receipts', receiptsError.message, 'collect_receipts');
            }
            
            console.log(`[${correlationId}] Processing ${receipts?.length || 0} receipts`);
            
            // Decrement incoming_stock for each receipt
            for (const receipt of receipts || []) {
              if (!receipt.incoming_stock_id) continue;
              
              const metersToDecrement = receiptMeters.get(receipt.id) || 0;
              
              const { data: incoming, error: fetchIncomingError } = await supabaseAdmin
                .from('incoming_stock')
                .select('received_meters, expected_meters')
                .eq('id', receipt.incoming_stock_id)
                .single();
              
              if (fetchIncomingError) {
                return returnError(500, 'db_error', 'Failed to fetch incoming_stock', fetchIncomingError.message, 'fetch_incoming_stock');
              }
              
              const newReceivedMeters = Math.max(0, Number(incoming.received_meters) - metersToDecrement);
              let newStatus = 'pending_inbound';
              
              if (newReceivedMeters >= Number(incoming.expected_meters)) {
                newStatus = 'fully_received';
              } else if (newReceivedMeters > 0) {
                newStatus = 'partially_received';
              }
              
              const { error: updateIncomingError } = await supabaseAdmin
                .from('incoming_stock')
                .update({ 
                  received_meters: newReceivedMeters,
                  status: newStatus
                })
                .eq('id', receipt.incoming_stock_id);
              
              if (updateIncomingError) {
                return returnError(500, 'db_error', 'Failed to update incoming_stock', updateIncomingError.message, 'update_incoming_stock');
              }
              
              console.log(`[${correlationId}] Decremented incoming_stock ${receipt.incoming_stock_id} by ${metersToDecrement}m, status: ${newStatus}`);
            }
          } else if (fallbackIncomingStockId && fallbackMeters > 0) {
            // Fallback: decrement using audit data
            console.log(`[${correlationId}] Using fallback decrement: ${fallbackIncomingStockId}, ${fallbackMeters}m`);
            
            const { data: incoming, error: fetchIncomingError } = await supabaseAdmin
              .from('incoming_stock')
              .select('received_meters, expected_meters')
              .eq('id', fallbackIncomingStockId)
              .single();
            
            if (!fetchIncomingError && incoming) {
              const newReceivedMeters = Math.max(0, Number(incoming.received_meters) - fallbackMeters);
              let newStatus = 'pending_inbound';
              
              if (newReceivedMeters >= Number(incoming.expected_meters)) {
                newStatus = 'fully_received';
              } else if (newReceivedMeters > 0) {
                newStatus = 'partially_received';
              }
              
              await supabaseAdmin
                .from('incoming_stock')
                .update({ 
                  received_meters: newReceivedMeters,
                  status: newStatus
                })
                .eq('id', fallbackIncomingStockId);
              
              console.log(`[${correlationId}] Fallback decrement successful: ${newReceivedMeters}m, status: ${newStatus}`);
            }
          }
            
            // Step 4: Delete goods_in_rows (only if they exist)
            if (goodsInRows && goodsInRows.length > 0) {
              const { error: deleteRowsError } = await supabaseAdmin
                .from('goods_in_rows')
                .delete()
                .eq('lot_id', auditLog.entity_id);
              
              if (deleteRowsError) {
                return returnError(500, 'db_error', 'Failed to delete goods_in_rows', deleteRowsError.message, 'delete_goods_rows');
              }
              
              // Step 5: Delete goods_in_receipts if no more rows remain
              for (const receiptId of receiptIds) {
                const { data: remainingRows, error: checkRowsError } = await supabaseAdmin
                  .from('goods_in_rows')
                  .select('id')
                  .eq('receipt_id', receiptId)
                  .limit(1);
                
                if (checkRowsError) {
                  return returnError(500, 'db_error', 'Failed to check remaining rows', checkRowsError.message, 'check_remaining_rows');
                }
                
                if (!remainingRows || remainingRows.length === 0) {
                  const { error: deleteReceiptError } = await supabaseAdmin
                    .from('goods_in_receipts')
                    .delete()
                    .eq('id', receiptId);
                  
                  if (deleteReceiptError) {
                    return returnError(500, 'db_error', 'Failed to delete receipt', deleteReceiptError.message, 'delete_receipt');
                  }
                  
                  console.log(`[${correlationId}] Deleted receipt ${receiptId} (no remaining rows)`);
                }
              }
            }
          
          // Step 6: Delete rolls
          if (rolls && rolls.length > 0) {
            const { error: deleteRollsError } = await supabaseAdmin
              .from('rolls')
              .delete()
              .eq('lot_id', auditLog.entity_id);
            
            if (deleteRollsError) {
              return returnError(500, 'db_error', 'Failed to delete rolls', deleteRollsError.message, 'delete_rolls');
            }
            
            console.log(`[${correlationId}] Deleted ${rolls.length} rolls`);
          }
          
          // Step 7: Delete lot
          const { error: deleteLotError } = await supabaseAdmin
            .from('lots')
            .delete()
            .eq('id', auditLog.entity_id);
          
          if (deleteLotError) {
            return returnError(500, 'db_error', 'Failed to delete lot', deleteLotError.message, 'delete_lot');
          }
          
          console.log(`[${correlationId}] Deleted lot ${auditLog.entity_id}`);
        } else {
          // Standard DELETE reversal
          const { error: deleteError } = await supabaseAdmin
            .from(tableName)
            .delete()
            .eq('id', auditLog.entity_id);
          
          if (deleteError) {
            return returnError(500, 'db_error', `Failed to delete from ${tableName}`, deleteError.message, 'delete_entity');
          }
        }
        
        // Log reversal audit entry (direct insert to avoid auth.uid() issue)
        const { data: deleteAuditData, error: deleteAuditError } = await supabaseAdmin
          .from('audit_logs')
          .insert({
            action: 'DELETE',
            entity_type: auditLog.entity_type,
            entity_id: auditLog.entity_id,
            entity_identifier: auditLog.entity_identifier,
            user_id: user.id,
            user_email: profile.email,
            user_role: profile.role,
            old_data: auditLog.new_data,
            new_data: null,
            notes: `Reversed creation. Reason: ${reason || 'No reason provided'}`
          })
          .select('id')
          .single();
        
        if (deleteAuditError) {
          return returnError(500, 'audit_error', 'Failed to create reversal audit entry', deleteAuditError.message, 'write_audit');
        }
        
        reversalAuditId = deleteAuditData.id;
        break;

      case 'RESTORE':
        // Special handling for incoming_stock restoration
        if (auditLog.entity_type === 'incoming_stock') {
          const { error: restoreError } = await supabaseAdmin
            .from('incoming_stock')
            .insert({
              ...auditLog.old_data,
              id: auditLog.entity_id,
              created_at: auditLog.old_data.created_at,
              updated_at: new Date().toISOString()
            });
          
          if (restoreError) {
            return returnError(500, 'db_error', 'Failed to restore incoming_stock', restoreError.message, 'restore_entity');
          }
          
          console.log(`[${correlationId}] Restored incoming_stock ${auditLog.entity_id}`);
        } else {
          const { error: restoreError } = await supabaseAdmin
            .from(tableName)
            .insert(auditLog.old_data);
          
          if (restoreError) {
            return returnError(500, 'db_error', `Failed to restore to ${tableName}`, restoreError.message, 'restore_entity');
          }
        }
        
        const { data: restoreAuditData, error: restoreAuditError } = await supabaseAdmin
          .from('audit_logs')
          .insert({
            action: 'CREATE',
            entity_type: auditLog.entity_type,
            entity_id: auditLog.entity_id,
            entity_identifier: auditLog.entity_identifier,
            user_id: user.id,
            user_email: profile.email,
            user_role: profile.role,
            old_data: null,
            new_data: auditLog.old_data,
            notes: `Restored deleted record. Reason: ${reason || 'No reason provided'}`
          })
          .select('id')
          .single();
        
        if (restoreAuditError) {
          return returnError(500, 'audit_error', 'Failed to create reversal audit entry', restoreAuditError.message, 'write_audit');
        }
        
        reversalAuditId = restoreAuditData.id;
        break;

      case 'REVERT':
        const { error: revertError } = await supabaseAdmin
          .from(tableName)
          .update(auditLog.old_data)
          .eq('id', auditLog.entity_id);
        
        if (revertError) {
          return returnError(500, 'db_error', `Failed to revert ${tableName}`, revertError.message, 'revert_entity');
        }
        
        const { data: revertAuditData, error: revertAuditError } = await supabaseAdmin
          .from('audit_logs')
          .insert({
            action: 'UPDATE',
            entity_type: auditLog.entity_type,
            entity_id: auditLog.entity_id,
            entity_identifier: auditLog.entity_identifier,
            user_id: user.id,
            user_email: profile.email,
            user_role: profile.role,
            old_data: auditLog.new_data,
            new_data: auditLog.old_data,
            notes: `Reverted update. Reason: ${reason || 'No reason provided'}`
          })
          .select('id')
          .single();
        
        if (revertAuditError) {
          return returnError(500, 'audit_error', 'Failed to create reversal audit entry', revertAuditError.message, 'write_audit');
        }
        
        reversalAuditId = revertAuditData.id;
        break;

      default:
        return returnError(400, 'unknown_strategy', `Unknown reversal strategy: ${strategy}`, 'The system returned an unexpected reversal strategy', 'execute_reversal');
    }

    const { error: markReversedError } = await supabaseAdmin
      .from('audit_logs')
      .update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
        reversed_by: user.id,
        reversal_audit_id: reversalAuditId
      })
      .eq('id', audit_id);

    if (markReversedError) {
      return returnError(500, 'audit_error', 'Failed to mark audit as reversed', markReversedError.message, 'mark_reversed');
    }

    console.log(`[${correlationId}] Reversal completed successfully:`, { audit_id, reversal_audit_id: reversalAuditId });

    return new Response(JSON.stringify({
      success: true,
      message: 'Action reversed successfully',
      reversal_audit_id: reversalAuditId,
      correlation_id: correlationId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return new Response(JSON.stringify({ 
      error: 'internal_error',
      reason: 'An unexpected error occurred',
      details: error.message,
      step: 'unknown',
      correlation_id: correlationId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
