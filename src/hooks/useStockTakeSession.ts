import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_TIMEOUT_MINUTES = 5;
const WARNING_RATIO = 0.2; // Show warning when 20% time remaining
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'click'];
const THROTTLE_MS = 1000; // Throttle activity updates

interface StockTakeSession {
  id: string;
  session_number: string;
  status: string;
  total_rolls_counted: number;
  last_activity_at: string;
}

interface UseStockTakeSessionOptions {
  userId: string | undefined;
  timeoutMinutes?: number;
  onSessionExpired?: () => void;
}

export const useStockTakeSession = ({ userId, timeoutMinutes = DEFAULT_TIMEOUT_MINUTES, onSessionExpired }: UseStockTakeSessionOptions) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // Memoize timeout values to prevent recalculation on every render
  const sessionTimeoutMs = useMemo(() => timeoutMinutes * 60 * 1000, [timeoutMinutes]);
  const warningBeforeMs = useMemo(() => Math.max(sessionTimeoutMs * WARNING_RATIO, 30 * 1000), [sessionTimeoutMs]);
  
  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastThrottleRef = useRef<number>(0);
  const warningShownRef = useRef<boolean>(false);
  const timersActiveRef = useRef<boolean>(false); // Track if timers are already running
  const sessionIdRef = useRef<string | null>(null); // Track session ID for timer callbacks

  // Keep session ID ref in sync
  useEffect(() => {
    sessionIdRef.current = session?.id || null;
  }, [session?.id]);

  // Clear all timers
  const clearTimers = useCallback(() => {
    console.log('[Session] Clearing timers');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    timersActiveRef.current = false;
  }, []);

  // Update session activity in database
  const updateSessionActivity = useCallback(async () => {
    if (!sessionIdRef.current) return;
    
    console.log('[Session] Updating activity in DB for session:', sessionIdRef.current);
    try {
      await supabase
        .from('count_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    } catch (error) {
      console.error('[useStockTakeSession] Failed to update activity:', error);
    }
  }, []);

  // Reset timers on activity - use refs to avoid stale closure issues
  const resetTimers = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.log('[Session] No session to reset timers for');
      return;
    }

    console.log('[Session] Resetting timers for session:', currentSessionId, 'timeout:', sessionTimeoutMs, 'ms');
    
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }
    
    warningShownRef.current = false;
    setIsExpiring(false);
    timersActiveRef.current = true;

    // Set warning timer
    const warningDelay = sessionTimeoutMs - warningBeforeMs;
    console.log('[Session] Warning timer set for', warningDelay, 'ms');
    warningRef.current = setTimeout(() => {
      if (sessionIdRef.current && !warningShownRef.current) {
        console.log('[Session] WARNING: Session expiring soon!');
        warningShownRef.current = true;
        setIsExpiring(true);
        toast({
          title: String(t('stocktake.sessionExpiringSoon')),
          description: String(t('stocktake.sessionExpiringDesc')).replace('{minutes}', '1'),
          variant: 'destructive',
          duration: 30000,
        });
      }
    }, warningDelay);

    // Set expiry timer - ACTUALLY EXPIRE the session
    console.log('[Session] Expiry timer set for', sessionTimeoutMs, 'ms');
    timeoutRef.current = setTimeout(async () => {
      const expiredSessionId = sessionIdRef.current;
      if (expiredSessionId) {
        console.log('[Session] EXPIRED: Session', expiredSessionId, 'has timed out after', sessionTimeoutMs, 'ms');
        
        // Actually expire the session in database
        try {
          await supabase
            .from('count_sessions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancellation_reason: 'Session expired due to inactivity',
              notes: 'Auto-expired after ' + timeoutMinutes + ' minutes of inactivity',
            })
            .eq('id', expiredSessionId);
          
          console.log('[Session] Session marked as cancelled in database');
        } catch (error) {
          console.error('[useStockTakeSession] Failed to expire session:', error);
        }

        // Clear local session state
        setSession(null);
        timersActiveRef.current = false;

        toast({
          title: String(t('stocktake.sessionExpired')),
          description: String(t('stocktake.sessionExpiredDesc')),
          variant: 'destructive',
        });

        onSessionExpired?.();
      }
    }, sessionTimeoutMs);
  }, [sessionTimeoutMs, warningBeforeMs, timeoutMinutes, toast, t, onSessionExpired]);

  // Handle activity - only reset if actually active
  const handleActivity = useCallback(() => {
    const now = Date.now();
    
    // Throttle activity updates
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    
    if (!sessionIdRef.current) return;
    
    console.log('[Session] Activity detected, resetting timers');
    lastThrottleRef.current = now;

    updateSessionActivity();
    resetTimers();
  }, [updateSessionActivity, resetTimers]);

  // Keep session active (manual trigger)
  const keepSessionActive = useCallback(() => {
    console.log('[Session] Manual keep-alive triggered');
    handleActivity();
    setIsExpiring(false);
    warningShownRef.current = false;
  }, [handleActivity]);

  // Load or create session
  const loadOrCreateSession = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Check for existing active session
      const { data: existingSession, error: fetchError } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('started_by', userId)
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingSession && !fetchError) {
        // Resume existing session
        console.log('[Session] Resuming existing session:', existingSession.id);
        const resumedSession = existingSession as StockTakeSession;
        setSession(resumedSession);
        
        // Reactivate if draft
        if (existingSession.status === 'draft') {
          await supabase
            .from('count_sessions')
            .update({ 
              status: 'active',
              last_activity_at: new Date().toISOString(),
            })
            .eq('id', existingSession.id);
        } else {
          // Just update activity timestamp
          await supabase
            .from('count_sessions')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', existingSession.id);
        }
        
        return resumedSession;
      } else {
        // Create new session
        console.log('[Session] Creating new session');
        const { data: sessionNumber } = await supabase.rpc('generate_count_session_number');
        
        const { data: newSession, error: createError } = await supabase
          .from('count_sessions')
          .insert({
            session_number: sessionNumber,
            started_by: userId,
            status: 'active',
            last_activity_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        
        const createdSession = newSession as StockTakeSession;
        console.log('[Session] New session created:', createdSession.id);
        setSession(createdSession);
        
        toast({
          title: String(t('stocktake.sessionStarted')),
          description: `${String(t('stocktake.sessionNumber'))}: ${sessionNumber}`,
        });
        
        return createdSession;
      }
    } catch (error) {
      console.error('[useStockTakeSession] Error loading session:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.sessionLoadError')),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast, t]);

  // End session
  const endSession = useCallback(async () => {
    if (!session) return false;

    try {
      await supabase
        .from('count_sessions')
        .update({
          status: 'counting_complete',
          completed_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      clearTimers();
      setSession(null);
      
      return true;
    } catch (error) {
      console.error('[useStockTakeSession] End session error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.endSessionError')),
        variant: 'destructive',
      });
      return false;
    }
  }, [session, clearTimers, toast, t]);

  // Cancel session
  const cancelSession = useCallback(async () => {
    if (!session) return false;

    try {
      await supabase
        .from('count_sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'User cancelled',
        })
        .eq('id', session.id);

      clearTimers();
      setSession(null);
      
      toast({
        title: String(t('stocktake.sessionCancelled')),
      });
      
      return true;
    } catch (error) {
      console.error('[useStockTakeSession] Cancel error:', error);
      return false;
    }
  }, [session, clearTimers, toast, t]);

  // Check for existing session on mount (but don't auto-create)
  const [hasExistingSession, setHasExistingSession] = useState<boolean | null>(null);
  
  const checkExistingSession = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return null;
    }
    
    try {
      const { data: existingSession, error } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('started_by', userId)
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingSession && !error) {
        setHasExistingSession(true);
        return existingSession as StockTakeSession;
      } else {
        setHasExistingSession(false);
        return null;
      }
    } catch (error) {
      setHasExistingSession(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Only check for existing session on mount - don't auto-create
  useEffect(() => {
    if (userId) {
      checkExistingSession();
    } else {
      setIsLoading(false);
    }
  }, [userId]);

  // Set up activity listeners when session is active
  useEffect(() => {
    if (!session) {
      clearTimers();
      return;
    }

    console.log('[Session] Session active, setting up timers and listeners');
    
    // Initial timer setup - only if not already running
    if (!timersActiveRef.current) {
      resetTimers();
    }

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      console.log('[Session] Cleaning up listeners');
      clearTimers();
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [session?.id]); // Only depend on session.id, not the whole session object

  return {
    session,
    isLoading,
    isExpiring,
    hasExistingSession,
    startSession: loadOrCreateSession,
    endSession,
    cancelSession,
    keepSessionActive,
    updateSessionActivity,
  };
};
