-- ============================================
-- Session 0.1: Contract Violations Table + Validation Functions
-- Purpose: Drift prevention infrastructure for WMS-CRM integration
-- Contract: v1.0.23
-- ============================================

-- 1. Create integration_contract_violations table
CREATE TABLE public.integration_contract_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Event context
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  source_system TEXT NOT NULL CHECK (source_system IN ('crm', 'wms')),
  
  -- Violation details
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'invalid_idempotency_key',
    'invalid_uom',
    'unknown_field',
    'missing_required_field',
    'schema_mismatch',
    'hmac_failure',
    'unknown_event_type',
    'payload_hash_drift',
    'sequence_out_of_order',
    'other'
  )),
  violation_message TEXT NOT NULL,
  
  -- Payload context (sanitized - no sensitive data)
  field_name TEXT,
  field_value TEXT,
  expected_value TEXT,
  
  -- Full payload for debugging (JSONB for flexibility)
  payload_snapshot JSONB,
  
  -- Processing context
  inbox_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- 2. Create indexes for violations table
CREATE INDEX idx_contract_violations_created_at ON public.integration_contract_violations(created_at DESC);
CREATE INDEX idx_contract_violations_event_type ON public.integration_contract_violations(event_type);
CREATE INDEX idx_contract_violations_violation_type ON public.integration_contract_violations(violation_type);
CREATE INDEX idx_contract_violations_source_system ON public.integration_contract_violations(source_system);
CREATE INDEX idx_contract_violations_unresolved ON public.integration_contract_violations(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_contract_violations_idempotency ON public.integration_contract_violations(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE public.integration_contract_violations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Admin only read, service role write
CREATE POLICY "Admins can view contract violations"
  ON public.integration_contract_violations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update violations (resolve)"
  ON public.integration_contract_violations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Create validate_idempotency_key() function
-- Contract format: <source_system>:<entity>:<entity_id>:<action>:v1
-- Must be exactly 5 colon-separated segments
CREATE OR REPLACE FUNCTION public.validate_idempotency_key(p_key TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  source_system TEXT,
  entity TEXT,
  entity_id TEXT,
  action TEXT,
  version TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_parts TEXT[];
  v_segment_count INT;
BEGIN
  -- Handle NULL or empty input
  IF p_key IS NULL OR TRIM(p_key) = '' THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      'Idempotency key is null or empty'::TEXT;
    RETURN;
  END IF;

  -- Split by colon
  v_parts := string_to_array(p_key, ':');
  v_segment_count := array_length(v_parts, 1);

  -- Must have exactly 5 segments
  IF v_segment_count IS NULL OR v_segment_count != 5 THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      format('Expected 5 segments, got %s', COALESCE(v_segment_count, 0))::TEXT;
    RETURN;
  END IF;

  -- Validate source_system (must be 'wms' or 'crm')
  IF v_parts[1] NOT IN ('wms', 'crm') THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_parts[1]::TEXT,
      v_parts[2]::TEXT,
      v_parts[3]::TEXT,
      v_parts[4]::TEXT,
      v_parts[5]::TEXT,
      format('Invalid source_system: %s (must be wms or crm)', v_parts[1])::TEXT;
    RETURN;
  END IF;

  -- Validate version (must be 'v1')
  IF v_parts[5] != 'v1' THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_parts[1]::TEXT,
      v_parts[2]::TEXT,
      v_parts[3]::TEXT,
      v_parts[4]::TEXT,
      v_parts[5]::TEXT,
      format('Invalid version: %s (must be v1)', v_parts[5])::TEXT;
    RETURN;
  END IF;

  -- Validate no empty segments
  IF v_parts[2] = '' OR v_parts[3] = '' OR v_parts[4] = '' THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_parts[1]::TEXT,
      v_parts[2]::TEXT,
      v_parts[3]::TEXT,
      v_parts[4]::TEXT,
      v_parts[5]::TEXT,
      'Entity, entity_id, and action cannot be empty'::TEXT;
    RETURN;
  END IF;

  -- Valid key - return parsed components
  RETURN QUERY SELECT 
    true::BOOLEAN,
    v_parts[1]::TEXT,
    v_parts[2]::TEXT,
    v_parts[3]::TEXT,
    v_parts[4]::TEXT,
    v_parts[5]::TEXT,
    NULL::TEXT;
END;
$$;

-- 6. Create validate_contract_uom() function
-- Contract only allows MT (meters) and KG (kilograms)
CREATE OR REPLACE FUNCTION public.validate_contract_uom(p_uom TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT UPPER(COALESCE(p_uom, '')) IN ('MT', 'KG');
$$;

-- 7. Create helper function to log contract violations
CREATE OR REPLACE FUNCTION public.log_contract_violation(
  p_event_type TEXT,
  p_idempotency_key TEXT,
  p_source_system TEXT,
  p_violation_type TEXT,
  p_violation_message TEXT,
  p_field_name TEXT DEFAULT NULL,
  p_field_value TEXT DEFAULT NULL,
  p_expected_value TEXT DEFAULT NULL,
  p_payload_snapshot JSONB DEFAULT NULL,
  p_inbox_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_violation_id UUID;
BEGIN
  INSERT INTO public.integration_contract_violations (
    event_type,
    idempotency_key,
    source_system,
    violation_type,
    violation_message,
    field_name,
    field_value,
    expected_value,
    payload_snapshot,
    inbox_id
  ) VALUES (
    p_event_type,
    p_idempotency_key,
    p_source_system,
    p_violation_type,
    p_violation_message,
    p_field_name,
    p_field_value,
    p_expected_value,
    p_payload_snapshot,
    p_inbox_id
  )
  RETURNING id INTO v_violation_id;

  RETURN v_violation_id;
END;
$$;

-- 8. Grant execute permissions (REVOKE from public, GRANT to authenticated)
REVOKE ALL ON FUNCTION public.validate_idempotency_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_idempotency_key(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_contract_uom(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_contract_uom(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.log_contract_violation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_contract_violation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- Add table comment
COMMENT ON TABLE public.integration_contract_violations IS 'Tracks all contract drift violations between WMS and CRM systems per integration_contract_v1.0.23';
COMMENT ON FUNCTION public.validate_idempotency_key(TEXT) IS 'Validates 5-segment idempotency key format: <source>:<entity>:<id>:<action>:v1';
COMMENT ON FUNCTION public.validate_contract_uom(TEXT) IS 'Validates UOM against contract-allowed values (MT, KG only)';