import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HMRError {
  id: string;
  type: 'onerror' | 'unhandledrejection' | 'dynamic-import' | 'fetch-failure';
  message: string;
  source?: string;
  timestamp: number;
  timeSinceLastOnline: number | null;
  details?: Record<string, unknown>;
}

interface HMRTelemetry {
  errors: HMRError[];
  networkEvents: Array<{ type: 'online' | 'offline'; timestamp: number }>;
  lastOnlineTime: number | null;
  viteOverlayMinimized: boolean;
}

const TELEMETRY_KEY = 'hmr_health_telemetry';
const MAX_ERRORS = 30;
const MAX_NETWORK_EVENTS = 20;

/**
 * HMR Health Monitor - Detects and surfaces dynamic import / HMR failures
 * 
 * Features:
 * 1. Global error capture via window.onerror + unhandledrejection
 * 2. Detects dynamic import failures (message includes "import", "module", "MIME")
 * 3. Tracks network online/offline events to correlate with WS reconnects
 * 4. Shows small in-app banner when HMR error occurs (does NOT suppress Vite overlay)
 * 5. Optional toggle to minimize (not hide) Vite overlay
 * 6. Stores diagnostics in localStorage for analysis
 * 7. Exposes window.getHMRHealthTelemetry() for console debugging
 */
export const HMRHealthMonitor: React.FC = () => {
  const [errors, setErrors] = useState<HMRError[]>([]);
  const [showBanner, setShowBanner] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  const lastOnlineTimeRef = useRef<number | null>(Date.now());
  const setupDoneRef = useRef(false);

  // Load telemetry from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TELEMETRY_KEY);
      if (stored) {
        const telemetry: HMRTelemetry = JSON.parse(stored);
        setErrors(telemetry.errors || []);
        setOverlayMinimized(telemetry.viteOverlayMinimized || false);
        lastOnlineTimeRef.current = telemetry.lastOnlineTime;
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save telemetry to localStorage
  const saveTelemetry = useCallback((newErrors: HMRError[], minimized: boolean) => {
    try {
      const telemetry: HMRTelemetry = {
        errors: newErrors.slice(-MAX_ERRORS),
        networkEvents: [],
        lastOnlineTime: lastOnlineTimeRef.current,
        viteOverlayMinimized: minimized,
      };
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(telemetry));
    } catch {
      // Silently fail
    }
  }, []);

  // Log an HMR error
  const logError = useCallback((error: Omit<HMRError, 'id' | 'timestamp' | 'timeSinceLastOnline'>) => {
    const now = Date.now();
    const newError: HMRError = {
      ...error,
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      timeSinceLastOnline: lastOnlineTimeRef.current ? now - lastOnlineTimeRef.current : null,
    };

    setErrors(prev => {
      const updated = [...prev, newError].slice(-MAX_ERRORS);
      saveTelemetry(updated, overlayMinimized);
      return updated;
    });

    setShowBanner(true);

    // Log to console
    console.warn(`[HMR-HEALTH] ${error.type}:`, error.message, error.details || '');
  }, [overlayMinimized, saveTelemetry]);

  // Check if error message indicates HMR/dynamic import failure
  const isHMRError = useCallback((message: string, source?: string): boolean => {
    const lowerMsg = message.toLowerCase();
    const lowerSrc = (source || '').toLowerCase();
    
    return (
      lowerMsg.includes('dynamically imported') ||
      lowerMsg.includes('loading module') ||
      lowerMsg.includes('failed to fetch') ||
      lowerMsg.includes('mime type') ||
      lowerMsg.includes('disallowed mime') ||
      lowerMsg.includes('corrupted_content') ||
      lowerMsg.includes('ns_error_corrupted') ||
      lowerMsg.includes('import(') ||
      lowerMsg.includes('module "') ||
      lowerSrc.includes('.tsx?t=') ||
      lowerSrc.includes('.ts?t=') ||
      lowerSrc.includes('hot-update')
    );
  }, []);

  // Set up global error handlers
  useEffect(() => {
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    // Store original handlers
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;

    // window.onerror for synchronous errors
    window.onerror = (message, source, lineno, colno, error) => {
      const msgStr = String(message);
      const srcStr = String(source || '');

      if (isHMRError(msgStr, srcStr)) {
        logError({
          type: 'onerror',
          message: msgStr,
          source: srcStr,
          details: {
            lineno,
            colno,
            errorName: error?.name,
            errorStack: error?.stack?.slice(0, 500),
          },
        });
      }

      // Call original handler
      if (originalOnError) {
        return originalOnError.call(window, message, source, lineno, colno, error);
      }
      return false; // Let error propagate
    };

    // unhandledrejection for async/import failures
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason);

      if (isHMRError(msg)) {
        logError({
          type: 'unhandledrejection',
          message: msg,
          details: {
            reasonName: reason?.name,
            reasonStack: reason?.stack?.slice(0, 500),
          },
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Network events to correlate with WS reconnects
    const handleOnline = () => {
      const now = Date.now();
      const offlineDuration = lastOnlineTimeRef.current ? now - lastOnlineTimeRef.current : null;
      lastOnlineTimeRef.current = now;
      console.log(`[HMR-HEALTH] Network online (was offline for ${offlineDuration}ms)`);
    };

    const handleOffline = () => {
      console.log('[HMR-HEALTH] Network offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Try to hook into Vite HMR if available (resilient - don't require it)
    if (import.meta.hot) {
      try {
        // Accept this module to prevent full reload
        import.meta.hot.accept(() => {
          console.log('[HMR-HEALTH] Module accepted HMR update');
        });

        // Listen for HMR errors if the event exists
        import.meta.hot.on?.('vite:error', (payload: unknown) => {
          logError({
            type: 'dynamic-import',
            message: 'Vite HMR error event',
            details: { payload },
          });
        });
      } catch {
        // Vite HMR hooks not available - that's fine
      }
    }

    // Expose telemetry to window for console debugging
    (window as unknown as Record<string, unknown>).getHMRHealthTelemetry = () => {
      try {
        const stored = localStorage.getItem(TELEMETRY_KEY);
        return stored ? JSON.parse(stored) : { errors: [], networkEvents: [] };
      } catch {
        return { errors: [], networkEvents: [] };
      }
    };

    (window as unknown as Record<string, unknown>).clearHMRHealthTelemetry = () => {
      localStorage.removeItem(TELEMETRY_KEY);
      setErrors([]);
      console.log('[HMR-HEALTH] Telemetry cleared');
    };

    return () => {
      window.onerror = originalOnError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isHMRError, logError]);

  // Apply/remove Vite overlay minimization
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const styleId = 'hmr-health-vite-overlay-minimize';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (overlayMinimized) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      // Minimize overlay (reduce z-index, make it smaller, move to corner)
      style.textContent = `
        vite-error-overlay {
          z-index: 1 !important;
          position: fixed !important;
          top: auto !important;
          bottom: 60px !important;
          left: auto !important;
          right: 8px !important;
          width: 300px !important;
          height: 200px !important;
          opacity: 0.9 !important;
          transform: scale(0.8) !important;
          transform-origin: bottom right !important;
        }
      `;
    } else if (style) {
      style.remove();
    }

    saveTelemetry(errors, overlayMinimized);
  }, [overlayMinimized, errors, saveTelemetry]);

  const recentErrors = errors.slice(-5).reverse();
  const hasErrors = errors.length > 0;

  // Don't render if no errors and banner dismissed
  if (!showBanner && !hasErrors) return null;

  // Only show banner in dev mode
  if (!import.meta.env.DEV) return null;

  if (!showBanner) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[9998] pointer-events-none"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="bg-amber-500/95 text-amber-950 px-4 py-2 shadow-lg pointer-events-auto">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              HMR module error occurred ({errors.length} total)
            </span>
            <span className="text-xs opacity-75">— see console for details</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-amber-950 hover:bg-amber-600/50"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="ml-1 text-xs">Details</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-amber-950 hover:bg-amber-600/50"
              onClick={() => setOverlayMinimized(!overlayMinimized)}
            >
              <span className="text-xs">{overlayMinimized ? 'Restore Overlay' : 'Minimize Overlay'}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-amber-950 hover:bg-amber-600/50"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="ml-1 text-xs">Reload</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-amber-950 hover:bg-amber-600/50"
              onClick={() => setShowBanner(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {expanded && (
          <div className="max-w-screen-xl mx-auto mt-2 pt-2 border-t border-amber-600/30">
            <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
              {recentErrors.map((err) => (
                <div key={err.id} className="bg-amber-600/20 rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] opacity-60">
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-medium">[{err.type}]</span>
                    {err.timeSinceLastOnline !== null && (
                      <span className="text-[10px] opacity-75">
                        +{Math.round(err.timeSinceLastOnline / 1000)}s since online
                      </span>
                    )}
                  </div>
                  <div className="truncate opacity-90">{err.message}</div>
                  {err.source && (
                    <div className="truncate text-[10px] opacity-60">{err.source}</div>
                  )}
                </div>
              ))}
              {errors.length === 0 && (
                <div className="opacity-60">No errors recorded</div>
              )}
            </div>
            <div className="mt-2 text-[10px] opacity-60">
              Console: window.getHMRHealthTelemetry() • window.clearHMRHealthTelemetry()
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HMRHealthMonitor;
