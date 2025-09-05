-- Update RLS policies to include senior_manager where appropriate

-- LOT QUEUE
DROP POLICY IF EXISTS "Accounting and admins can delete lot_queue" ON public.lot_queue;
CREATE POLICY "Accounting, senior managers and admins can delete lot_queue" 
ON public.lot_queue 
FOR DELETE 
USING (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

DROP POLICY IF EXISTS "Accounting and admins can update lot_queue" ON public.lot_queue;
CREATE POLICY "Accounting, senior managers and admins can update lot_queue" 
ON public.lot_queue 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- LOTS
DROP POLICY IF EXISTS "Accounting and admins can update lots" ON public.lots;
CREATE POLICY "Accounting, senior managers and admins can update lots" 
ON public.lots 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

DROP POLICY IF EXISTS "Warehouse staff and admins can create lots" ON public.lots;
CREATE POLICY "Warehouse staff, senior managers and admins can create lots" 
ON public.lots 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'warehouse_staff'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ORDER_LOTS
DROP POLICY IF EXISTS "Accounting and admins can manage order_lots" ON public.order_lots;
CREATE POLICY "Accounting, senior managers and admins can manage order_lots" 
ON public.order_lots 
FOR ALL 
USING (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- ORDERS
DROP POLICY IF EXISTS "Accounting and admins can create orders" ON public.orders;
CREATE POLICY "Accounting, senior managers and admins can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

DROP POLICY IF EXISTS "Accounting and admins can update orders" ON public.orders;
CREATE POLICY "Accounting, senior managers and admins can update orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

DROP POLICY IF EXISTS "Only admins can delete orders" ON public.orders;
CREATE POLICY "Accounting, senior managers and admins can delete orders" 
ON public.orders 
FOR DELETE 
USING (
  has_role(auth.uid(), 'accounting'::user_role)
  OR has_role(auth.uid(), 'senior_manager'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
);

-- PROFILES: Admin-only delete
CREATE POLICY IF NOT EXISTS "Only admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::user_role));