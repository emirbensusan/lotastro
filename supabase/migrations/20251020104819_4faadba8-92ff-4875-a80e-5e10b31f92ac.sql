-- Insert permissions for incoming stock management
-- Four new permissions: viewincoming, createincoming, receiveincoming, deleteincoming

INSERT INTO role_permissions (role, permission_category, permission_action, is_allowed) VALUES
  -- Warehouse staff: Can view and receive incoming stock
  ('warehouse_staff', 'inventory', 'viewincoming', true),
  ('warehouse_staff', 'inventory', 'createincoming', false),
  ('warehouse_staff', 'inventory', 'receiveincoming', true),
  ('warehouse_staff', 'inventory', 'deleteincoming', false),
  
  -- Accounting: Can view, create, and receive incoming stock
  ('accounting', 'inventory', 'viewincoming', true),
  ('accounting', 'inventory', 'createincoming', true),
  ('accounting', 'inventory', 'receiveincoming', true),
  ('accounting', 'inventory', 'deleteincoming', false),
  
  -- Senior manager: Can view, create, receive, and delete incoming stock
  ('senior_manager', 'inventory', 'viewincoming', true),
  ('senior_manager', 'inventory', 'createincoming', true),
  ('senior_manager', 'inventory', 'receiveincoming', true),
  ('senior_manager', 'inventory', 'deleteincoming', true),
  
  -- Admin: Full access to all incoming stock operations
  ('admin', 'inventory', 'viewincoming', true),
  ('admin', 'inventory', 'createincoming', true),
  ('admin', 'inventory', 'receiveincoming', true),
  ('admin', 'inventory', 'deleteincoming', true)
ON CONFLICT (role, permission_category, permission_action) DO UPDATE
  SET is_allowed = EXCLUDED.is_allowed;