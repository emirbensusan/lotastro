import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'lotastro_offline';
const DB_VERSION = 2;

export interface OfflineStoreConfig {
  name: string;
  keyPath: string;
  indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
}

const STORES: OfflineStoreConfig[] = [
  { 
    name: 'lots', 
    keyPath: 'id',
    indexes: [
      { name: 'quality', keyPath: 'quality' },
      { name: 'color', keyPath: 'color' },
      { name: 'status', keyPath: 'status' },
      { name: 'updated_at', keyPath: 'updated_at' }
    ]
  },
  { 
    name: 'catalog_items', 
    keyPath: 'id',
    indexes: [
      { name: 'code', keyPath: 'code' },
      { name: 'status', keyPath: 'status' }
    ]
  },
  { 
    name: 'orders', 
    keyPath: 'id',
    indexes: [
      { name: 'order_number', keyPath: 'order_number' },
      { name: 'customer_name', keyPath: 'customer_name' }
    ]
  },
  { 
    name: 'reservations', 
    keyPath: 'id',
    indexes: [
      { name: 'reservation_number', keyPath: 'reservation_number' },
      { name: 'status', keyPath: 'status' }
    ]
  },
  { 
    name: 'suppliers', 
    keyPath: 'id' 
  },
  { 
    name: 'inventory_pivot', 
    keyPath: 'id' 
  },
  { 
    name: 'sync_metadata', 
    keyPath: 'store_name' 
  },
  {
    name: 'sync_queue',
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'table', keyPath: 'table' },
      { name: 'createdAt', keyPath: 'createdAt' }
    ]
  },
  {
    name: 'conflicts',
    keyPath: 'id',
    indexes: [
      { name: 'table', keyPath: 'table' },
      { name: 'createdAt', keyPath: 'createdAt' }
    ]
  }
];

export interface SyncMetadata {
  store_name: string;
  last_synced_at: number;
  record_count: number;
}

let dbInstance: IDBDatabase | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDataStore] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      STORES.forEach(storeConfig => {
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const store = db.createObjectStore(storeConfig.name, { keyPath: storeConfig.keyPath });
          
          storeConfig.indexes?.forEach(index => {
            store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
          });
        }
      });
    };
  });
};

export interface UseOfflineDataStoreReturn {
  isReady: boolean;
  getAll: <T>(storeName: string) => Promise<T[]>;
  getById: <T>(storeName: string, id: string) => Promise<T | undefined>;
  putMany: <T>(storeName: string, records: T[]) => Promise<void>;
  put: <T>(storeName: string, record: T) => Promise<void>;
  deleteById: (storeName: string, id: string) => Promise<void>;
  clearStore: (storeName: string) => Promise<void>;
  getLastSyncTime: (storeName: string) => Promise<number | null>;
  setLastSyncTime: (storeName: string, recordCount?: number) => Promise<void>;
  getByIndex: <T>(storeName: string, indexName: string, value: IDBValidKey) => Promise<T[]>;
}

export const useOfflineDataStore = (): UseOfflineDataStoreReturn => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    openDatabase()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error('[useOfflineDataStore] Init failed:', err);
        setIsReady(false);
      });
  }, []);

  const getAll = useCallback(async <T>(storeName: string): Promise<T[]> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const getById = useCallback(async <T>(storeName: string, id: string): Promise<T | undefined> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const putMany = useCallback(async <T>(storeName: string, records: T[]): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      records.forEach(record => {
        store.put(record);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, []);

  const put = useCallback(async <T>(storeName: string, record: T): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  const deleteById = useCallback(async (storeName: string, id: string): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  const clearStore = useCallback(async (storeName: string): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  const getLastSyncTime = useCallback(async (storeName: string): Promise<number | null> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_metadata', 'readonly');
      const store = tx.objectStore('sync_metadata');
      const request = store.get(storeName);

      request.onsuccess = () => {
        const metadata = request.result as SyncMetadata | undefined;
        resolve(metadata?.last_synced_at || null);
      };
      request.onerror = () => reject(request.error);
    });
  }, []);

  const setLastSyncTime = useCallback(async (storeName: string, recordCount = 0): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_metadata', 'readwrite');
      const store = tx.objectStore('sync_metadata');
      
      const metadata: SyncMetadata = {
        store_name: storeName,
        last_synced_at: Date.now(),
        record_count: recordCount
      };
      
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, []);

  const getByIndex = useCallback(async <T>(
    storeName: string, 
    indexName: string, 
    value: IDBValidKey
  ): Promise<T[]> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }, []);

  return {
    isReady,
    getAll,
    getById,
    putMany,
    put,
    deleteById,
    clearStore,
    getLastSyncTime,
    setLastSyncTime,
    getByIndex,
  };
};
