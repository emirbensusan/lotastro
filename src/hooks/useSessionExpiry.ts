import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

  const handleSessionExpired = useCallback(async () => {
    // Prevent multiple handlers
    if (hasHandledExpiry.current) return;
    hasHandledExpiry.current = true;

    // Show toast notification
    toast({
      title: 'Session Expired',
      description: 'Your session has expired. Please sign in again.',
      variant: 'destructive',
      duration: 5000,
    });

    // Call custom handler if provided
    onSessionExpired?.();

    // Sign out to clean up state
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }

    // Redirect to auth page
    navigate(redirectPath, { 
      replace: true,
      state: { from: window.location.pathname, reason: 'session_expired' }
    });

    // Reset flag after navigation
    setTimeout(() => {
      hasHandledExpiry.current = false;
    }, 1000);
  }, [navigate, onSessionExpired, redirectPath]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Token refresh failed - session expired
        handleSessionExpired();
      }
      
      if (event === 'SIGNED_OUT') {
        // Check if this was due to session expiry (not manual logout)
        const wasExpired = !session && hasHandledExpiry.current === false;
        if (wasExpired) {
          // This might be an expired session, show appropriate message
          // Note: Manual logouts should set a flag before calling signOut
        }
      }
    });

    // Intercept fetch errors for 401s
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Check for auth errors from Supabase
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : '';
        
        // Only handle Supabase API calls
        if (url.includes('supabase.co')) {
          try {
            const clonedResponse = response.clone();
            const body = await clonedResponse.json();
            
            // Check for JWT/session expiry errors
            if (
              body?.message?.toLowerCase().includes('jwt') ||
              body?.message?.toLowerCase().includes('expired') ||
              body?.message?.toLowerCase().includes('invalid token') ||
              body?.code === 'PGRST301'
            ) {
              handleSessionExpired();
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
      
      return response;
    };

    return () => {
      subscription.unsubscribe();
      window.fetch = originalFetch;
    };
  }, [handleSessionExpired]);

  return { handleSessionExpired };
}

// Hook to check session validity on mount
export function useSessionCheck() {
  const { handleSessionExpired } = useSessionExpiry();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // No valid session
        return;
      }

      // Check if token is about to expire (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresAtMs = expiresAt * 1000;
        const fiveMinutes = 5 * 60 * 1000;
        
        if (expiresAtMs - Date.now() < fiveMinutes) {
          // Try to refresh
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            handleSessionExpired();
          }
        }
      }
    };

    checkSession();
  }, [handleSessionExpired]);
}

export default useSessionExpiry;
