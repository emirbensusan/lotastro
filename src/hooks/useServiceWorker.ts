import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    registration: null,
    updateAvailable: false,
  });

  // Register background sync
  const registerBackgroundSync = useCallback(async (tag: string = 'sync-pending-mutations') => {
    if (!state.registration) {
      console.warn('[useServiceWorker] No registration available');
      return false;
    }

    try {
      // @ts-ignore - Background Sync API may not be in TypeScript types
      if ('sync' in state.registration) {
        // @ts-ignore
        await state.registration.sync.register(tag);
        console.log('[useServiceWorker] Background sync registered:', tag);
        return true;
      } else {
        console.warn('[useServiceWorker] Background Sync not supported');
        return false;
      }
    } catch (err) {
      console.error('[useServiceWorker] Failed to register background sync:', err);
      return false;
    }
  }, [state.registration]);

  // Trigger immediate sync via message
  const triggerSync = useCallback(() => {
    if (state.registration?.active) {
      state.registration.active.postMessage({ type: 'TRIGGER_SYNC' });
      console.log('[useServiceWorker] Sync triggered');
    }
  }, [state.registration]);

  // Update service worker
  const applyUpdate = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  // Clear all caches
  const clearCache = useCallback(() => {
    if (state.registration?.active) {
      state.registration.active.postMessage({ type: 'CLEAR_CACHE' });
      toast.success('Cache cleared');
    }
  }, [state.registration]);

  // Listen for messages from service worker
  useEffect(() => {
    if (!state.isSupported) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, timestamp } = event.data || {};
      
      switch (type) {
        case 'SYNC_COMPLETE':
          console.log('[useServiceWorker] Sync completed at:', new Date(timestamp));
          toast.success('Background sync completed');
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [state.isSupported]);

  // Register service worker on mount
  useEffect(() => {
    if (!state.isSupported) return;

    const registerSW = async () => {
      try {
        // The VitePWA plugin handles registration, but we can get the registration
        const registration = await navigator.serviceWorker.ready;
        
        setState(prev => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setState(prev => ({ ...prev, updateAvailable: true }));
                toast.info('App update available', {
                  action: {
                    label: 'Update',
                    onClick: () => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    },
                  },
                });
              }
            });
          }
        });

        console.log('[useServiceWorker] Service worker ready');
      } catch (err) {
        console.error('[useServiceWorker] Registration failed:', err);
      }
    };

    registerSW();
  }, [state.isSupported]);

  // Handle controller change (after skip waiting)
  useEffect(() => {
    if (!state.isSupported) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [state.isSupported]);

  return {
    ...state,
    registerBackgroundSync,
    triggerSync,
    applyUpdate,
    clearCache,
  };
}

export default useServiceWorker;
