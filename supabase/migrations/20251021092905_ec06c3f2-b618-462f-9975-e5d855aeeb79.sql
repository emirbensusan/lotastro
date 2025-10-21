-- Add incoming stock view permission
INSERT INTO role_permissions (role, permission_category, permission_action, is_allowed)
VALUES 
  ('accounting', 'inventory', 'viewincoming', true),
  ('senior_manager', 'inventory', 'viewincoming', true),
  ('admin', 'inventory', 'viewincoming', true)
ON CONFLICT (role, permission_category, permission_action) DO NOTHING;

-- Add incoming stock receive permission
INSERT INTO role_permissions (role, permission_category, permission_action, is_allowed)
VALUES 
  ('accounting', 'inventory', 'receiveincoming', true),
  ('senior_manager', 'inventory', 'receiveincoming', true),
  ('admin', 'inventory', 'receiveincoming', true)
ON CONFLICT (role, permission_category, permission_action) DO NOTHING;

-- Enable dashboard access for warehouse_staff and accounting
UPDATE role_permissions 
SET is_allowed = true 
WHERE permission_category = 'reports' 
  AND permission_action = 'accessdashboard' 
  AND role IN ('warehouse_staff', 'accounting');