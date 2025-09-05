-- Create role_permissions table for dynamic permission management
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role user_role NOT NULL,
  permission_category TEXT NOT NULL,
  permission_action TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission_category, permission_action)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage role_permissions" 
ON public.role_permissions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "All authenticated users can view role_permissions" 
ON public.role_permissions 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions based on current PermissionsTab configuration
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed) VALUES
-- User Management
('admin', 'userManagement', 'create', true),
('admin', 'userManagement', 'edit', true),
('admin', 'userManagement', 'delete', true),
('admin', 'userManagement', 'viewAll', true),
('senior_manager', 'userManagement', 'viewAll', true),
('accounting', 'userManagement', 'viewAll', true),
('warehouse_staff', 'userManagement', 'viewAll', false),

-- Inventory Management
('admin', 'inventory', 'create', true),
('admin', 'inventory', 'edit', true),
('admin', 'inventory', 'delete', true),
('admin', 'inventory', 'viewReports', true),
('senior_manager', 'inventory', 'create', true),
('senior_manager', 'inventory', 'edit', true),
('senior_manager', 'inventory', 'delete', false),
('senior_manager', 'inventory', 'viewReports', true),
('accounting', 'inventory', 'create', false),
('accounting', 'inventory', 'edit', true),
('accounting', 'inventory', 'delete', false),
('accounting', 'inventory', 'viewReports', true),
('warehouse_staff', 'inventory', 'create', true),
('warehouse_staff', 'inventory', 'edit', false),
('warehouse_staff', 'inventory', 'delete', false),
('warehouse_staff', 'inventory', 'viewReports', false),

-- Order Management
('admin', 'orders', 'create', true),
('admin', 'orders', 'edit', true),
('admin', 'orders', 'delete', true),
('admin', 'orders', 'fulfill', true),
('senior_manager', 'orders', 'create', true),
('senior_manager', 'orders', 'edit', true),
('senior_manager', 'orders', 'delete', true),
('senior_manager', 'orders', 'fulfill', true),
('accounting', 'orders', 'create', true),
('accounting', 'orders', 'edit', true),
('accounting', 'orders', 'delete', true),
('accounting', 'orders', 'fulfill', true),
('warehouse_staff', 'orders', 'create', false),
('warehouse_staff', 'orders', 'edit', false),
('warehouse_staff', 'orders', 'delete', false),
('warehouse_staff', 'orders', 'fulfill', true),

-- Financial Reports
('admin', 'reports', 'view', true),
('admin', 'reports', 'export', true),
('senior_manager', 'reports', 'view', true),
('senior_manager', 'reports', 'export', true),
('accounting', 'reports', 'view', true),
('accounting', 'reports', 'export', true),
('warehouse_staff', 'reports', 'view', false),
('warehouse_staff', 'reports', 'export', false),

-- System Settings
('admin', 'system', 'configure', true),
('admin', 'system', 'backup', true),
('senior_manager', 'system', 'configure', false),
('senior_manager', 'system', 'backup', false),
('accounting', 'system', 'configure', false),
('accounting', 'system', 'backup', false),
('warehouse_staff', 'system', 'configure', false),
('warehouse_staff', 'system', 'backup', false);