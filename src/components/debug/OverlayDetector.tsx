import React, { useState, useEffect, useCallback } from 'react';

interface BlockerInfo {
  tagName: string;
  className: string;
  id: string;
  zIndex: number;
  rect: { top: number; left: number; width: number; height: number };
  pointerEvents: string;
  dataState?: string;
}

/**
 * Debug component that detects invisible overlays blocking the sidebar region.
 * Only renders in development mode.
 * 
 * Shows a red warning badge when a blocking element is detected.
 */
export const OverlayDetector: React.FC = () => {
  const [blocker, setBlocker] = useState<BlockerInfo | null>(null);
  const [lastCheck, setLastCheck] = useState<number>(Date.now());

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
      
      // This element might be blocking
      if (zIndex >= 40) {
        potentialBlockers.push({
          tagName: htmlEl.tagName,
          className: className.toString().slice(0, 100),
          id: htmlEl.id || '',
          zIndex,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          pointerEvents,
          dataState: htmlEl.getAttribute('data-state') || undefined,
        });
      }
    });

    // Sort by z-index descending, take highest
    potentialBlockers.sort((a, b) => b.zIndex - a.zIndex);
    
    const topBlocker = potentialBlockers[0] || null;
    setBlocker(topBlocker);
    setLastCheck(Date.now());
    
    if (topBlocker) {
      console.warn('[OVERLAY-DETECTOR] Found blocking element:', topBlocker);
    }
  }, []);

  // Run check every 500ms
  useEffect(() => {
    const interval = setInterval(checkForBlockers, 500);
    checkForBlockers(); // Initial check
    return () => clearInterval(interval);
  }, [checkForBlockers]);

  // Only show in development
  if (!import.meta.env.DEV) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 z-[9999] pointer-events-none"
      style={{ fontFamily: 'monospace', fontSize: '11px' }}
    >
      {blocker ? (
        <div className="bg-destructive text-destructive-foreground px-3 py-2 rounded-md shadow-lg pointer-events-auto max-w-xs">
          <div className="font-bold mb-1">⚠️ SIDEBAR BLOCKED</div>
          <div className="space-y-0.5 text-[10px]">
            <div>Tag: {blocker.tagName}</div>
            <div>z-index: {blocker.zIndex}</div>
            {blocker.id && <div>id: {blocker.id}</div>}
            <div className="truncate">class: {blocker.className.slice(0, 50)}...</div>
            {blocker.dataState && <div>data-state: {blocker.dataState}</div>}
            <div>pointer-events: {blocker.pointerEvents}</div>
          </div>
        </div>
      ) : (
        <div className="bg-green-600 text-white px-2 py-1 rounded text-[10px] opacity-50">
          ✓ No blockers
        </div>
      )}
    </div>
  );
};

export default OverlayDetector;
