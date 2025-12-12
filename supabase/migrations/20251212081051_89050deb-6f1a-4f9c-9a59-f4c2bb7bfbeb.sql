-- PHASE 1.1: RLS Policy Fixes

-- 1. Fix mo_status_history INSERT policy (currently allows anyone with 'true')
DROP POLICY IF EXISTS "System can insert mo_status_history" ON public.mo_status_history;

CREATE POLICY "Authorized roles can insert mo_status_history"
ON public.mo_status_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role) OR 
  has_role(auth.uid(), 'senior_manager'::user_role) OR 
  has_role(auth.uid(), 'admin'::user_role)
);

-- 2. Fix suppliers SELECT policy to include warehouse_staff
DROP POLICY IF EXISTS "Authorized roles can view suppliers" ON public.suppliers;

CREATE POLICY "Authorized roles can view suppliers"
ON public.suppliers
FOR SELECT
USING (
  has_role(auth.uid(), 'warehouse_staff'::user_role) OR
  has_role(auth.uid(), 'accounting'::user_role) OR 
  has_role(auth.uid(), 'senior_manager'::user_role) OR 
  has_role(auth.uid(), 'admin'::user_role)
);