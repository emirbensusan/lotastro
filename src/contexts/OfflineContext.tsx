import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { useSyncQueue, QueuedMutation, SyncResult } from '@/hooks/useSyncQueue';

interface OfflineContextValue {
  // Network status
  isOnline: boolean;
  isSlowConnection: boolean;
  
  // Sync status
  syncStatus: {
    isProcessing: boolean;
    pendingCount: number;
    failedCount: number;
    conflictCount: number;
    lastSyncAt: Date | null;
  };
  
  // Conflicts
  conflicts: QueuedMutation[];
  showConflictDialog: boolean;
  setShowConflictDialog: (show: boolean) => void;
  
  // Actions
  forceSync: () => Promise<void>;
  queueMutation: (mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts' | 'status'>) => Promise<string>;
  resolveConflict: (id: string, resolution: 'local' | 'server' | 'merge', mergedData?: Record<string, unknown>) => Promise<void>;
  clearAllOfflineData: () => Promise<void>;
  refreshConflicts: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const [conflicts, setConflicts] = useState<QueuedMutation[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  
  const syncQueue = useSyncQueue();
  
  const handleSyncComplete = useCallback((result: SyncResult) => {
    console.log('[OfflineProvider] Sync complete:', result);
  }, []);
  
  const handleConflict = useCallback((newConflicts: QueuedMutation[]) => {
    setConflicts(newConflicts);
    if (newConflicts.length > 0) {
      setShowConflictDialog(true);
    }
  }, []);
  
  const { forceSync, syncStatus } = useBackgroundSync({
    onSyncComplete: handleSyncComplete,
    onConflict: handleConflict,
    enabled: true,
  });
  
  const refreshConflicts = useCallback(async () => {
    const latestConflicts = await syncQueue.getConflicts();
    setConflicts(latestConflicts);
  }, [syncQueue]);
  
  const resolveConflict = useCallback(async (
    id: string,
    resolution: 'local' | 'server' | 'merge',
    mergedData?: Record<string, unknown>
  ) => {
    await syncQueue.resolveConflict(id, resolution, mergedData);
    await refreshConflicts();
    
    if (conflicts.length <= 1) {
      setShowConflictDialog(false);
    }
  }, [syncQueue, refreshConflicts, conflicts.length]);
  
  const clearAllOfflineData = useCallback(async () => {
    await syncQueue.clearQueue();
    setConflicts([]);
    
    // Clear IndexedDB stores
    const deleteRequest = indexedDB.deleteDatabase('lotastro_offline');
    await new Promise<void>((resolve, reject) => {
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }, [syncQueue]);
  
  const value: OfflineContextValue = {
    isOnline,
    isSlowConnection,
    syncStatus: {
      ...syncStatus,
      pendingCount: syncQueue.syncStatus.pendingCount,
      failedCount: syncQueue.syncStatus.failedCount,
      conflictCount: syncQueue.syncStatus.conflictCount,
    },
    conflicts,
    showConflictDialog,
    setShowConflictDialog,
    forceSync,
    queueMutation: syncQueue.queueMutation,
    resolveConflict,
    clearAllOfflineData,
    refreshConflicts,
  };
  
  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextValue => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
