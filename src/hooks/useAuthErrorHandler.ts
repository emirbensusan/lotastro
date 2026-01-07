import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// Error patterns that indicate invalid/expired refresh tokens
const REFRESH_TOKEN_ERROR_PATTERNS = [
  'refresh token not found',
  'invalid refresh token',
  'refresh_token_not_found',
  'invalid_grant',
  'token has expired',
  'jwt expired',
  'session_not_found',
];

// MFA cache key to clear on auth errors
const MFA_STATUS_CACHE_KEY = 'lotastro_mfa_status';

/**
 * Centralized auth error handler that:
 * - Detects invalid refresh token errors
 * - Performs clean sign-out without retry
 * - Clears all caches (React Query, sessionStorage)
 * - Redirects to login with appropriate message
 */
export function useAuthErrorHandler() {
  const navigate = useNavigate();
  const isHandlingRef = useRef(false);

  /**
   * Check if an error indicates an invalid/expired refresh token
   */
  const isRefreshTokenError = useCallback((error: Error | string | unknown): boolean => {
    const errorMessage = typeof error === 'string' 
      ? error.toLowerCase() 
      : error instanceof Error 
        ? error.message.toLowerCase() 
        : JSON.stringify(error).toLowerCase();

    return REFRESH_TOKEN_ERROR_PATTERNS.some(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );
  }, []);

  /**
   * Clear all application caches
   */
  const clearAllCaches = useCallback(() => {
    // Clear React Query cache
    queryClient.clear();
    
    // Clear session storage items
    try {
      sessionStorage.removeItem(MFA_STATUS_CACHE_KEY);
      // Clear any other app-specific session storage items
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('lotastro_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }
    
    console.info('[AuthErrorHandler] All caches cleared');
  }, []);

  /**
   * Handle auth errors - performs clean logout without retry
   */
  const handleAuthError = useCallback(async (
    error: Error | string | unknown,
    options: { silent?: boolean; reason?: string } = {}
  ) => {
    // Prevent multiple simultaneous handlers
    if (isHandlingRef.current) {
      console.info('[AuthErrorHandler] Already handling an auth error, skipping');
      return;
    }

    const { silent = false, reason = 'session_expired' } = options;

    // Check if this is a refresh token error
    if (!isRefreshTokenError(error)) {
      console.info('[AuthErrorHandler] Not a refresh token error, ignoring');
      return;
    }

    isHandlingRef.current = true;
    console.info('[AuthErrorHandler] Handling auth error:', error);

    try {
      // Clear all caches first
      clearAllCaches();

      // Sign out without retry - this is intentionally fire-and-forget
      // We don't want to get into a retry loop
      supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Ignore sign-out errors - we're already handling an auth error
      });

      // Show toast unless silent
      if (!silent) {
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please sign in again.',
          variant: 'destructive',
          duration: 5000,
        });
      }

      // Navigate to auth page
      navigate('/auth', {
        replace: true,
        state: { from: window.location.pathname, reason },
      });
    } finally {
      // Reset handling flag after a delay to prevent rapid re-triggers
      setTimeout(() => {
        isHandlingRef.current = false;
      }, 2000);
    }
  }, [isRefreshTokenError, clearAllCaches, navigate]);

  /**
   * Check if currently handling an auth error
   */
  const isHandlingAuthError = useCallback(() => {
    return isHandlingRef.current;
  }, []);

  return {
    handleAuthError,
    isRefreshTokenError,
    clearAllCaches,
    isHandlingAuthError,
  };
}

export default useAuthErrorHandler;
