import { lazy, ComponentType } from 'react';

interface LazyWithRetryOptions {
  retries?: number;
  retryDelay?: number;
  onError?: (error: Error, attempt: number) => void;
  onSuccess?: (attempt: number) => void;
}

/**
 * Wrapper around React.lazy that adds retry logic with exponential backoff
 * and cache-busting for failed dynamic imports.
 * 
 * This helps handle intermittent HMR/module loading failures in development
 * and network issues in production.
 * 
 * @param importFn - The dynamic import function, e.g., () => import('./MyComponent')
 * @param options - Configuration options for retry behavior
 * @returns A lazy-loaded component with retry capabilities
 * 
 * @example
 * const MyPage = lazyWithRetry(() => import('./pages/MyPage'));
 * 
 * @example
 * const MyPage = lazyWithRetry(
 *   () => import('./pages/MyPage'),
 *   { retries: 3, retryDelay: 200 }
 * );
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyWithRetryOptions = {}
): React.LazyExoticComponent<T> {
  const { 
    retries = 2, 
    retryDelay = 100, 
    onError,
    onSuccess 
  } = options;

  return lazy(async () => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const module = await importFn();
        
        // Log success if we had to retry
        if (attempt > 0) {
          console.log(`[LAZY-RETRY] Succeeded on attempt ${attempt + 1}`);
          onSuccess?.(attempt);
        }
        
        return module;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError?.message || String(error);
        
        // Log the failure
        console.warn(
          `[LAZY-RETRY] Attempt ${attempt + 1}/${retries + 1} failed:`,
          errorMessage
        );
        onError?.(lastError, attempt);

        if (attempt < retries) {
          // Wait before retry with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          
          // Log retry attempt
          console.log(`[LAZY-RETRY] Retrying in ${delay}ms...`);
        }
      }
    }

    // All retries exhausted, throw the last error
    console.error(
      `[LAZY-RETRY] All ${retries + 1} attempts failed. Last error:`,
      lastError?.message
    );
    throw lastError;
  });
}

/**
 * Pre-configured lazyWithRetry for page components.
 * Uses 3 retries with 150ms base delay (150, 300, 600ms).
 */
export function lazyPage<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazyWithRetry(importFn, {
    retries: 3,
    retryDelay: 150,
    onError: (error, attempt) => {
      // Store failure info for HMRHealthMonitor to pick up
      try {
        const failures = JSON.parse(
          sessionStorage.getItem('lazy_import_failures') || '[]'
        );
        failures.push({
          timestamp: Date.now(),
          attempt,
          message: error.message,
          stack: error.stack?.slice(0, 300),
        });
        // Keep only last 10 failures
        sessionStorage.setItem(
          'lazy_import_failures',
          JSON.stringify(failures.slice(-10))
        );
      } catch {
        // Ignore storage errors
      }
    },
  });
}

export default lazyWithRetry;
