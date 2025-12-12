import { useEffect, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before timeout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
const THROTTLE_MS = 1000; // Throttle activity updates to 1 second

interface UseSessionTimeoutOptions {
  onTimeout: () => void;
  isAuthenticated: boolean;
}

export const useSessionTimeout = ({ onTimeout, isAuthenticated }: UseSessionTimeoutOptions) => {
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef<boolean>(false);
  const lastThrottleRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return;

    clearTimers();
    warningShownRef.current = false;
    lastActivityRef.current = Date.now();

    // Set warning timer (25 minutes)
    warningRef.current = setTimeout(() => {
      if (isAuthenticated && !warningShownRef.current) {
        warningShownRef.current = true;
        toast({
          title: "Session Expiring Soon",
          description: "Your session will expire in 5 minutes due to inactivity. Move your mouse or press a key to stay logged in.",
          variant: "destructive",
          duration: 30000, // Show for 30 seconds
        });
      }
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set logout timer (30 minutes)
    timeoutRef.current = setTimeout(() => {
      if (isAuthenticated) {
        toast({
          title: "Session Expired",
          description: "You have been logged out due to inactivity.",
          variant: "destructive",
        });
        onTimeout();
      }
    }, SESSION_TIMEOUT_MS);
  }, [isAuthenticated, onTimeout, clearTimers]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    
    // Throttle activity updates
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;

    // Reset timers on activity
    if (isAuthenticated) {
      resetTimers();
    }
  }, [isAuthenticated, resetTimers]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      return;
    }

    // Initial timer setup
    resetTimers();

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, handleActivity, resetTimers, clearTimers]);

  return {
    resetActivity: handleActivity,
    lastActivity: lastActivityRef.current,
  };
};
