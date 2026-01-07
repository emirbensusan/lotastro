import { useEffect, useRef, useCallback, useState } from 'react';

// Global performance marks storage
const performanceMarks: Record<string, number> = {};

// Boot time captured immediately when the module loads
const APP_BOOT_START = performance.now();

/**
 * Record a performance mark with timestamp
 */
export function markPerformance(name: string): void {
  performanceMarks[name] = performance.now();
  
  if (import.meta.env.DEV) {
    console.info(`[Perf] ${name}: ${performanceMarks[name].toFixed(0)}ms since boot`);
  }
}

/**
 * Get elapsed time since boot
 */
export function getTimeSinceBoot(): number {
  return performance.now() - APP_BOOT_START;
}

/**
 * Get a specific performance mark
 */
export function getMark(name: string): number | undefined {
  return performanceMarks[name];
}

/**
 * Get all performance marks
 */
export function getAllMarks(): Record<string, number> {
  return { ...performanceMarks, APP_BOOT_START };
}

/**
 * Calculate elapsed time between two marks
 */
export function getElapsedBetween(startMark: string, endMark: string): number | null {
  const start = performanceMarks[startMark];
  const end = performanceMarks[endMark];
  
  if (start === undefined || end === undefined) {
    return null;
  }
  
  return end - start;
}

export interface PerformanceMetrics {
  appBootMs: number;
  authReadyMs: number | null;
  mfaCheckMs: number | null;
  dashboardReadyMs: number | null;
  firstContentfulPaint: number | null;
  domInteractive: number | null;
}

/**
 * Hook to access performance metrics
 */
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    appBootMs: 0,
    authReadyMs: null,
    mfaCheckMs: null,
    dashboardReadyMs: null,
    firstContentfulPaint: null,
    domInteractive: null,
  });

  const updateMetrics = useCallback(() => {
    // Get browser performance metrics
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');

    setMetrics({
      appBootMs: getTimeSinceBoot(),
      authReadyMs: getMark('auth_ready') ?? null,
      mfaCheckMs: getMark('mfa_check_complete') ?? null,
      dashboardReadyMs: getMark('dashboard_ready') ?? null,
      firstContentfulPaint: fcpEntry?.startTime ?? null,
      domInteractive: navEntry?.domInteractive ?? null,
    });
  }, []);

  useEffect(() => {
    // Update metrics on mount and when marks change
    updateMetrics();

    // Update periodically for the first 10 seconds
    const interval = setInterval(updateMetrics, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [updateMetrics]);

  return {
    metrics,
    updateMetrics,
    markPerformance,
    getTimeSinceBoot,
    getAllMarks,
  };
}

/**
 * Hook to mark component mount time
 */
export function useMarkOnMount(markName: string) {
  const markedRef = useRef(false);

  useEffect(() => {
    if (!markedRef.current) {
      markPerformance(markName);
      markedRef.current = true;
    }
  }, [markName]);
}

// Mark app boot start immediately
markPerformance('app_boot_start');

export default usePerformanceMetrics;
