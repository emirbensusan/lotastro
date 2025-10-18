-- Create audit action and entity type enums
CREATE TYPE audit_action_type AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 
  'STATUS_CHANGE', 'FULFILL', 'APPROVE', 'REJECT'
);

CREATE TYPE audit_entity_type AS ENUM (
  'lot', 'roll', 'order', 'order_lot', 'supplier', 
  'lot_queue', 'order_queue', 'field_edit_queue', 
  'profile', 'role_permission'
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action metadata
  action audit_action_type NOT NULL,
  entity_type audit_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  entity_identifier text,
  
  -- User tracking
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_email text NOT NULL,
  user_role text NOT NULL,
  
  -- Data snapshot
  old_data jsonb,
  new_data jsonb,
  changed_fields jsonb,
  
  -- Reversal tracking
  is_reversed boolean DEFAULT false,
  reversed_at timestamptz,
  reversed_by uuid REFERENCES auth.users(id),
  reversal_audit_id uuid REFERENCES public.audit_logs(id),
  
  -- Context
  notes text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT audit_logs_entity_check CHECK (entity_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_reversed ON audit_logs(is_reversed) WHERE is_reversed = false;

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin and senior managers can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'senior_manager')
  );

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can update audit logs for reversals"
  ON audit_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Audit logging function
CREATE OR REPLACE FUNCTION log_audit_action(
  p_action audit_action_type,
  p_entity_type audit_entity_type,
  p_entity_id uuid,
  p_entity_identifier text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_changed_fields jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_user_email text;
  v_user_role text;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  SELECT role::text INTO v_user_role
  FROM profiles
  WHERE user_id = auth.uid();
  
  INSERT INTO audit_logs (
    action, entity_type, entity_id, entity_identifier,
    user_id, user_email, user_role,
    old_data, new_data, changed_fields, notes
  )
  VALUES (
    p_action, p_entity_type, p_entity_id, p_entity_identifier,
    auth.uid(), v_user_email, v_user_role,
    p_old_data, p_new_data, p_changed_fields, p_notes
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Reversal validation function
CREATE OR REPLACE FUNCTION can_reverse_action(p_audit_id uuid)
RETURNS TABLE(
  can_reverse boolean,
  reason text,
  reversal_strategy text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_record audit_logs;
  v_dependent_actions integer;
BEGIN
  SELECT * INTO v_audit_record
  FROM audit_logs
  WHERE id = p_audit_id;
  
  IF v_audit_record.is_reversed THEN
    RETURN QUERY SELECT false, 'Action already reversed', null::text;
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
      RETURN QUERY SELECT true, 'Will delete created record', 'DELETE';
    WHEN 'DELETE' THEN
      RETURN QUERY SELECT true, 'Will restore deleted record', 'RESTORE';
    WHEN 'UPDATE' THEN
      RETURN QUERY SELECT true, 'Will restore previous values', 'REVERT';
    WHEN 'STATUS_CHANGE' THEN
      RETURN QUERY SELECT true, 'Will restore previous status', 'REVERT';
    ELSE
      RETURN QUERY SELECT false, 'Reversal not supported for this action type', null::text;
  END CASE;
END;
$$;

-- Add audit permissions
INSERT INTO role_permissions (role, permission_category, permission_action, is_allowed) VALUES
  ('admin', 'audit', 'viewlogs', true),
  ('admin', 'audit', 'reverseactions', true),
  ('senior_manager', 'audit', 'viewlogs', true),
  ('senior_manager', 'audit', 'reverseactions', false),
  ('accounting', 'audit', 'viewlogs', false),
  ('warehouse_staff', 'audit', 'viewlogs', false)
ON CONFLICT DO NOTHING;