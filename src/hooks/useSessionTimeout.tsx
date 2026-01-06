import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// Default values (used if database fetch fails)
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before timeout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
const THROTTLE_MS = 1000; // Throttle activity updates to 1 second

interface SessionSettings {
  session_timeout_minutes: number;
  warning_before_minutes: number;
  enforce_session_timeout: boolean;
}

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
  const { t } = useLanguage();
  
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    session_timeout_minutes: 30,
    warning_before_minutes: 5,
    enforce_session_timeout: true
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Fetch session settings from database
  useEffect(() => {
    const fetchSessionSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings' as any)
          .select('setting_key, setting_value')
          .in('setting_key', ['session_timeout_minutes', 'warning_before_minutes', 'enforce_session_timeout']);

        if (error) {
          console.warn('Failed to fetch session settings, using defaults:', error);
          setSettingsLoaded(true);
          return;
        }

        if (data && data.length > 0) {
          const settings: Partial<SessionSettings> = {};
          (data as any[]).forEach((row: { setting_key: string; setting_value: any }) => {
            if (row.setting_key === 'session_timeout_minutes') {
              settings.session_timeout_minutes = Number(row.setting_value);
            } else if (row.setting_key === 'warning_before_minutes') {
              settings.warning_before_minutes = Number(row.setting_value);
            } else if (row.setting_key === 'enforce_session_timeout') {
              settings.enforce_session_timeout = Boolean(row.setting_value);
            }
          });
          
          setSessionSettings(prev => ({ ...prev, ...settings }));
        }
        setSettingsLoaded(true);
      } catch (err) {
        console.warn('Error fetching session settings:', err);
        setSettingsLoaded(true);
      }
    };

    fetchSessionSettings();
  }, []);

  const sessionTimeoutMs = sessionSettings.session_timeout_minutes * 60 * 1000;
  const warningBeforeMs = sessionSettings.warning_before_minutes * 60 * 1000;

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
    if (!isAuthenticated || !settingsLoaded || !sessionSettings.enforce_session_timeout) return;

    clearTimers();
    warningShownRef.current = false;
    lastActivityRef.current = Date.now();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      if (isAuthenticated && !warningShownRef.current) {
        warningShownRef.current = true;
        toast({
          title: String(t('session.expiringSoon')),
          description: String(t('session.expiringDesc', { minutes: sessionSettings.warning_before_minutes })),
          variant: "destructive",
          duration: 30000, // Show for 30 seconds
        });
      }
    }, sessionTimeoutMs - warningBeforeMs);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      if (isAuthenticated) {
        toast({
          title: String(t('session.expired')),
          description: String(t('session.expiredDesc')),
          variant: "destructive",
        });
        onTimeout();
      }
    }, sessionTimeoutMs);
  }, [isAuthenticated, onTimeout, clearTimers, sessionTimeoutMs, warningBeforeMs, settingsLoaded, sessionSettings, t]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    
    // Throttle activity updates
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;

    // Reset timers on activity
    if (isAuthenticated && settingsLoaded && sessionSettings.enforce_session_timeout) {
      resetTimers();
    }
  }, [isAuthenticated, resetTimers, settingsLoaded, sessionSettings.enforce_session_timeout]);

  useEffect(() => {
    if (!isAuthenticated || !settingsLoaded) {
      clearTimers();
      return;
    }

    // Don't set up timers if session timeout is disabled
    if (!sessionSettings.enforce_session_timeout) {
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
  }, [isAuthenticated, handleActivity, resetTimers, clearTimers, settingsLoaded, sessionSettings.enforce_session_timeout]);

  return {
    resetActivity: handleActivity,
    lastActivity: lastActivityRef.current,
    sessionSettings,
    settingsLoaded,
  };
};
