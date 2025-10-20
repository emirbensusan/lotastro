-- Migration 5: RLS Policies & Permissions

-- === RLS POLICIES ===

-- incoming_stock policies
CREATE POLICY "Accounting, senior managers and admins can view incoming_stock"
  ON public.incoming_stock FOR SELECT
  USING (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting, senior managers and admins can create incoming_stock"
  ON public.incoming_stock FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting, senior managers and admins can update incoming_stock"
  ON public.incoming_stock FOR UPDATE
  USING (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete incoming_stock"
  ON public.incoming_stock FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- goods_in_receipts policies
CREATE POLICY "All authenticated users can view goods_in_receipts"
  ON public.goods_in_receipts FOR SELECT
  USING (true);

CREATE POLICY "Warehouse staff and above can create goods_in_receipts"
  ON public.goods_in_receipts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'warehouse_staff') OR has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update goods_in_receipts"
  ON public.goods_in_receipts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete goods_in_receipts"
  ON public.goods_in_receipts FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- goods_in_rows policies
CREATE POLICY "All authenticated users can view goods_in_rows"
  ON public.goods_in_rows FOR SELECT
  USING (true);

CREATE POLICY "Warehouse staff and above can create goods_in_rows"
  ON public.goods_in_rows FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'warehouse_staff') OR has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update goods_in_rows"
  ON public.goods_in_rows FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete goods_in_rows"
  ON public.goods_in_rows FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- reservations policies
CREATE POLICY "All authenticated users can view reservations"
  ON public.reservations FOR SELECT
  USING (true);

CREATE POLICY "Accounting, senior managers and admins can create reservations"
  ON public.reservations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting, senior managers and admins can update reservations"
  ON public.reservations FOR UPDATE
  USING (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reservations"
  ON public.reservations FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- reservation_lines policies
CREATE POLICY "All authenticated users can view reservation_lines"
  ON public.reservation_lines FOR SELECT
  USING (true);

CREATE POLICY "Accounting, senior managers and admins can create reservation_lines"
  ON public.reservation_lines FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting, senior managers and admins can update reservation_lines"
  ON public.reservation_lines FOR UPDATE
  USING (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Accounting, senior managers and admins can delete reservation_lines"
  ON public.reservation_lines FOR DELETE
  USING (has_role(auth.uid(), 'accounting') OR has_role(auth.uid(), 'senior_manager') OR has_role(auth.uid(), 'admin'));

-- === ROLE PERMISSIONS ===

-- Incoming category
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed) VALUES
('warehouse_staff', 'incoming', 'view', false),
('accounting', 'incoming', 'view', true),
('senior_manager', 'incoming', 'view', true),
('admin', 'incoming', 'view', true),

('warehouse_staff', 'incoming', 'create', false),
('accounting', 'incoming', 'create', true),
('senior_manager', 'incoming', 'create', true),
('admin', 'incoming', 'create', true),

('warehouse_staff', 'incoming', 'edit', false),
('accounting', 'incoming', 'edit', true),
('senior_manager', 'incoming', 'edit', true),
('admin', 'incoming', 'edit', true),

('warehouse_staff', 'incoming', 'delete', false),
('accounting', 'incoming', 'delete', false),
('senior_manager', 'incoming', 'delete', false),
('admin', 'incoming', 'delete', true),

('warehouse_staff', 'incoming', 'convert', false),
('accounting', 'incoming', 'convert', true),
('senior_manager', 'incoming', 'convert', true),
('admin', 'incoming', 'convert', true);

-- Goods-In category
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed) VALUES
('warehouse_staff', 'goodsin', 'view', true),
('accounting', 'goodsin', 'view', true),
('senior_manager', 'goodsin', 'view', true),
('admin', 'goodsin', 'view', true),

('warehouse_staff', 'goodsin', 'create', true),
('accounting', 'goodsin', 'create', true),
('senior_manager', 'goodsin', 'create', true),
('admin', 'goodsin', 'create', true),

('warehouse_staff', 'goodsin', 'edit', false),
('accounting', 'goodsin', 'edit', false),
('senior_manager', 'goodsin', 'edit', false),
('admin', 'goodsin', 'edit', true);

-- Reservations category
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed) VALUES
('warehouse_staff', 'reservations', 'view', true),
('accounting', 'reservations', 'view', true),
('senior_manager', 'reservations', 'view', true),
('admin', 'reservations', 'view', true),

('warehouse_staff', 'reservations', 'create', false),
('accounting', 'reservations', 'create', true),
('senior_manager', 'reservations', 'create', true),
('admin', 'reservations', 'create', true),

('warehouse_staff', 'reservations', 'edit', false),
('accounting', 'reservations', 'edit', true),
('senior_manager', 'reservations', 'edit', true),
('admin', 'reservations', 'edit', true),

('warehouse_staff', 'reservations', 'delete', false),
('accounting', 'reservations', 'delete', false),
('senior_manager', 'reservations', 'delete', false),
('admin', 'reservations', 'delete', true),

('warehouse_staff', 'reservations', 'cancel', false),
('accounting', 'reservations', 'cancel', true),
('senior_manager', 'reservations', 'cancel', true),
('admin', 'reservations', 'cancel', true),

('warehouse_staff', 'reservations', 'convert', false),
('accounting', 'reservations', 'convert', true),
('senior_manager', 'reservations', 'convert', true),
('admin', 'reservations', 'convert', true),

('warehouse_staff', 'reservations', 'release', false),
('accounting', 'reservations', 'release', true),
('senior_manager', 'reservations', 'release', true),
('admin', 'reservations', 'release', true),

('warehouse_staff', 'reservations', 'export', true),
('accounting', 'reservations', 'export', true),
('senior_manager', 'reservations', 'export', true),
('admin', 'reservations', 'export', true);