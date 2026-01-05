import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useViewAsRole } from '@/contexts/ViewAsRoleContext';

interface PermissionCache {
  [key: string]: boolean;
}

interface PermissionsContextType {
  hasPermission: (category: string, action: string) => boolean;
  loading: boolean;
  effectiveRole: string | undefined;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { viewAsRole } = useViewAsRole();
  const [loading, setLoading] = useState(true);
  
  // Use ref for permissions to avoid re-renders when checking permissions
  const permissionsRef = useRef<PermissionCache>({});
  const [permissionsVersion, setPermissionsVersion] = useState(0);
  
  // Track which role we've fetched for to avoid duplicate fetches
  const fetchedForRoleRef = useRef<string | null>(null);

  // Determine effective role (viewAsRole takes precedence for admins)
  const effectiveRole = viewAsRole || profile?.role;

  const fetchPermissions = useCallback(async () => {
    if (!effectiveRole) {
      console.warn('[PermissionsProvider] No effective role, stopping load state');
      setLoading(false);
      return;
    }

    // Skip if already fetched for this role
    if (fetchedForRoleRef.current === effectiveRole) {
      console.log('[PermissionsProvider] Already fetched for role:', effectiveRole);
      return;
    }

    try {
      console.info('[PermissionsProvider] Fetching permissions for role:', effectiveRole);
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_category, permission_action, is_allowed')
        .eq('role', effectiveRole);

      if (error) {
        console.error('[PermissionsProvider] Database error:', error);
        throw error;
      }

      // Build permission cache
      const cache: PermissionCache = {};
      data?.forEach(perm => {
        const key = `${perm.permission_category}:${perm.permission_action}`;
        cache[key] = perm.is_allowed;
      });

      console.info('[PermissionsProvider] Loaded permissions:', Object.keys(cache).length, 'entries (single fetch)');
      permissionsRef.current = cache;
      fetchedForRoleRef.current = effectiveRole;
      setPermissionsVersion(v => v + 1); // Trigger re-render for consumers
    } catch (error) {
      console.error('[PermissionsProvider] Fatal error fetching permissions:', error);
      permissionsRef.current = {};
    } finally {
      setLoading(false);
    }
  }, [effectiveRole]);

  // Fetch permissions when role changes
  useEffect(() => {
    if (effectiveRole && fetchedForRoleRef.current !== effectiveRole) {
      // Reset loading when role changes
      setLoading(true);
      fetchPermissions();
    } else if (!effectiveRole) {
      setLoading(false);
    }
  }, [effectiveRole, fetchPermissions]);

  // Stable hasPermission callback
  const hasPermission = useCallback((category: string, action: string): boolean => {
    // Admin always has all permissions (unless viewing as another role)
    if (profile?.role === 'admin' && !viewAsRole) return true;

    const key = `${category}:${action}`;
    return permissionsRef.current[key] === true;
  }, [profile?.role, viewAsRole, permissionsVersion]); // permissionsVersion ensures updates propagate

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    hasPermission,
    loading,
    effectiveRole,
    refetch: fetchPermissions
  }), [hasPermission, loading, effectiveRole, fetchPermissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissionsContext = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissionsContext must be used within PermissionsProvider');
  }
  return context;
};

export { PermissionsContext };
