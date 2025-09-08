-- Restrict Orders table access - remove overly permissive policy
DROP POLICY IF EXISTS "All authenticated users can view orders" ON public.orders;

-- Create new restricted policy for orders
CREATE POLICY "Authorized roles can view orders" 
ON public.orders 
FOR SELECT 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Restrict Suppliers table access - remove overly permissive policy  
DROP POLICY IF EXISTS "All authenticated users can view suppliers" ON public.suppliers;

-- Create new restricted policy for suppliers
CREATE POLICY "Authorized roles can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));