import { usePermissionsContext } from '@/contexts/PermissionsContext';

/**
 * Hook to access global permissions cache.
 * Permissions are fetched once per role and cached in PermissionsProvider.
 * This hook is a thin wrapper around the context for backward compatibility.
 */
export const usePermissions = () => {
  return usePermissionsContext();
};
