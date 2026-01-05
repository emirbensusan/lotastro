import { useCallback, useEffect, useRef } from 'react';

export type NavigationSource = 
  | 'keyboard' 
  | 'pointer' 
  | 'click-fallback' 
  | 'hard-fallback'
  | 'Sidebar-Instant'
  | 'Sidebar-Click-Fallback'
  | 'Mobile-Sidebar'
  | 'Keyboard-Shortcut';

export interface NavigationMetric {
  id: string;
  source: NavigationSource;
  path: string;
  startTime: number;
  routeChangeTime: number | null;
  delta: number | null;
  usedFallback: boolean;
  fallbackReason?: string;
  timestamp: number;
}

interface NavigationMetricsState {
  metrics: NavigationMetric[];
  averageBySource: Record<string, { count: number; avgDelta: number }>;
}

const MAX_METRICS = 20;

// Global state for metrics (survives component remounts)
let metricsState: NavigationMetricsState = {
  metrics: [],
  averageBySource: {},
};

// Generate unique ID
const generateId = () => `nav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Log a navigation metric
 */
export function logNavigationMetric(metric: Omit<NavigationMetric, 'id' | 'timestamp'>): void {
  const fullMetric: NavigationMetric = {
    ...metric,
    id: generateId(),
    timestamp: Date.now(),
  };

  // Add to metrics array (keep last MAX_METRICS)
  metricsState.metrics = [...metricsState.metrics.slice(-(MAX_METRICS - 1)), fullMetric];

  // Update averages by source
  if (fullMetric.delta !== null) {
    const sourceKey = fullMetric.source;
    const existing = metricsState.averageBySource[sourceKey] || { count: 0, avgDelta: 0 };
    const newCount = existing.count + 1;
    const newAvg = ((existing.avgDelta * existing.count) + fullMetric.delta) / newCount;
    
    metricsState.averageBySource[sourceKey] = {
      count: newCount,
      avgDelta: newAvg,
    };
  }

  // Log to console with comparison
  const keyboardAvg = metricsState.averageBySource['Keyboard-Shortcut']?.avgDelta;
  const pointerAvg = metricsState.averageBySource['Sidebar-Instant']?.avgDelta;
  
  console.log(
    `[NAV-METRIC] ${fullMetric.source} → ${fullMetric.path}: ${fullMetric.delta?.toFixed(1) ?? '?'}ms` +
    (fullMetric.usedFallback ? ` (FALLBACK: ${fullMetric.fallbackReason})` : '') +
    (keyboardAvg && pointerAvg ? ` | Avg keyboard: ${keyboardAvg.toFixed(1)}ms, pointer: ${pointerAvg.toFixed(1)}ms` : '')
  );
}

/**
 * Get all navigation metrics
 */
export function getNavigationMetrics(): NavigationMetricsState {
  return { ...metricsState };
}

/**
 * Clear all navigation metrics
 */
export function clearNavigationMetrics(): void {
  metricsState = {
    metrics: [],
    averageBySource: {},
  };
  console.log('[NAV-METRIC] Metrics cleared');
}

/**
 * Hook for navigation metrics - exposes global debugging functions
 */
export function useNavigationMetrics() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Expose debugging functions on window
    if (typeof window !== 'undefined') {
      (window as any).getNavigationMetrics = getNavigationMetrics;
      (window as any).clearNavigationMetrics = clearNavigationMetrics;
      
      console.log(
        '[NAV-METRIC] Navigation metrics initialized. Use window.getNavigationMetrics() to view data.'
      );
    }

    return () => {
      // Don't clean up - keep functions available for debugging
    };
  }, []);

  const logMetric = useCallback((metric: Omit<NavigationMetric, 'id' | 'timestamp'>) => {
    logNavigationMetric(metric);
  }, []);

  return {
    logMetric,
    getMetrics: getNavigationMetrics,
    clearMetrics: clearNavigationMetrics,
  };
}

export default useNavigationMetrics;
