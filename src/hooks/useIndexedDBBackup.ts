import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'stocktake_backup';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';

export interface PendingUpload {
  id: string;
  sessionId: string;
  captureSequence: number;
  userId: string;
  imageDataUrl: string;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'uploading' | 'failed';
}

interface UseIndexedDBBackupReturn {
  isReady: boolean;
  saveForBackup: (upload: Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount' | 'status'>) => Promise<string>;
  getPendingUploads: () => Promise<PendingUpload[]>;
  updateUploadStatus: (id: string, status: PendingUpload['status'], error?: string) => Promise<void>;
  incrementRetryCount: (id: string) => Promise<number>;
  removeBackup: (id: string) => Promise<void>;
  clearAllBackups: () => Promise<void>;
  pendingCount: number;
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
      console.error('[IndexedDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

export const useIndexedDBBackup = (): UseIndexedDBBackupReturn => {
  const [isReady, setIsReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Initialize database
  useEffect(() => {
    openDatabase()
      .then(() => {
        setIsReady(true);
        refreshPendingCount();
      })
      .catch((err) => {
        console.error('[useIndexedDBBackup] Init failed:', err);
        setIsReady(false);
      });
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        setPendingCount(countRequest.result);
      };
    } catch (err) {
      console.error('[useIndexedDBBackup] Count error:', err);
    }
  }, []);

  // Save image for backup before upload
  const saveForBackup = useCallback(async (
    upload: Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount' | 'status'>
  ): Promise<string> => {
    const db = await openDatabase();
    const id = `${upload.sessionId}_${upload.captureSequence}_${Date.now()}`;
    
    const record: PendingUpload = {
      ...upload,
      id,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(record);

      request.onsuccess = () => {
        refreshPendingCount();
        resolve(id);
      };
      request.onerror = () => {
        console.error('[useIndexedDBBackup] Save error:', request.error);
        reject(request.error);
      };
    });
  }, [refreshPendingCount]);

  // Get all pending uploads
  const getPendingUploads = useCallback(async (): Promise<PendingUpload[]> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        console.error('[useIndexedDBBackup] Get all error:', request.error);
        reject(request.error);
      };
    });
  }, []);

  // Update upload status
  const updateUploadStatus = useCallback(async (
    id: string,
    status: PendingUpload['status'],
    error?: string
  ): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          resolve();
          return;
        }

        const record = getRequest.result as PendingUpload;
        record.status = status;
        if (error) record.lastError = error;

        const putRequest = store.put(record);
        putRequest.onsuccess = () => {
          refreshPendingCount();
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }, [refreshPendingCount]);

  // Increment retry count
  const incrementRetryCount = useCallback(async (id: string): Promise<number> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          resolve(0);
          return;
        }

        const record = getRequest.result as PendingUpload;
        record.retryCount += 1;

        const putRequest = store.put(record);
        putRequest.onsuccess = () => resolve(record.retryCount);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }, []);

  // Remove backup after successful upload
  const removeBackup = useCallback(async (id: string): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        refreshPendingCount();
        resolve();
      };
      request.onerror = () => {
        console.error('[useIndexedDBBackup] Delete error:', request.error);
        reject(request.error);
      };
    });
  }, [refreshPendingCount]);

  // Clear all backups
  const clearAllBackups = useCallback(async (): Promise<void> => {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        setPendingCount(0);
        resolve();
      };
      request.onerror = () => {
        console.error('[useIndexedDBBackup] Clear error:', request.error);
        reject(request.error);
      };
    });
  }, []);

  return {
    isReady,
    saveForBackup,
    getPendingUploads,
    updateUploadStatus,
    incrementRetryCount,
    removeBackup,
    clearAllBackups,
    pendingCount,
  };
};
