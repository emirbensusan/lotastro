-- Add senior_manager to user_role enum
ALTER TYPE user_role ADD VALUE 'senior_manager';

-- Update RLS policies to include senior_manager permissions

-- Update lot_queue policies
DROP POLICY IF EXISTS "Accounting and admins can delete lot_queue" ON public.lot_queue;
CREATE POLICY "Accounting, senior managers and admins can delete lot_queue" 
ON public.lot_queue 
FOR DELETE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Accounting and admins can update lot_queue" ON public.lot_queue;
CREATE POLICY "Accounting, senior managers and admins can update lot_queue" 
ON public.lot_queue 
FOR UPDATE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Update lots policies
DROP POLICY IF EXISTS "Accounting and admins can update lots" ON public.lots;
CREATE POLICY "Accounting, senior managers and admins can update lots" 
ON public.lots 
FOR UPDATE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Warehouse staff and admins can create lots" ON public.lots;
CREATE POLICY "Warehouse staff, senior managers and admins can create lots" 
ON public.lots 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'warehouse_staff'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Update order_lots policies
DROP POLICY IF EXISTS "Accounting and admins can manage order_lots" ON public.order_lots;
CREATE POLICY "Accounting, senior managers and admins can manage order_lots" 
ON public.order_lots 
FOR ALL 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Update orders policies
DROP POLICY IF EXISTS "Accounting and admins can create orders" ON public.orders;
CREATE POLICY "Accounting, senior managers and admins can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Accounting and admins can update orders" ON public.orders;
CREATE POLICY "Accounting, senior managers and admins can update orders" 
ON public.orders 
FOR UPDATE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Keep orders delete as admin only since senior managers should not be able to delete orders per the requirements

-- Keep profiles policies as admin only for user management
-- Keep suppliers policies as admin only