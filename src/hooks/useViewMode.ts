import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export type ViewMode = 'table' | 'cards';

interface UseViewModeOptions {
  /** Storage key for persisting preference */
  storageKey: string;
  /** Default view mode on desktop */
  defaultDesktop?: ViewMode;
  /** Default view mode on mobile */
  defaultMobile?: ViewMode;
}

export function useViewMode(options: UseViewModeOptions) {
  const { 
    storageKey, 
    defaultDesktop = 'table', 
    defaultMobile = 'cards' 
  } = options;
  
  const isMobile = useIsMobile();
  
  // Initialize from localStorage or use device-appropriate default
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'table' || stored === 'cards') {
      return stored;
    }
    // No stored preference - use device default
    return typeof window !== 'undefined' && window.innerWidth < 768 
      ? defaultMobile 
      : defaultDesktop;
  });

  // Update when mobile state changes if no explicit preference is stored
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      // No explicit preference, auto-switch based on device
      setViewModeState(isMobile ? defaultMobile : defaultDesktop);
    }
  }, [isMobile, defaultMobile, defaultDesktop, storageKey]);

  // Set view mode and persist to localStorage
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(storageKey, mode);
  }, [storageKey]);

  // Toggle between table and cards
  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === 'table' ? 'cards' : 'table');
  }, [viewMode, setViewMode]);

  // Clear preference (revert to device default)
  const clearPreference = useCallback(() => {
    localStorage.removeItem(storageKey);
    setViewModeState(isMobile ? defaultMobile : defaultDesktop);
  }, [storageKey, isMobile, defaultMobile, defaultDesktop]);

  return {
    viewMode,
    setViewMode,
    toggleViewMode,
    clearPreference,
    isMobile,
    /** Whether current mode matches device default */
    isUsingDefault: viewMode === (isMobile ? defaultMobile : defaultDesktop)
  };
}
