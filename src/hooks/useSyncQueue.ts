import { useState, useCallback, useEffect } from 'react';
import { useOfflineDataStore } from './useOfflineDataStore';
import { useNetworkStatus } from './useNetworkStatus';

export interface QueuedMutation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  recordId: string;
  data: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed' | 'conflict';
  userId?: string;
}

export interface SyncStatus {
  isProcessing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
}

export interface SyncResult {
  success: number;
  failed: number;
  conflicts: number;
}

interface UseSyncQueueReturn {
  queueMutation: (mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts' | 'status'>) => Promise<string>;
  getPendingMutations: () => Promise<QueuedMutation[]>;
  getConflicts: () => Promise<QueuedMutation[]>;
  processSyncQueue: (
    executeMutation: (mutation: QueuedMutation) => Promise<{ success: boolean; serverData?: Record<string, unknown> }>
  ) => Promise<SyncResult>;
  removeMutation: (id: string) => Promise<void>;
  resolveConflict: (id: string, resolution: 'local' | 'server' | 'merge', mergedData?: Record<string, unknown>) => Promise<void>;
  clearQueue: () => Promise<void>;
  syncStatus: SyncStatus;
  refreshStatus: () => Promise<void>;
}

export const useSyncQueue = (): UseSyncQueueReturn => {
  const store = useOfflineDataStore();
  const { isOnline } = useNetworkStatus();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isProcessing: false,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastSyncAt: null,
  });

  const refreshStatus = useCallback(async () => {
    if (!store.isReady) return;
    
    try {
      const pending = await store.getByIndex<QueuedMutation>('sync_queue', 'status', 'pending');
      const failed = await store.getByIndex<QueuedMutation>('sync_queue', 'status', 'failed');
      const conflicts = await store.getByIndex<QueuedMutation>('sync_queue', 'status', 'conflict');
      
      setSyncStatus(prev => ({
        ...prev,
        pendingCount: pending.length,
        failedCount: failed.length,
        conflictCount: conflicts.length,
      }));
    } catch (err) {
      console.error('[useSyncQueue] Status refresh error:', err);
    }
  }, [store]);

  useEffect(() => {
    if (store.isReady) {
      refreshStatus();
    }
  }, [store.isReady, refreshStatus]);

  const queueMutation = useCallback(async (
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts' | 'status'>
  ): Promise<string> => {
    const id = `${mutation.table}_${mutation.recordId}_${Date.now()}`;
    
    const record: QueuedMutation = {
      ...mutation,
      id,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    };
    
    await store.put('sync_queue', record);
    await refreshStatus();
    
    console.log('[useSyncQueue] Mutation queued:', id);
    return id;
  }, [store, refreshStatus]);

  const getPendingMutations = useCallback(async (): Promise<QueuedMutation[]> => {
    const all = await store.getAll<QueuedMutation>('sync_queue');
    return all
      .filter(m => m.status === 'pending' || m.status === 'failed')
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [store]);

  const getConflicts = useCallback(async (): Promise<QueuedMutation[]> => {
    return store.getByIndex<QueuedMutation>('sync_queue', 'status', 'conflict');
  }, [store]);

  const removeMutation = useCallback(async (id: string): Promise<void> => {
    await store.deleteById('sync_queue', id);
    await refreshStatus();
  }, [store, refreshStatus]);

  const processSyncQueue = useCallback(async (
    executeMutation: (mutation: QueuedMutation) => Promise<{ success: boolean; serverData?: Record<string, unknown> }>
  ): Promise<SyncResult> => {
    if (!isOnline) {
      console.log('[useSyncQueue] Offline, skipping sync');
      return { success: 0, failed: 0, conflicts: 0 };
    }
    
    setSyncStatus(prev => ({ ...prev, isProcessing: true }));
    
    const result: SyncResult = { success: 0, failed: 0, conflicts: 0 };
    
    try {
      const mutations = await getPendingMutations();
      console.log(`[useSyncQueue] Processing ${mutations.length} mutations`);
      
      for (const mutation of mutations) {
        // Mark as processing
        await store.put('sync_queue', { ...mutation, status: 'processing' });
        
        try {
          const { success, serverData } = await executeMutation(mutation);
          
          if (success) {
            await removeMutation(mutation.id);
            result.success++;
          } else if (serverData && hasConflict(mutation.originalData, mutation.data, serverData)) {
            // Conflict detected
            await store.put('sync_queue', {
              ...mutation,
              status: 'conflict',
              originalData: serverData,
            });
            result.conflicts++;
          } else {
            // Regular failure
            const newAttempts = mutation.attempts + 1;
            await store.put('sync_queue', {
              ...mutation,
              status: newAttempts >= 3 ? 'failed' : 'pending',
              attempts: newAttempts,
              lastError: 'Sync failed',
            });
            result.failed++;
          }
        } catch (err) {
          const newAttempts = mutation.attempts + 1;
          await store.put('sync_queue', {
            ...mutation,
            status: newAttempts >= 3 ? 'failed' : 'pending',
            attempts: newAttempts,
            lastError: err instanceof Error ? err.message : 'Unknown error',
          });
          result.failed++;
        }
      }
      
      setSyncStatus(prev => ({
        ...prev,
        lastSyncAt: new Date(),
      }));
    } finally {
      setSyncStatus(prev => ({ ...prev, isProcessing: false }));
      await refreshStatus();
    }
    
    console.log('[useSyncQueue] Sync complete:', result);
    return result;
  }, [isOnline, getPendingMutations, store, removeMutation, refreshStatus]);

  const resolveConflict = useCallback(async (
    id: string,
    resolution: 'local' | 'server' | 'merge',
    mergedData?: Record<string, unknown>
  ): Promise<void> => {
    const mutation = await store.getById<QueuedMutation>('sync_queue', id);
    if (!mutation) return;
    
    if (resolution === 'server') {
      // Discard local changes
      await removeMutation(id);
    } else if (resolution === 'local' || resolution === 'merge') {
      // Re-queue with resolved data
      await store.put('sync_queue', {
        ...mutation,
        status: 'pending',
        data: resolution === 'merge' ? (mergedData || mutation.data) : mutation.data,
        attempts: 0,
      });
    }
    
    await refreshStatus();
  }, [store, removeMutation, refreshStatus]);

  const clearQueue = useCallback(async (): Promise<void> => {
    await store.clearStore('sync_queue');
    await refreshStatus();
  }, [store, refreshStatus]);

  return {
    queueMutation,
    getPendingMutations,
    getConflicts,
    processSyncQueue,
    removeMutation,
    resolveConflict,
    clearQueue,
    syncStatus,
    refreshStatus,
  };
};

// Helper to detect conflicts using three-way comparison
function hasConflict(
  original: Record<string, unknown> | undefined,
  local: Record<string, unknown>,
  server: Record<string, unknown>
): boolean {
  if (!original) return false;
  
  const changedFields = Object.keys(local).filter(key => 
    JSON.stringify(local[key]) !== JSON.stringify(original[key])
  );
  
  for (const field of changedFields) {
    const serverChanged = JSON.stringify(server[field]) !== JSON.stringify(original[field]);
    const localValue = JSON.stringify(local[field]);
    const serverValue = JSON.stringify(server[field]);
    
    if (serverChanged && localValue !== serverValue) {
      return true; // Both changed to different values = conflict
    }
  }
  
  return false;
}
