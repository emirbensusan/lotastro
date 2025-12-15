import { useCallback } from 'react';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

// Vibration patterns in milliseconds
const HAPTIC_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 50, 20],
  error: [30, 50, 30, 50, 30],
};

export function useHapticFeedback() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const trigger = useCallback((style: HapticStyle = 'light') => {
    if (!isSupported) return false;

    try {
      const pattern = HAPTIC_PATTERNS[style];
      navigator.vibrate(pattern);
      return true;
    } catch {
      return false;
    }
  }, [isSupported]);

  const light = useCallback(() => trigger('light'), [trigger]);
  const medium = useCallback(() => trigger('medium'), [trigger]);
  const heavy = useCallback(() => trigger('heavy'), [trigger]);
  const success = useCallback(() => trigger('success'), [trigger]);
  const warning = useCallback(() => trigger('warning'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);

  // Selection feedback - very light tap
  const selection = useCallback(() => {
    if (!isSupported) return false;
    try {
      navigator.vibrate(5);
      return true;
    } catch {
      return false;
    }
  }, [isSupported]);

  // Impact feedback - for button presses
  const impact = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    return trigger(intensity);
  }, [trigger]);

  // Notification feedback - for alerts
  const notification = useCallback((type: 'success' | 'warning' | 'error' = 'success') => {
    return trigger(type);
  }, [trigger]);

  return {
    isSupported,
    trigger,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
    impact,
    notification,
  };
}
