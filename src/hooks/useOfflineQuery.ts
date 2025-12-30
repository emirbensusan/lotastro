import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineDataStore } from './useOfflineDataStore';

interface UseOfflineQueryOptions<T> {
  storeName: string;
  queryKey: string;
  queryFn: () => Promise<T[]>;
  staleTime?: number; // ms before data is considered stale (default 5 minutes)
  enabled?: boolean;
  transformForStorage?: (data: T[]) => T[];
}

interface UseOfflineQueryReturn<T> {
  data: T[];
  isLoading: boolean;
  isStale: boolean;
  isOffline: boolean;
  lastSynced: Date | null;
  refetch: () => Promise<void>;
  error: Error | null;
  isFetching: boolean;
}

export function useOfflineQuery<T extends { id?: string }>({
  storeName,
  queryKey,
  queryFn,
  staleTime = 5 * 60 * 1000, // 5 minutes default
  enabled = true,
  transformForStorage,
}: UseOfflineQueryOptions<T>): UseOfflineQueryReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const { isOnline } = useNetworkStatus();
  const store = useOfflineDataStore();
  const fetchedRef = useRef(false);
  const queryKeyRef = useRef(queryKey);

  // Load from IndexedDB first (instant response)
  const loadFromCache = useCallback(async () => {
    if (!store.isReady) return;
    
    try {
      const cachedData = await store.getAll<T>(storeName);
      const lastSync = await store.getLastSyncTime(storeName);
      
      if (cachedData.length > 0) {
        setData(cachedData);
        setIsLoading(false);
        
        if (lastSync) {
          setLastSynced(new Date(lastSync));
          const isDataStale = Date.now() - lastSync > staleTime;
          setIsStale(isDataStale);
        } else {
          setIsStale(true);
        }
      }
    } catch (err) {
      console.error('[useOfflineQuery] Cache load error:', err);
    }
  }, [store, storeName, staleTime]);

  // Fetch fresh data from API
  const fetchFromApi = useCallback(async () => {
    if (!isOnline) {
      setIsStale(true);
      return;
    }
    
    setIsFetching(true);
    setError(null);
    
    try {
      const freshData = await queryFn();
      const dataToStore = transformForStorage ? transformForStorage(freshData) : freshData;
      
      // Ensure each item has an id for IndexedDB
      const dataWithIds = dataToStore.map((item, index) => {
        if (!item.id) {
          return { ...item, id: `${queryKey}_${index}` };
        }
        return item;
      });
      
      setData(dataWithIds);
      setIsStale(false);
      setLastSynced(new Date());
      setIsLoading(false);
      
      // Update IndexedDB cache
      if (store.isReady) {
        await store.clearStore(storeName);
        await store.putMany(storeName, dataWithIds);
        await store.setLastSyncTime(storeName, dataWithIds.length);
      }
    } catch (err) {
      console.error('[useOfflineQuery] API fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      setIsStale(true);
    } finally {
      setIsFetching(false);
    }
  }, [isOnline, queryFn, queryKey, store, storeName, transformForStorage]);

  // Initial load
  useEffect(() => {
    if (!enabled || !store.isReady) return;
    
    // Reset if query key changes
    if (queryKeyRef.current !== queryKey) {
      queryKeyRef.current = queryKey;
      fetchedRef.current = false;
      setIsLoading(true);
    }
    
    const init = async () => {
      await loadFromCache();
      
      if (!fetchedRef.current && isOnline) {
        fetchedRef.current = true;
        await fetchFromApi();
      } else if (!isOnline) {
        setIsLoading(false);
      }
    };
    
    init();
  }, [enabled, store.isReady, queryKey, isOnline, loadFromCache, fetchFromApi]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && isStale && enabled && store.isReady && fetchedRef.current) {
      fetchFromApi();
    }
  }, [isOnline, isStale, enabled, store.isReady, fetchFromApi]);

  // Manual refetch
  const refetch = useCallback(async () => {
    if (isOnline) {
      await fetchFromApi();
    } else {
      await loadFromCache();
    }
  }, [isOnline, fetchFromApi, loadFromCache]);

  return {
    data,
    isLoading,
    isStale,
    isOffline: !isOnline,
    lastSynced,
    refetch,
    error,
    isFetching,
  };
}
