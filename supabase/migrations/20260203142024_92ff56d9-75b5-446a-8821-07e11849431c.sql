-- Session 2.5: org_access.updated Handler Infrastructure
-- Creates sync_state table (service-role only) + atomic snapshot replacement RPC

-- =============================================================================
-- 1. Sync State Table (service-role only, no authenticated access)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_org_grants_sync_state (
  user_id UUID PRIMARY KEY,
  last_org_access_seq INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled but NO policies = effective service-role only
ALTER TABLE public.user_org_grants_sync_state ENABLE ROW LEVEL SECURITY;

-- Service-role only - no authenticated grant (avoids RLS/GRANT mismatch)
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM PUBLIC;
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM anon;
REVOKE ALL ON TABLE public.user_org_grants_sync_state FROM authenticated;
GRANT ALL ON TABLE public.user_org_grants_sync_state TO service_role;

COMMENT ON TABLE public.user_org_grants_sync_state IS 
  'Tracks last applied org_access_seq per user. Service-role only (no RLS policies). Independent of mirror rows to survive empty snapshots.';

-- =============================================================================
-- 2. Atomic Snapshot Replacement RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.replace_user_org_grants_snapshot(
  p_user_id UUID,
  p_org_access_seq INT,
  p_grants JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inserted_count INT := 0;
BEGIN
  DELETE FROM public.user_org_grants_mirror 
  WHERE user_id = p_user_id;

  IF p_grants IS NOT NULL AND jsonb_array_length(p_grants) > 0 THEN
    INSERT INTO public.user_org_grants_mirror 
      (user_id, crm_organization_id, role_in_org, is_active, org_access_seq, synced_at)
    SELECT
      p_user_id,
      (g->>'crm_organization_id')::UUID,
      (g->>'role_in_org')::TEXT,
      COALESCE((g->>'is_active')::BOOLEAN, true),
      p_org_access_seq,
      now()
    FROM jsonb_array_elements(p_grants) g;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  INSERT INTO public.user_org_grants_sync_state (user_id, last_org_access_seq, updated_at)
  VALUES (p_user_id, p_org_access_seq, now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_org_access_seq = EXCLUDED.last_org_access_seq,
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'org_access_seq', p_org_access_seq
  );
END;
$$;

COMMENT ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) IS 
  'Atomically replaces user org grants snapshot. SECURITY DEFINER, service-role only.';

REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_org_grants_snapshot(UUID, INT, JSONB) TO service_role;