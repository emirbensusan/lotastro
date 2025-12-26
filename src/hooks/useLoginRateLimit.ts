import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitState {
  isLocked: boolean;
  failedAttempts: number;
  secondsRemaining: number;
  lockoutUntil: Date | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const useLoginRateLimit = () => {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isLocked: false,
    failedAttempts: 0,
    secondsRemaining: 0,
    lockoutUntil: null,
  });

  const checkRateLimit = useCallback(async (email: string): Promise<RateLimitState> => {
    try {
      const { data, error } = await supabase.rpc('check_login_rate_limit', {
        p_email: email,
        p_max_attempts: MAX_ATTEMPTS,
        p_lockout_minutes: LOCKOUT_MINUTES,
      });

      if (error) {
        console.error('Rate limit check error:', error);
        // On error, allow login attempt (fail open for availability)
        return { isLocked: false, failedAttempts: 0, secondsRemaining: 0, lockoutUntil: null };
      }

      const result = data?.[0] as { 
        is_locked: boolean; 
        failed_attempts: number; 
        seconds_remaining: number; 
        lockout_until: string | null; 
      } | undefined;
      
      const state: RateLimitState = {
        isLocked: result?.is_locked ?? false,
        failedAttempts: result?.failed_attempts ?? 0,
        secondsRemaining: result?.seconds_remaining ?? 0,
        lockoutUntil: result?.lockout_until ? new Date(result.lockout_until) : null,
      };

      setRateLimitState(state);
      return state;
    } catch (err) {
      console.error('Rate limit check failed:', err);
      return { isLocked: false, failedAttempts: 0, secondsRemaining: 0, lockoutUntil: null };
    }
  }, []);

  const recordAttempt = useCallback(async (email: string, success: boolean) => {
    try {
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: success,
      });

      // Update state after recording
      if (!success) {
        await checkRateLimit(email);
      } else {
        // Reset state on successful login
        setRateLimitState({
          isLocked: false,
          failedAttempts: 0,
          secondsRemaining: 0,
          lockoutUntil: null,
        });
      }
    } catch (err) {
      console.error('Failed to record login attempt:', err);
    }
  }, [checkRateLimit]);

  const formatTimeRemaining = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }, []);

  return {
    rateLimitState,
    checkRateLimit,
    recordAttempt,
    formatTimeRemaining,
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_MINUTES,
  };
};
