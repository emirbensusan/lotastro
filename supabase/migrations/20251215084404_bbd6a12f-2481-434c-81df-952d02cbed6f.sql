-- Seed stocktake permissions for all roles
INSERT INTO role_permissions (role, permission_category, permission_action, is_allowed) VALUES
-- warehouse_staff stocktake permissions
('warehouse_staff', 'stocktake', 'startsession', true),
('warehouse_staff', 'stocktake', 'capturerolls', true),
('warehouse_staff', 'stocktake', 'viewownsessions', true),
('warehouse_staff', 'stocktake', 'reviewsessions', false),
('warehouse_staff', 'stocktake', 'approverolls', false),
('warehouse_staff', 'stocktake', 'deletesessions', false),
-- accounting stocktake permissions
('accounting', 'stocktake', 'startsession', true),
('accounting', 'stocktake', 'capturerolls', true),
('accounting', 'stocktake', 'viewownsessions', true),
('accounting', 'stocktake', 'reviewsessions', false),
('accounting', 'stocktake', 'approverolls', false),
('accounting', 'stocktake', 'deletesessions', false),
-- senior_manager stocktake permissions
('senior_manager', 'stocktake', 'startsession', true),
('senior_manager', 'stocktake', 'capturerolls', true),
('senior_manager', 'stocktake', 'viewownsessions', true),
('senior_manager', 'stocktake', 'reviewsessions', true),
('senior_manager', 'stocktake', 'approverolls', false),
('senior_manager', 'stocktake', 'deletesessions', false),
-- admin stocktake permissions
('admin', 'stocktake', 'startsession', true),
('admin', 'stocktake', 'capturerolls', true),
('admin', 'stocktake', 'viewownsessions', true),
('admin', 'stocktake', 'reviewsessions', true),
('admin', 'stocktake', 'approverolls', true),
('admin', 'stocktake', 'deletesessions', true)
ON CONFLICT (role, permission_category, permission_action) DO UPDATE SET is_allowed = EXCLUDED.is_allowed;

-- Update warehouse_staff to have dashboard and inventory view permissions
UPDATE role_permissions SET is_allowed = true 
WHERE role = 'warehouse_staff' AND permission_category = 'reports' AND permission_action = 'accessdashboard';

UPDATE role_permissions SET is_allowed = true 
WHERE role = 'warehouse_staff' AND permission_category = 'inventory' AND permission_action = 'viewinventory';

-- Ensure warehouse_staff can view orders and reservations (already set in code but ensure in DB)
UPDATE role_permissions SET is_allowed = true 
WHERE role = 'warehouse_staff' AND permission_category = 'orders' AND permission_action = 'vieworders';