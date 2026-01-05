import { useEffect } from 'react';

/**
 * Hook to ensure body scroll is restored when a dialog/sheet unmounts.
 * This prevents "ghost scroll-lock" issues when Radix dialogs don't clean up properly.
 */
export function useDialogCleanup(isOpen: boolean) {
  useEffect(() => {
    // Only run cleanup on unmount when dialog was open
    if (!isOpen) return;

    return () => {
      // Cleanup on unmount: restore body scroll
      // Small delay to let Radix's own cleanup run first
      setTimeout(() => {
        // Check if any other dialogs are open
        const openDialogs = document.querySelectorAll(
          '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content]'
        );
        
        // Only restore scroll if no other dialogs are open
        if (openDialogs.length === 0) {
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
          document.body.style.pointerEvents = '';
          
          // Also clean up any Radix-specific attributes
          document.body.removeAttribute('data-scroll-locked');
        }
      }, 50);
    };
  }, [isOpen]);
}

/**
 * Global cleanup function to force-remove scroll locks.
 * Can be called manually if scroll gets stuck.
 */
export function forceCleanupScrollLock() {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.pointerEvents = '';
  document.body.removeAttribute('data-scroll-locked');
  
  // Remove any stale closed overlays from DOM
  const closedOverlays = document.querySelectorAll(
    '[data-state="closed"][data-radix-dialog-overlay], [data-state="closed"][data-radix-alert-dialog-overlay]'
  );
  closedOverlays.forEach(el => el.remove());
}
