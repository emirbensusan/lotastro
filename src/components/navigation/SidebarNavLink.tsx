import React, { useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface PointerState {
  pointerId: number;
  button: number;
  startX: number;
  startY: number;
  targetPath: string;
  timestamp: number;
}

interface SidebarNavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onNavigate?: () => void; // Called after navigation (e.g., to close mobile sidebar)
}

// Movement threshold in pixels - if pointer moves more than this, don't navigate
const MOVEMENT_THRESHOLD = 10;
// Time window to suppress duplicate navigation from click after pointerup fallback
const DOUBLE_NAV_WINDOW_MS = 600;

/**
 * Phase 5: Resilient sidebar navigation link
 * 
 * Uses pointerdown/pointerup fallback when browser fails to generate click events.
 * Preserves native behaviors: right-click menu, Ctrl/Cmd+click new tab, middle-click.
 */
export const SidebarNavLink: React.FC<SidebarNavLinkProps> = ({
  to,
  children,
  className,
  title,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pointerStateRef = useRef<PointerState | null>(null);
  const fallbackNavigatedRef = useRef<{ path: string; ts: number } | null>(null);

  // Dev-only logging
  const logNav = useCallback((event: string, data?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.log(`[NAV-LINK] ${event}`, { timestamp: Date.now(), ...data });
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only track left button (0) or touch
    if (e.button !== 0) return;
    
    pointerStateRef.current = {
      pointerId: e.pointerId,
      button: e.button,
      startX: e.clientX,
      startY: e.clientY,
      targetPath: to,
      timestamp: performance.now(),
    };
  }, [to]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state) return;
    
    // Clear state
    pointerStateRef.current = null;
    
    // Check if this is a valid navigation scenario
    // Skip if: not left button, has modifier keys, different pointerId
    if (
      e.button !== 0 ||
      e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
      e.pointerId !== state.pointerId
    ) {
      return;
    }
    
    // Check movement threshold
    const dx = Math.abs(e.clientX - state.startX);
    const dy = Math.abs(e.clientY - state.startY);
    if (dx > MOVEMENT_THRESHOLD || dy > MOVEMENT_THRESHOLD) {
      logNav('PointerUp skipped (movement)', { dx, dy });
      return;
    }
    
    // Don't navigate if already on this route
    if (location.pathname === to) {
      logNav('PointerUp skipped (same route)', { path: to });
      return;
    }
    
    // Perform fallback navigation
    logNav('PointerUp fallback navigate', { 
      path: to, 
      currentPath: location.pathname,
      delta: performance.now() - state.timestamp 
    });
    
    fallbackNavigatedRef.current = { path: to, ts: Date.now() };
    navigate(to);
    onNavigate?.();
  }, [to, location.pathname, navigate, onNavigate, logNav]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Allow native behavior for modifier clicks (new tab, etc.)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
      logNav('Click with modifier (native)', { path: to });
      return;
    }
    
    // Check if pointerUp already navigated recently - suppress double navigation
    const fallback = fallbackNavigatedRef.current;
    if (fallback && fallback.path === to && Date.now() - fallback.ts < DOUBLE_NAV_WINDOW_MS) {
      logNav('Click suppressed (pointerUp already navigated)', { path: to });
      e.preventDefault();
      return;
    }
    
    // Normal click - let Link handle it, but log and call onNavigate
    logNav('Click navigate', { path: to, currentPath: location.pathname });
    
    // Don't navigate if already on this route
    if (location.pathname === to) {
      e.preventDefault();
      return;
    }
    
    // Let the Link handle navigation, just call the callback
    onNavigate?.();
  }, [to, location.pathname, onNavigate, logNav]);

  return (
    <Link
      to={to}
      className={className}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
};

export default SidebarNavLink;
