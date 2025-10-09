import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';

interface PermissionCache {
  [key: string]: boolean;
}

export const usePermissions = () => {
  const { profile } = useAuth();
  const { viewAsRole } = useViewAsRole();
  const [permissions, setPermissions] = useState<PermissionCache>({});
  const [loading, setLoading] = useState(true);

  // Determine effective role (viewAsRole takes precedence for admins)
  const effectiveRole = viewAsRole || profile?.role;

  useEffect(() => {
    if (effectiveRole) {
      fetchPermissions();
    }
  }, [effectiveRole]);

  const fetchPermissions = async () => {
    if (!effectiveRole) return;

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_category, permission_action, is_allowed')
        .eq('role', effectiveRole);

      if (error) throw error;

      // Build permission cache
      const cache: PermissionCache = {};
      data?.forEach(perm => {
        const key = `${perm.permission_category}:${perm.permission_action}`;
        cache[key] = perm.is_allowed;
      });

      setPermissions(cache);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (category: string, action: string): boolean => {
    // Admin always has all permissions (unless viewing as another role)
    if (profile?.role === 'admin' && !viewAsRole) return true;

    const key = `${category}:${action}`;
    return permissions[key] === true;
  };

  return { hasPermission, loading };
};
