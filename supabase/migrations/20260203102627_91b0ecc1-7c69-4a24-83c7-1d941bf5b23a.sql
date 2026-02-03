-- Session 2.1: Org Grants Mirror Table
-- Creates storage for CRM organization grants mirrored via org_access.updated events
-- Contract v1.0.23 compliant

-- Create table with explicit constraint naming
CREATE TABLE public.user_org_grants_mirror (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  crm_organization_id UUID NOT NULL,
  role_in_org TEXT NOT NULL CHECK (role_in_org IN (
    'sales_owner', 'sales_manager', 'pricing', 'accounting', 'admin'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  org_access_seq INTEGER NOT NULL CHECK (org_access_seq >= 0),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_org_grants_mirror_user_org_key UNIQUE (user_id, crm_organization_id)
);

-- Comments
COMMENT ON TABLE public.user_org_grants_mirror IS 
  'Mirrors CRM user_org_roles via org_access.updated events. Contract v1.0.23 compliant.';
COMMENT ON COLUMN public.user_org_grants_mirror.role_in_org IS 
  'Contract-locked values: sales_owner, sales_manager, pricing, accounting, admin';

-- Indexes
CREATE INDEX idx_org_grants_user 
  ON public.user_org_grants_mirror(user_id);
CREATE INDEX idx_org_grants_org 
  ON public.user_org_grants_mirror(crm_organization_id);
CREATE INDEX idx_org_grants_active 
  ON public.user_org_grants_mirror(user_id, is_active) 
  WHERE is_active = true;

-- Idempotent trigger creation (safe for re-runs/rollbacks)
DROP TRIGGER IF EXISTS update_user_org_grants_mirror_updated_at 
  ON public.user_org_grants_mirror;

CREATE TRIGGER update_user_org_grants_mirror_updated_at
  BEFORE UPDATE ON public.user_org_grants_mirror
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS & Privileges (defense-in-depth)
ALTER TABLE public.user_org_grants_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_org_grants_mirror FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.user_org_grants_mirror FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.user_org_grants_mirror FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_org_grants_mirror FROM authenticated;
GRANT SELECT ON TABLE public.user_org_grants_mirror TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_org_grants_mirror TO service_role;

-- RLS Policies
CREATE POLICY "users_view_own_grants"
  ON public.user_org_grants_mirror
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_view_all_grants"
  ON public.user_org_grants_mirror
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));