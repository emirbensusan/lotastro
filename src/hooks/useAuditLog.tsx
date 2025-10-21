import { supabase } from '@/integrations/supabase/client';

export const useAuditLog = () => {
  const logAction = async (
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'FULFILL' | 'APPROVE' | 'REJECT',
    entityType: 'field_edit_queue' | 'lot' | 'lot_queue' | 'order' | 'order_lot' | 'order_queue' | 'profile' | 'role_permission' | 'roll' | 'supplier' | 'incoming_stock',
    entityId: string,
    entityIdentifier: string,
    oldData?: any,
    newData?: any,
    notes?: string
  ) => {
    try {
      await supabase.rpc('log_audit_action', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_entity_identifier: entityIdentifier,
        p_old_data: oldData || null,
        p_new_data: newData || null,
        p_changed_fields: null,
        p_notes: notes || null
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  };

  return { logAction };
};
