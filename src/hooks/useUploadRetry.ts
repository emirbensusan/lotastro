import { useCallback, useRef, useState } from 'react';
import { useIndexedDBBackup, PendingUpload } from './useIndexedDBBackup';

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 30000; // 30 seconds

interface RetryState {
  isRetrying: boolean;
  currentRetry: number;
  maxRetries: number;
  nextRetryIn: number | null;
}

interface UseUploadRetryReturn {
  retryState: RetryState;
  backupBeforeUpload: (
    sessionId: string,
    captureSequence: number,
    userId: string,
    imageDataUrl: string
  ) => Promise<string>;
  markUploadSuccess: (backupId: string) => Promise<void>;
  markUploadFailed: (backupId: string, error: string) => Promise<void>;
  retryFailedUploads: (
    uploadFn: (upload: PendingUpload) => Promise<boolean>
  ) => Promise<{ succeeded: number; failed: number }>;
  getPendingUploads: () => Promise<PendingUpload[]>;
  pendingCount: number;
  clearAllBackups: () => Promise<void>;
}

// Calculate exponential backoff delay
const calculateBackoffDelay = (retryCount: number): number => {
  const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
  // Add jitter (±25%)
  const jitter = delay * (0.75 + Math.random() * 0.5);
  return Math.min(jitter, MAX_DELAY_MS);
};

export const useUploadRetry = (): UseUploadRetryReturn => {
  const {
    isReady,
    saveForBackup,
    getPendingUploads,
    updateUploadStatus,
    incrementRetryCount,
    removeBackup,
    clearAllBackups,
    pendingCount,
  } = useIndexedDBBackup();

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    currentRetry: 0,
    maxRetries: MAX_RETRIES,
    nextRetryIn: null,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save image to IndexedDB before attempting upload
  const backupBeforeUpload = useCallback(async (
    sessionId: string,
    captureSequence: number,
    userId: string,
    imageDataUrl: string
  ): Promise<string> => {
    if (!isReady) {
      console.warn('[useUploadRetry] IndexedDB not ready');
      return '';
    }

    try {
      const id = await saveForBackup({
        sessionId,
        captureSequence,
        userId,
        imageDataUrl,
      });
      console.log('[useUploadRetry] Backup saved:', id);
      return id;
    } catch (err) {
      console.error('[useUploadRetry] Backup save failed:', err);
      return '';
    }
  }, [isReady, saveForBackup]);

  // Mark upload as successful and remove backup
  const markUploadSuccess = useCallback(async (backupId: string): Promise<void> => {
    if (!backupId) return;
    
    try {
      await removeBackup(backupId);
      console.log('[useUploadRetry] Backup removed after success:', backupId);
    } catch (err) {
      console.error('[useUploadRetry] Failed to remove backup:', err);
    }
  }, [removeBackup]);

  // Mark upload as failed
  const markUploadFailed = useCallback(async (
    backupId: string,
    error: string
  ): Promise<void> => {
    if (!backupId) return;
    
    try {
      await updateUploadStatus(backupId, 'failed', error);
      console.log('[useUploadRetry] Marked as failed:', backupId);
    } catch (err) {
      console.error('[useUploadRetry] Failed to update status:', err);
    }
  }, [updateUploadStatus]);

  // Retry failed uploads with exponential backoff
  const retryFailedUploads = useCallback(async (
    uploadFn: (upload: PendingUpload) => Promise<boolean>
  ): Promise<{ succeeded: number; failed: number }> => {
    const pending = await getPendingUploads();
    const failedUploads = pending.filter(
      u => u.status === 'failed' && u.retryCount < MAX_RETRIES
    );

    if (failedUploads.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    setRetryState(prev => ({
      ...prev,
      isRetrying: true,
      currentRetry: 0,
    }));

    let succeeded = 0;
    let failed = 0;

    for (const upload of failedUploads) {
      const retryCount = await incrementRetryCount(upload.id);
      
      setRetryState(prev => ({
        ...prev,
        currentRetry: retryCount,
      }));

      // Calculate backoff delay
      const delay = calculateBackoffDelay(retryCount - 1);
      
      setRetryState(prev => ({
        ...prev,
        nextRetryIn: delay,
      }));

      // Wait for backoff
      await new Promise(resolve => {
        retryTimeoutRef.current = setTimeout(resolve, delay);
      });

      setRetryState(prev => ({
        ...prev,
        nextRetryIn: null,
      }));

      try {
        // Mark as uploading
        await updateUploadStatus(upload.id, 'uploading');
        
        // Attempt upload
        const success = await uploadFn(upload);
        
        if (success) {
          await removeBackup(upload.id);
          succeeded++;
          console.log('[useUploadRetry] Retry succeeded:', upload.id);
        } else {
          await updateUploadStatus(upload.id, 'failed', 'Upload returned false');
          failed++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await updateUploadStatus(upload.id, 'failed', errorMsg);
        failed++;
        console.error('[useUploadRetry] Retry failed:', upload.id, err);
      }
    }

    setRetryState({
      isRetrying: false,
      currentRetry: 0,
      maxRetries: MAX_RETRIES,
      nextRetryIn: null,
    });

    return { succeeded, failed };
  }, [getPendingUploads, incrementRetryCount, updateUploadStatus, removeBackup]);

  return {
    retryState,
    backupBeforeUpload,
    markUploadSuccess,
    markUploadFailed,
    retryFailedUploads,
    getPendingUploads,
    pendingCount,
    clearAllBackups,
  };
};
