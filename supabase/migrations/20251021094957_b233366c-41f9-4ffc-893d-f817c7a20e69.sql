-- Fix: Update can_reverse_action to support bypass from trusted edge functions
-- The auth.uid() returns NULL when called via service role, so edge functions
-- that already perform admin validation need to bypass the database-level check

CREATE OR REPLACE FUNCTION public.can_reverse_action(
  p_audit_id uuid,
  p_bypass_auth_check boolean DEFAULT false
)
RETURNS TABLE(can_reverse boolean, reason text, reversal_strategy text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_audit_record audit_logs;
  v_dependent_actions integer;
BEGIN
  -- Check if caller is admin (only if not bypassing from trusted edge function)
  -- Edge functions use service role key, so auth.uid() is NULL
  -- They perform their own admin validation before calling this function
  IF NOT p_bypass_auth_check AND NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RETURN QUERY SELECT false, 'Admin access required'::text, null::text;
    RETURN;
  END IF;

  SELECT * INTO v_audit_record
  FROM audit_logs
  WHERE id = p_audit_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Audit log not found'::text, null::text;
    RETURN;
  END IF;
  
  IF v_audit_record.is_reversed THEN
    RETURN QUERY SELECT false, 'Action already reversed'::text, null::text;
    RETURN;
  END IF;
  
  SELECT COUNT(*) INTO v_dependent_actions
  FROM audit_logs
  WHERE entity_type = v_audit_record.entity_type
    AND entity_id = v_audit_record.entity_id
    AND created_at > v_audit_record.created_at
    AND action != 'UPDATE';
  
  IF v_dependent_actions > 0 THEN
    RETURN QUERY SELECT 
      false, 
      format('Cannot reverse: %s subsequent actions depend on this', v_dependent_actions),
      null::text;
    RETURN;
  END IF;
  
  CASE v_audit_record.action
    WHEN 'CREATE' THEN
      RETURN QUERY SELECT true, 'Will delete created record'::text, 'DELETE'::text;
    WHEN 'DELETE' THEN
      RETURN QUERY SELECT true, 'Will restore deleted record'::text, 'RESTORE'::text;
    WHEN 'UPDATE' THEN
      RETURN QUERY SELECT true, 'Will restore previous values'::text, 'REVERT'::text;
    WHEN 'STATUS_CHANGE' THEN
      RETURN QUERY SELECT true, 'Will restore previous status'::text, 'REVERT'::text;
    ELSE
      RETURN QUERY SELECT false, 'Reversal not supported for this action type'::text, null::text;
  END CASE;
END;
$function$;