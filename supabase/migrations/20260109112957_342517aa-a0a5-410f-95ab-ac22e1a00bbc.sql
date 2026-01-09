-- Fix overly permissive RLS policy on inventory_transactions
-- Drop the current permissive policy
DROP POLICY IF EXISTS "Authenticated users can insert inventory transactions" ON public.inventory_transactions;

-- Create a more restrictive policy that only allows authorized roles to insert
-- Warehouse staff need to log transactions when receiving/shipping goods
-- Accounting needs to log adjustments and reconciliations
-- Senior managers and admins have full access
CREATE POLICY "Authorized roles can insert inventory transactions"
ON public.inventory_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'warehouse_staff'::user_role) OR
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);