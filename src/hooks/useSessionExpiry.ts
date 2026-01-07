import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

// MFA cache key to clear
const MFA_STATUS_CACHE_KEY = 'lotastro_mfa_status';

interface UseSessionExpiryOptions {
  onSessionExpired?: () => void;
  redirectPath?: string;
}

export function useSessionExpiry({
  onSessionExpired,
  redirectPath = '/auth',
}: UseSessionExpiryOptions = {}) {
  const navigate = useNavigate();
  const hasHandledExpiry = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 1;

  /**
   * Check if error message indicates a refresh token issue
   */
  const isRefreshTokenError = useCallback((errorMessage: string): boolean => {
    const lowerMessage = errorMessage.toLowerCase();
    return REFRESH_TOKEN_ERROR_PATTERNS.some(pattern => 
      lowerMessage.includes(pattern.toLowerCase())
    );
  }, []);

  /**
   * Clear all application caches
   */
  const clearAllCaches = useCallback(() => {
    queryClient.clear();
    try {
      sessionStorage.removeItem(MFA_STATUS_CACHE_KEY);
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
  }, []);

  const handleSessionExpired = useCallback(async (reason: string = 'session_expired') => {
    // Prevent multiple handlers
    if (hasHandledExpiry.current) return;
    hasHandledExpiry.current = true;

    console.info(`[SessionExpiry] Handling session expiry (reason: ${reason})`);

    // Clear all caches
    clearAllCaches();

    // Show toast notification
    toast({
      title: 'Session Expired',
      description: 'Your session has expired. Please sign in again.',
      variant: 'destructive',
      duration: 5000,
    });

    // Call custom handler if provided
    onSessionExpired?.();

    // Sign out to clean up state - use local scope to avoid network call
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('[SessionExpiry] Error signing out:', error);
    }

    // Redirect to auth page
    navigate(redirectPath, { 
      replace: true,
      state: { from: window.location.pathname, reason }
    });

    // Reset flag after navigation
    setTimeout(() => {
      hasHandledExpiry.current = false;
      retryCountRef.current = 0;
    }, 2000);
  }, [navigate, onSessionExpired, redirectPath, clearAllCaches]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh failure
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('[SessionExpiry] Token refresh failed - no session returned');
        handleSessionExpired('token_refresh_failed');
        return;
      }
      
      // Handle signed out event - check if it was due to an error
      if (event === 'SIGNED_OUT') {
        // Reset retry counter on explicit sign out
        retryCountRef.current = 0;
      }
    });

    // Set up error listener for refresh token errors
    const handleAuthError = (error: Error) => {
      if (isRefreshTokenError(error.message)) {
        console.warn('[SessionExpiry] Refresh token error detected:', error.message);
        
        // Check retry limit
        if (retryCountRef.current >= MAX_RETRIES) {
          console.warn('[SessionExpiry] Max retries reached, expiring session');
          handleSessionExpired('refresh_token_invalid');
          return;
        }
        
        retryCountRef.current++;
        console.info(`[SessionExpiry] Retry ${retryCountRef.current}/${MAX_RETRIES}`);
      }
    };

    // Monitor for auth errors in console (backup mechanism)
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError.apply(console, args);
      
      // Check if any argument contains refresh token error
      const errorString = args.map(arg => 
        typeof arg === 'string' ? arg : arg?.message || JSON.stringify(arg)
      ).join(' ');
      
      if (isRefreshTokenError(errorString) && !hasHandledExpiry.current) {
        handleAuthError(new Error(errorString));
      }
    };

    return () => {
      subscription.unsubscribe();
      console.error = originalConsoleError;
    };
  }, [handleSessionExpired, isRefreshTokenError]);

  return { handleSessionExpired };
}

// Hook to check session validity on mount
export function useSessionCheck() {
  const { handleSessionExpired } = useSessionExpiry();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('[SessionCheck] Error getting session:', error.message);
          // Check if this is a refresh token error
          if (error.message.toLowerCase().includes('refresh') || 
              error.message.toLowerCase().includes('token')) {
            handleSessionExpired('session_check_failed');
          }
          return;
        }

        if (!session) {
          // No valid session - this is normal for logged out users
          return;
        }

        // Check if token is about to expire (within 5 minutes)
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresAtMs = expiresAt * 1000;
          const fiveMinutes = 5 * 60 * 1000;
          
          if (expiresAtMs - Date.now() < fiveMinutes) {
            console.info('[SessionCheck] Token expiring soon, attempting refresh');
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.warn('[SessionCheck] Refresh failed:', refreshError.message);
              handleSessionExpired('token_refresh_failed');
            }
          }
        }
      } catch (error) {
        console.error('[SessionCheck] Unexpected error:', error);
      }
    };

    checkSession();
  }, [handleSessionExpired]);
}

export default useSessionExpiry;
