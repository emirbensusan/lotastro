import { useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useSyncQueue, QueuedMutation, SyncResult } from './useSyncQueue';
import { toast } from 'sonner';

interface UseBackgroundSyncOptions {
  syncIntervalMs?: number;
  maxRetries?: number;
  onSyncComplete?: (result: SyncResult) => void;
  onConflict?: (conflicts: QueuedMutation[]) => void;
  enabled?: boolean;
}

// Type for mutation executor function to be provided by the component
type MutationExecutor = (mutation: QueuedMutation) => Promise<{ success: boolean; serverData?: Record<string, unknown> }>;

export const useBackgroundSync = ({
  syncIntervalMs = 30000, // 30 seconds
  onSyncComplete,
  onConflict,
  enabled = true,
}: UseBackgroundSyncOptions = {}) => {
  const { isOnline } = useNetworkStatus();
  const syncQueue = useSyncQueue();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef(false);

  // Default mutation executor - can be overridden
  const defaultExecutor: MutationExecutor = useCallback(async (mutation) => {
    // This is a generic implementation that works for simple cases
    // Components can provide their own executor for complex scenarios
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { type, table, recordId, data } = mutation;
      
      // Use any type to bypass strict table type checking
      // The actual table names will be validated at runtime by Supabase
      const client = supabase as any;
      
      // Fetch current server state for conflict detection
      const { data: serverData } = await client
        .from(table)
        .select('*')
        .eq('id', recordId)
        .single();
      
      let result;
      
      switch (type) {
        case 'CREATE':
          result = await client.from(table).insert(data).select().single();
          break;
        case 'UPDATE':
          result = await client.from(table).update(data).eq('id', recordId).select().single();
          break;
        case 'DELETE':
          result = await client.from(table).delete().eq('id', recordId);
          break;
        default:
          throw new Error(`Unknown mutation type: ${type}`);
      }
      
      if (result.error) {
        if (serverData && mutation.originalData) {
          const serverChanged = JSON.stringify(serverData) !== JSON.stringify(mutation.originalData);
          if (serverChanged) {
            return { success: false, serverData: serverData as Record<string, unknown> };
          }
        }
        throw result.error;
      }
      
      return { success: true };
    } catch (err) {
      console.error('[BackgroundSync] Mutation failed:', err);
      return { success: false };
    }
  }, []);

  // Process sync queue
  const processSync = useCallback(async (executor?: MutationExecutor) => {
    if (!isOnline || syncQueue.syncStatus.isProcessing) return;
    
    if (syncQueue.syncStatus.pendingCount === 0 && syncQueue.syncStatus.failedCount === 0) {
      return;
    }
    
    console.log('[BackgroundSync] Starting sync...');
    
    const result = await syncQueue.processSyncQueue(executor || defaultExecutor);
    
    if (result.success > 0 || result.failed > 0 || result.conflicts > 0) {
      onSyncComplete?.(result);
      
      if (result.success > 0) {
        toast.success(`Synced ${result.success} change${result.success > 1 ? 's' : ''}`);
      }
      
      if (result.conflicts > 0) {
        toast.warning(`${result.conflicts} conflict${result.conflicts > 1 ? 's' : ''} need resolution`);
        const conflicts = await syncQueue.getConflicts();
        onConflict?.(conflicts);
      }
      
      if (result.failed > 0) {
        toast.error(`${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync`);
      }
    }
  }, [isOnline, syncQueue, defaultExecutor, onSyncComplete, onConflict]);

  // Set up interval-based sync
  useEffect(() => {
    if (!enabled || !isOnline) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }
    
    // Sync immediately when coming online
    if (wasOfflineRef.current && isOnline) {
      console.log('[BackgroundSync] Back online, syncing...');
      processSync();
    }
    wasOfflineRef.current = !isOnline;
    
    // Set up periodic sync
    syncIntervalRef.current = setInterval(() => processSync(), syncIntervalMs);
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [enabled, isOnline, processSync, syncIntervalMs]);

  // Force sync
  const forceSync = useCallback(async (executor?: MutationExecutor) => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    await processSync(executor);
  }, [isOnline, processSync]);

  return {
    forceSync,
    syncStatus: syncQueue.syncStatus,
    isOnline,
  };
};
