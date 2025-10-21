-- Fix 1: Restrict audit_logs INSERT to prevent log poisoning
-- Drop the open INSERT policy that allows any authenticated user
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- Create a restricted INSERT policy for audit_logs (only admins can insert directly)
-- Normal logging should go through the log_audit_action() SECURITY DEFINER function
CREATE POLICY "Only system functions can insert audit logs"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Fix 2: Add admin authorization check to can_reverse_action function
CREATE OR REPLACE FUNCTION public.can_reverse_action(p_audit_id uuid)
RETURNS TABLE(can_reverse boolean, reason text, reversal_strategy text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_audit_record audit_logs;
  v_dependent_actions integer;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RETURN QUERY SELECT false, 'Admin access required'::text, null::text;
    RETURN;
  END IF;

  SELECT * INTO v_audit_record
  FROM audit_logs
  WHERE id = p_audit_id;
  
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

-- Fix 3: Restrict reservations table SELECT access to authorized roles only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "All authenticated users can view reservations" ON reservations;

-- Create restricted SELECT policy for reservations
CREATE POLICY "Authorized roles can view reservations"
ON reservations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);