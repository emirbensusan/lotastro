import React, { useState, useEffect, useCallback, useRef } from 'react';
import { forceCleanupScrollLock } from '@/hooks/useDialogCleanup';

interface BlockerInfo {
  tagName: string;
  className: string;
  id: string;
  zIndex: number;
  rect: { top: number; left: number; width: number; height: number };
  pointerEvents: string;
  dataState?: string;
  dataOwner?: string;
  isStalePortal?: boolean;
  timestamp: number;
}

interface TelemetryEvent {
  type: 'blocker_detected' | 'blocker_cleared' | 'blocked_click' | 'stale_portal_cleaned' | 'scroll_lock_cleaned';
  blocker?: BlockerInfo;
  clickTarget?: string;
  timestamp: number;
  url: string;
  details?: string;
}

interface OverlayHealthStatus {
  hasBlockers: boolean;
  hasStalePortals: boolean;
  hasScrollLock: boolean;
  openDialogCount: number;
  stalePortalCount: number;
}

// Telemetry storage key
const TELEMETRY_KEY = 'overlay_detector_telemetry';
const MAX_EVENTS = 50;

/**
 * Production-ready component that detects invisible overlays blocking the sidebar region.
 * In dev mode: Shows visual badge with diagnostics
 * In production: Silently logs telemetry to localStorage for debugging
 */
export const OverlayDetector: React.FC = () => {
  const [blocker, setBlocker] = useState<BlockerInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<OverlayHealthStatus>({
    hasBlockers: false,
    hasStalePortals: false,
    hasScrollLock: false,
    openDialogCount: 0,
    stalePortalCount: 0,
  });
  const [lastCheck, setLastCheck] = useState<number>(Date.now());
  const previousBlockerRef = useRef<BlockerInfo | null>(null);
  const [autoCleanupEnabled] = useState(true);

  // Log telemetry event (works in both dev and prod)
  const logTelemetry = useCallback((event: TelemetryEvent) => {
    try {
      const stored = localStorage.getItem(TELEMETRY_KEY);
      const events: TelemetryEvent[] = stored ? JSON.parse(stored) : [];
      events.push(event);
      // Keep only last MAX_EVENTS
      const trimmed = events.slice(-MAX_EVENTS);
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(trimmed));
      
      // Also log to console in dev mode
      if (import.meta.env.DEV) {
        if (event.type === 'blocker_detected') {
          console.warn('[OVERLAY-TELEMETRY] Blocker detected:', event.blocker);
        } else if (event.type === 'blocked_click') {
          console.error('[OVERLAY-TELEMETRY] Click blocked!', event);
        } else if (event.type === 'stale_portal_cleaned') {
          console.info('[OVERLAY-TELEMETRY] Stale portal cleaned:', event.details);
        } else if (event.type === 'scroll_lock_cleaned') {
          console.info('[OVERLAY-TELEMETRY] Scroll lock cleaned');
        }
      }
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, []);

  // Detect and optionally clean stale portals
  const checkStalePortals = useCallback(() => {
    const stalePortals: Element[] = [];
    
    // Find closed overlays that are still in DOM
    const closedOverlays = document.querySelectorAll(
      '[data-state="closed"][data-radix-dialog-overlay], ' +
      '[data-state="closed"][data-radix-alert-dialog-overlay], ' +
      '[data-radix-portal] [data-state="closed"]'
    );
    
    closedOverlays.forEach(el => {
      // Check if it has pointer-events auto (shouldn't for closed)
      const style = getComputedStyle(el);
      if (style.pointerEvents !== 'none' || style.visibility !== 'hidden') {
        stalePortals.push(el);
      }
    });

    return stalePortals;
  }, []);

  // Check for scroll lock issues
  const checkScrollLock = useCallback(() => {
    const bodyStyle = document.body.style;
    const hasScrollLocked = document.body.hasAttribute('data-scroll-locked');
    const hasOverflowHidden = bodyStyle.overflow === 'hidden';
    
    // Count actually open dialogs
    const openDialogs = document.querySelectorAll(
      '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content]'
    );
    
    // Scroll lock without open dialogs is suspicious
    const isOrphanedLock = (hasScrollLocked || hasOverflowHidden) && openDialogs.length === 0;
    
    return { isOrphanedLock, openDialogCount: openDialogs.length };
  }, []);

  // Perform cleanup of stale states
  const performCleanup = useCallback(() => {
    let cleaned = false;
    
    // Clean stale portals
    const stalePortals = checkStalePortals();
    stalePortals.forEach(el => {
      const owner = el.getAttribute('data-owner') || 'unknown';
      el.remove();
      logTelemetry({
        type: 'stale_portal_cleaned',
        timestamp: Date.now(),
        url: window.location.pathname,
        details: `Removed stale portal: ${owner}`,
      });
      cleaned = true;
    });

    // Clean orphaned scroll lock
    const { isOrphanedLock } = checkScrollLock();
    if (isOrphanedLock) {
      forceCleanupScrollLock();
      logTelemetry({
        type: 'scroll_lock_cleaned',
        timestamp: Date.now(),
        url: window.location.pathname,
      });
      cleaned = true;
    }

    return cleaned;
  }, [checkStalePortals, checkScrollLock, logTelemetry]);

  const checkForBlockers = useCallback(() => {
    // Define sidebar region (left 280px, full height)
    const sidebarRect = { 
      left: 0, 
      right: 280, 
      top: 0, 
      bottom: window.innerHeight 
    };

    // Find all fixed/absolute positioned elements
    const allElements = document.querySelectorAll('*');
    const potentialBlockers: BlockerInfo[] = [];

    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = getComputedStyle(htmlEl);
      const position = style.position;
      
      // Only check fixed/absolute positioned elements
      if (position !== 'fixed' && position !== 'absolute') return;
      
      const rect = htmlEl.getBoundingClientRect();
      const zIndex = parseInt(style.zIndex) || 0;
      const pointerEvents = style.pointerEvents;
      
      // Skip elements that don't block pointer events
      if (pointerEvents === 'none') return;
      
      // Skip tiny elements
      if (rect.width < 10 || rect.height < 10) return;
      
      // Skip elements that don't overlap sidebar
      const overlaps = !(
        rect.right < sidebarRect.left ||
        rect.left > sidebarRect.right ||
        rect.bottom < sidebarRect.top ||
        rect.top > sidebarRect.bottom
      );
      
      if (!overlaps) return;
      
      // Skip the sidebar itself and known safe elements
      const className = htmlEl.className || '';
      const isSidebar = className.includes('sidebar') || 
                        htmlEl.getAttribute('data-sidebar') !== null ||
                        htmlEl.closest('[data-sidebar]') !== null;
      if (isSidebar) return;
      
      // Skip header (z-index 50 is expected for sticky header)
      const isHeader = htmlEl.tagName === 'HEADER' || htmlEl.closest('header') !== null;
      if (isHeader && zIndex <= 50) return;
      
      // Skip elements that are children of the main layout
      const isLayoutChild = htmlEl.closest('[data-sidebar-container]') !== null;
      if (isLayoutChild) return;

      // Check if this is a stale (closed but not removed) portal
      const dataState = htmlEl.getAttribute('data-state');
      const isStalePortal = dataState === 'closed';
      
      // This element might be blocking
      if (zIndex >= 40) {
        potentialBlockers.push({
          tagName: htmlEl.tagName,
          className: className.toString().slice(0, 100),
          id: htmlEl.id || '',
          zIndex,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          pointerEvents,
          dataState: dataState || undefined,
          dataOwner: htmlEl.getAttribute('data-owner') || undefined,
          isStalePortal,
          timestamp: Date.now(),
        });
      }
    });

    // Sort by z-index descending, take highest
    potentialBlockers.sort((a, b) => b.zIndex - a.zIndex);
    
    const topBlocker = potentialBlockers[0] || null;
    
    // Update health status
    const stalePortals = checkStalePortals();
    const { isOrphanedLock, openDialogCount } = checkScrollLock();
    
    setHealthStatus({
      hasBlockers: !!topBlocker,
      hasStalePortals: stalePortals.length > 0,
      hasScrollLock: isOrphanedLock,
      openDialogCount,
      stalePortalCount: stalePortals.length,
    });

    // Auto-cleanup if enabled and issues detected
    if (autoCleanupEnabled && (stalePortals.length > 0 || isOrphanedLock)) {
      performCleanup();
    }
    
    // Log telemetry on state changes
    if (topBlocker && !previousBlockerRef.current) {
      logTelemetry({
        type: 'blocker_detected',
        blocker: topBlocker,
        timestamp: Date.now(),
        url: window.location.pathname,
      });
    } else if (!topBlocker && previousBlockerRef.current) {
      logTelemetry({
        type: 'blocker_cleared',
        blocker: previousBlockerRef.current,
        timestamp: Date.now(),
        url: window.location.pathname,
      });
    }
    
    previousBlockerRef.current = topBlocker;
    setBlocker(topBlocker);
    setLastCheck(Date.now());
  }, [logTelemetry, checkStalePortals, checkScrollLock, autoCleanupEnabled, performCleanup]);

  // Detect blocked clicks in sidebar region
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Only check clicks in sidebar region (left 280px)
      if (e.clientX > 280) return;
      
      // If there's a known blocker and click didn't reach a sidebar element
      const target = e.target as HTMLElement;
      const clickedSidebar = target.closest('[data-sidebar]') !== null;
      
      if (blocker && !clickedSidebar) {
        logTelemetry({
          type: 'blocked_click',
          blocker,
          clickTarget: `${target.tagName}.${target.className}`,
          timestamp: Date.now(),
          url: window.location.pathname,
        });
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [blocker, logTelemetry]);

  // Phase 6: On-demand checking instead of interval
  // Run initial check on mount and when route changes
  useEffect(() => {
    checkForBlockers();
  }, [checkForBlockers]);
  
  // Expose function to trigger check on demand (e.g., after fallback navigation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).triggerOverlayCheck = checkForBlockers;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).triggerOverlayCheck;
      }
    };
  }, [checkForBlockers]);

  // Suppress lastCheck warning - it's used for debugging
  void lastCheck;

  // Only show visual UI in development
  if (!import.meta.env.DEV) return null;

  const hasIssues = blocker || healthStatus.hasStalePortals || healthStatus.hasScrollLock;

  return (
    <div 
      className="fixed bottom-4 left-4 z-[9999] pointer-events-none"
      style={{ fontFamily: 'monospace', fontSize: '11px' }}
    >
      {hasIssues ? (
        <div className="bg-destructive text-destructive-foreground px-3 py-2 rounded-md shadow-lg pointer-events-auto max-w-xs space-y-2">
          {blocker && (
            <>
              <div className="font-bold">⚠️ SIDEBAR BLOCKED</div>
              <div className="space-y-0.5 text-[10px]">
                {blocker.dataOwner && (
                  <div className="font-bold text-yellow-300">Owner: {blocker.dataOwner}</div>
                )}
                <div>Tag: {blocker.tagName}</div>
                <div>z-index: {blocker.zIndex}</div>
                {blocker.id && <div>id: {blocker.id}</div>}
                <div className="truncate">class: {blocker.className.slice(0, 50)}...</div>
                {blocker.dataState && <div>data-state: {blocker.dataState}</div>}
                {blocker.isStalePortal && (
                  <div className="text-yellow-300 font-bold">⚡ STALE PORTAL</div>
                )}
              </div>
            </>
          )}
          
          {(healthStatus.hasStalePortals || healthStatus.hasScrollLock) && (
            <div className="border-t border-white/20 pt-2 text-[10px]">
              {healthStatus.hasStalePortals && (
                <div>🗑️ Stale portals: {healthStatus.stalePortalCount}</div>
              )}
              {healthStatus.hasScrollLock && (
                <div>🔒 Orphaned scroll lock</div>
              )}
              <div>📊 Open dialogs: {healthStatus.openDialogCount}</div>
            </div>
          )}
          
          <button
            onClick={performCleanup}
            className="w-full mt-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[10px]"
          >
            🧹 Force Cleanup
          </button>
        </div>
      ) : (
        <div className="bg-green-600 text-white px-2 py-1 rounded text-[10px] opacity-50">
          ✓ No blockers
        </div>
      )}
    </div>
  );
};

// Helper to retrieve telemetry logs (call from console: window.getOverlayTelemetry())
if (typeof window !== 'undefined') {
  (window as any).getOverlayTelemetry = () => {
    try {
      const stored = localStorage.getItem(TELEMETRY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };
  (window as any).clearOverlayTelemetry = () => {
    localStorage.removeItem(TELEMETRY_KEY);
    console.log('[OVERLAY-TELEMETRY] Cleared');
  };
  (window as any).forceOverlayCleanup = forceCleanupScrollLock;
}

export default OverlayDetector;
