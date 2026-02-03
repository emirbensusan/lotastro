-- Session 2.2: Active Org Preferences
-- Creates user_active_org_preferences table and get/set functions
-- Contract: v1.0.23 | Batch: 2 (Multi-Org Identity)

-- =============================================================================
-- 1. CREATE TABLE
-- =============================================================================
CREATE TABLE public.user_active_org_preferences (
  user_id UUID PRIMARY KEY,
  active_org_id UUID NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_active_org_preferences IS 
  'Stores the user''s currently selected organization context for WMS queries. No FK to auth.users for sync flexibility; orphan cleanup handled by maintenance job.';

-- =============================================================================
-- 2. CREATE INDEX
-- =============================================================================
CREATE INDEX idx_active_org_prefs_org 
  ON public.user_active_org_preferences(active_org_id);

-- =============================================================================
-- 3. CREATE TRIGGER (Idempotent, Schema-Qualified)
-- =============================================================================
DROP TRIGGER IF EXISTS update_user_active_org_preferences_updated_at
  ON public.user_active_org_preferences;

CREATE TRIGGER update_user_active_org_preferences_updated_at
  BEFORE UPDATE ON public.user_active_org_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 4. ROW-LEVEL SECURITY & PRIVILEGES (Defense-in-Depth)
-- =============================================================================
ALTER TABLE public.user_active_org_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_org_preferences FORCE ROW LEVEL SECURITY;

-- Revoke from PUBLIC and anon
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM anon;

-- Authenticated users: SELECT, INSERT, UPDATE on their own row only
REVOKE ALL PRIVILEGES ON TABLE public.user_active_org_preferences FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_active_org_preferences TO authenticated;

-- Service role: full access for Edge Functions
GRANT ALL PRIVILEGES ON TABLE public.user_active_org_preferences TO service_role;

-- RLS Policy: Users can only access their own preference
CREATE POLICY "users_manage_own_active_org"
  ON public.user_active_org_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin policy: Schema-qualified has_role + enum cast
CREATE POLICY "admins_view_all_active_org_prefs"
  ON public.user_active_org_preferences
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.user_role));

-- =============================================================================
-- 5. FUNCTION: get_active_org_id()
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_stored_org_id UUID;
  v_fallback_org_id UUID;
BEGIN
  -- Get current user from auth context
  v_user_id := auth.uid();
  
  -- Guard: No auth context
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Try to get stored preference
  SELECT active_org_id INTO v_stored_org_id
  FROM public.user_active_org_preferences
  WHERE user_id = v_user_id;
  
  -- If stored preference exists, validate it's still accessible
  IF v_stored_org_id IS NOT NULL THEN
    -- Check if user still has active access to this org
    IF EXISTS (
      SELECT 1 FROM public.user_org_grants_mirror
      WHERE user_id = v_user_id
        AND crm_organization_id = v_stored_org_id
        AND is_active = true
    ) THEN
      RETURN v_stored_org_id;
    END IF;
    -- Stored org is no longer accessible - fall through to fallback
  END IF;
  
  -- Fallback: first active grant by synced_at (v1.0.23)
  SELECT crm_organization_id INTO v_fallback_org_id
  FROM public.user_org_grants_mirror
  WHERE user_id = v_user_id
    AND is_active = true
  ORDER BY synced_at ASC
  LIMIT 1;
  
  RETURN v_fallback_org_id;  -- May be NULL if user has no grants
END;
$$;

COMMENT ON FUNCTION public.get_active_org_id() IS 
  'Returns the active org ID for the current user. Falls back to first available grant (by synced_at) if preference is missing or invalid.';

-- Function privilege hardening
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO service_role;

-- =============================================================================
-- 6. FUNCTION: set_active_org_id(UUID)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_active_org_id(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Get current user from auth context
  v_user_id := auth.uid();
  
  -- Guard: No auth context
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Guard: NULL org_id not allowed
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Validate user has active access to this org
  SELECT EXISTS (
    SELECT 1 FROM public.user_org_grants_mirror
    WHERE user_id = v_user_id
      AND crm_organization_id = p_org_id
      AND is_active = true
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RETURN FALSE;  -- User cannot set an org they don't have access to
  END IF;
  
  -- Upsert the preference
  INSERT INTO public.user_active_org_preferences (user_id, active_org_id, set_at)
  VALUES (v_user_id, p_org_id, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    active_org_id = EXCLUDED.active_org_id,
    set_at = now();
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.set_active_org_id(UUID) IS 
  'Sets the active org ID for the current user. Returns FALSE if user lacks access to the org.';

-- Function privilege hardening
REVOKE ALL ON FUNCTION public.set_active_org_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org_id(UUID) TO service_role;