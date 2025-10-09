import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PermissionCache {
  [key: string]: boolean;
}

export const usePermissions = () => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<PermissionCache>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role) {
      fetchPermissions();
    }
  }, [profile?.role]);

  const fetchPermissions = async () => {
    if (!profile?.role) return;

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_category, permission_action, is_allowed')
        .eq('role', profile.role);

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
    // Admin always has all permissions
    if (profile?.role === 'admin') return true;

    const key = `${category}:${action}`;
    return permissions[key] === true;
  };

  return { hasPermission, loading };
};
