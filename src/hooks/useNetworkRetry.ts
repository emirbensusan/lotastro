import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryOn?: (error: Error) => boolean;
  onRetryStart?: (attempt: number, delay: number) => void;
  onRetrySuccess?: () => void;
  onRetryExhausted?: (error: Error) => void;
}

interface RetryState {
  isRetrying: boolean;
  currentAttempt: number;
  lastError: Error | null;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetryStart' | 'onRetrySuccess' | 'onRetryExhausted' | 'retryOn'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// Determine if an error should trigger a retry
function shouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors - always retry
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return true;
  }
  
  // Server errors (5xx) - retry
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }
  
  // Rate limiting - retry with backoff
  if (message.includes('429') || message.includes('too many requests')) {
    return true;
  }
  
  // Don't retry client errors (4xx except 429)
  if (message.includes('400') || message.includes('401') || message.includes('403') || message.includes('404')) {
    return false;
  }
  
  // Default: retry unknown errors
  return true;
}

function calculateDelay(attempt: number, config: typeof DEFAULT_CONFIG): number {
  // Exponential backoff with jitter
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);
  return Math.round(delay);
}

export function useNetworkRetry<T>(
  mutationFn: () => Promise<T>,
  config: RetryConfig = {}
): {
  execute: () => Promise<T>;
  state: RetryState;
  reset: () => void;
} {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    currentAttempt: 0,
    lastError: null,
  });
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({
      isRetrying: false,
      currentAttempt: 0,
      lastError: null,
    });
  }, []);

  const execute = useCallback(async (): Promise<T> => {
    abortRef.current = false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
      if (abortRef.current) {
        throw new Error('Operation cancelled');
      }

      try {
        setState(prev => ({
          ...prev,
          currentAttempt: attempt,
          isRetrying: attempt > 0,
        }));

        const result = await mutationFn();
        
        if (attempt > 0) {
          config.onRetrySuccess?.();
          toast({
            title: 'Success',
            description: 'Operation completed after retry.',
          });
        }

        setState({
          isRetrying: false,
          currentAttempt: 0,
          lastError: null,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        setState(prev => ({ ...prev, lastError }));

        const canRetry = config.retryOn?.(lastError) ?? shouldRetry(lastError);
        const hasMoreRetries = attempt < mergedConfig.maxRetries;

        if (!canRetry || !hasMoreRetries) {
          break;
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt, mergedConfig);
        config.onRetryStart?.(attempt + 1, delay);

        // Show toast for retry
        if (attempt === 0) {
          toast({
            title: 'Retrying...',
            description: `Connection issue. Retrying in ${Math.round(delay / 1000)}s...`,
            variant: 'default',
          });
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    setState(prev => ({ ...prev, isRetrying: false }));
    config.onRetryExhausted?.(lastError!);
    
    throw lastError;
  }, [mutationFn, config, mergedConfig]);

  return { execute, state, reset };
}

// Wrapper for React Query mutations with retry
export function createRetryMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  config?: RetryConfig
) {
  return async (variables: TVariables): Promise<TData> => {
    let lastError: Error | null = null;
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
      try {
        return await mutationFn(variables);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const canRetry = config?.retryOn?.(lastError) ?? shouldRetry(lastError);
        const hasMoreRetries = attempt < mergedConfig.maxRetries;

        if (!canRetry || !hasMoreRetries) {
          break;
        }

        const delay = calculateDelay(attempt, mergedConfig);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
}

export default useNetworkRetry;
