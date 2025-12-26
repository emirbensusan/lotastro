import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface UseFormPersistenceOptions<T> {
  key: string;
  initialData: T;
  debounceMs?: number;
  onRestore?: (data: T) => void;
  excludeFields?: (keyof T)[];
}

interface UseFormPersistenceReturn<T> {
  data: T;
  setData: (data: T | ((prev: T) => T)) => void;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  clearDraft: () => void;
  hasDraft: boolean;
  restoreDraft: () => void;
  dismissDraft: () => void;
  lastSaved: Date | null;
}

const STORAGE_PREFIX = 'form_draft_';

export function useFormPersistence<T extends Record<string, any>>({
  key,
  initialData,
  debounceMs = 1000,
  onRestore,
  excludeFields = [],
}: UseFormPersistenceOptions<T>): UseFormPersistenceReturn<T> {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [data, setDataState] = useState<T>(initialData);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialCheckDone = useRef(false);

  // Check for existing draft on mount
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data && parsed.timestamp) {
          // Only show restore prompt if draft is less than 24 hours old
          const ageMs = Date.now() - parsed.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (ageMs < maxAge) {
            setHasDraft(true);
          } else {
            // Clean up old draft
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for draft:', error);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Debounced save to localStorage
  const saveDraft = useCallback((newData: T) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      try {
        // Filter out excluded fields
        const dataToSave = { ...newData };
        excludeFields.forEach(field => {
          delete dataToSave[field];
        });

        const storageData = {
          data: dataToSave,
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(storageData));
        setLastSaved(new Date());
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }, debounceMs);
  }, [storageKey, debounceMs, excludeFields]);

  const setData = useCallback((update: T | ((prev: T) => T)) => {
    setDataState(prev => {
      const newData = typeof update === 'function' ? update(prev) : update;
      saveDraft(newData);
      return newData;
    });
  }, [saveDraft]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, [setData]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSaved(null);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [storageKey]);

  const restoreDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data) {
          // Merge with initial data to ensure all fields exist
          const restoredData = { ...initialData, ...parsed.data };
          setDataState(restoredData);
          onRestore?.(restoredData);
          setHasDraft(false);
          toast({
            title: 'Draft Restored',
            description: 'Your previous work has been restored.',
          });
        }
      }
    } catch (error) {
      console.error('Error restoring draft:', error);
      toast({
        title: 'Error',
        description: 'Could not restore your draft.',
        variant: 'destructive',
      });
    }
  }, [storageKey, initialData, onRestore]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    toast({
      title: 'Draft Discarded',
      description: 'Starting with a fresh form.',
    });
  }, [clearDraft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    data,
    setData,
    updateField,
    clearDraft,
    hasDraft,
    restoreDraft,
    dismissDraft,
    lastSaved,
  };
}

// Component to show draft recovery prompt
export function DraftRecoveryBanner({
  onRestore,
  onDismiss,
}: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm">
          You have unsaved changes from a previous session.
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRestore}
          className="text-sm font-medium text-primary hover:underline"
        >
          Restore
        </button>
        <button
          onClick={onDismiss}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export default useFormPersistence;
