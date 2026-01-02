import { useCallback } from 'react';
import { useOffline } from '@/contexts/OfflineContext';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MutationOptions<T> {
  table: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  optimisticUpdate?: (data: T) => void;
}

/**
 * Hook for performing mutations that work both online and offline
 * - Online: Executes immediately against Supabase
 * - Offline: Queues in IndexedDB for background sync
 */
export function useOfflineMutation<T extends { id?: string }>() {
  const { isOnline } = useNetworkStatus();
  const { queueMutation } = useOffline();

  const mutate = useCallback(async (
    data: Partial<T>,
    recordId: string | undefined,
    options: MutationOptions<T>
  ) => {
    const { table, type, onSuccess, onError, optimisticUpdate } = options;

    // Apply optimistic update immediately
    if (optimisticUpdate && data) {
      optimisticUpdate(data as T);
    }

    if (isOnline) {
      // Execute immediately
      try {
        let result;

        switch (type) {
          case 'CREATE':
            result = await (supabase as any).from(table).insert(data).select().single();
            break;
          case 'UPDATE':
            result = await (supabase as any).from(table).update(data).eq('id', recordId).select().single();
            break;
          case 'DELETE':
            result = await (supabase as any).from(table).delete().eq('id', recordId);
            break;
        }

        if (result.error) throw result.error;
        
        onSuccess?.(result.data);
        return { data: result.data, queued: false };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Mutation failed');
        onError?.(error);
        throw error;
      }
    } else {
      // Queue for later
      try {
        const mutationId = await queueMutation({
          type,
          table,
          recordId: recordId || crypto.randomUUID(),
          data: data as Record<string, unknown>,
          originalData: undefined, // Will be fetched during sync for conflict detection
        });

        toast.info('Saved offline - will sync when connected');
        
        return { data: data as T, queued: true, mutationId };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to queue mutation');
        onError?.(error);
        throw error;
      }
    }
  }, [isOnline, queueMutation]);

  const create = useCallback((
    data: Omit<T, 'id'>,
    options: Omit<MutationOptions<T>, 'type'>
  ) => {
    return mutate(data as Partial<T>, undefined, { ...options, type: 'CREATE' });
  }, [mutate]);

  const update = useCallback((
    recordId: string,
    data: Partial<T>,
    options: Omit<MutationOptions<T>, 'type'>
  ) => {
    return mutate(data, recordId, { ...options, type: 'UPDATE' });
  }, [mutate]);

  const remove = useCallback((
    recordId: string,
    options: Omit<MutationOptions<T>, 'type'>
  ) => {
    return mutate({} as Partial<T>, recordId, { ...options, type: 'DELETE' });
  }, [mutate]);

  return {
    mutate,
    create,
    update,
    remove,
    isOnline,
  };
}

export default useOfflineMutation;
