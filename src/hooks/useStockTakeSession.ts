import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before timeout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
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
  onSessionExpired?: () => void;
}

export const useStockTakeSession = ({ userId, onSessionExpired }: UseStockTakeSessionOptions) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastThrottleRef = useRef<number>(0);
  const warningShownRef = useRef<boolean>(false);

  // Clear all timers
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

  // Update session activity in database
  const updateSessionActivity = useCallback(async () => {
    if (!session) return;
    
    try {
      await supabase
        .from('count_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', session.id);
    } catch (error) {
      console.error('[useStockTakeSession] Failed to update activity:', error);
    }
  }, [session]);

  // Reset timers on activity
  const resetTimers = useCallback(() => {
    if (!session) return;

    clearTimers();
    warningShownRef.current = false;
    setIsExpiring(false);

    // Set warning timer (25 minutes)
    warningRef.current = setTimeout(() => {
      if (session && !warningShownRef.current) {
        warningShownRef.current = true;
        setIsExpiring(true);
        toast({
          title: String(t('stocktake.sessionExpiringSoon')),
          description: String(t('stocktake.sessionExpiringDesc')).replace('{minutes}', '5'),
          variant: 'destructive',
          duration: 30000,
        });
      }
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set expiry timer (30 minutes)
    timeoutRef.current = setTimeout(async () => {
      if (session) {
        // Mark session with inactivity note (keep status active but update notes)
        try {
          await supabase
            .from('count_sessions')
            .update({
              notes: 'Session idle - last activity timeout reached',
            })
            .eq('id', session.id);
        } catch (error) {
          console.error('[useStockTakeSession] Failed to pause session:', error);
        }

        toast({
          title: String(t('stocktake.sessionExpired')),
          description: String(t('stocktake.sessionExpiredDesc')),
          variant: 'destructive',
        });

        onSessionExpired?.();
      }
    }, SESSION_TIMEOUT_MS);
  }, [session, clearTimers, toast, t, onSessionExpired]);

  // Handle activity
  const handleActivity = useCallback(() => {
    const now = Date.now();
    
    // Throttle activity updates
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;

    if (session) {
      updateSessionActivity();
      resetTimers();
    }
  }, [session, updateSessionActivity, resetTimers]);

  // Keep session active (manual trigger)
  const keepSessionActive = useCallback(() => {
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

  // Initialize session on mount
  useEffect(() => {
    if (userId) {
      loadOrCreateSession();
    }
  }, [userId]);

  // Set up activity listeners when session is active
  useEffect(() => {
    if (!session) {
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
  }, [session, handleActivity, resetTimers, clearTimers]);

  return {
    session,
    isLoading,
    isExpiring,
    loadOrCreateSession,
    endSession,
    cancelSession,
    keepSessionActive,
    updateSessionActivity,
  };
};
