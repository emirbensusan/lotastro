-- Add active column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Update the has_role function to check if user is active
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, required_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = has_role.user_id
    AND profiles.role = required_role
    AND profiles.active = true
  )
$$;

-- Create function to check user dependencies
CREATE OR REPLACE FUNCTION public.check_user_dependencies(target_user_id uuid)
RETURNS TABLE(table_name text, dependency_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 'orders' as table_name, COUNT(*) as dependency_count FROM orders WHERE created_by = target_user_id
  UNION ALL
  SELECT 'orders_fulfilled' as table_name, COUNT(*) as dependency_count FROM orders WHERE fulfilled_by = target_user_id
  UNION ALL
  SELECT 'lot_queue' as table_name, COUNT(*) as dependency_count FROM lot_queue WHERE created_by = target_user_id
  UNION ALL
  SELECT 'field_edit_queue_submitted' as table_name, COUNT(*) as dependency_count FROM field_edit_queue WHERE submitted_by = target_user_id
  UNION ALL
  SELECT 'field_edit_queue_approved' as table_name, COUNT(*) as dependency_count FROM field_edit_queue WHERE approved_by = target_user_id
  UNION ALL
  SELECT 'order_queue_submitted' as table_name, COUNT(*) as dependency_count FROM order_queue WHERE submitted_by = target_user_id
  UNION ALL
  SELECT 'order_queue_approved' as table_name, COUNT(*) as dependency_count FROM order_queue WHERE approved_by = target_user_id
  UNION ALL
  SELECT 'user_invitations' as table_name, COUNT(*) as dependency_count FROM user_invitations WHERE invited_by = target_user_id;
$$;