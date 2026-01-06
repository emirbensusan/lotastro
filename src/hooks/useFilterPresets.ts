import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export interface FilterPreset<T = Record<string, string>> {
  id: string;
  name: string;
  filters: T;
  createdAt: string;
  isDefault?: boolean;
}

interface UseFilterPresetsOptions<T> {
  /** Storage key for persisting presets */
  storageKey: string;
  /** Current filter values */
  currentFilters: T;
  /** Function to apply filters */
  onApplyFilters: (filters: T) => void;
}

interface UseFilterPresetsReturn<T> {
  /** List of saved presets */
  presets: FilterPreset<T>[];
  /** Currently active preset (if any) */
  activePreset: FilterPreset<T> | null;
  /** Save current filters as a new preset */
  savePreset: (name: string) => void;
  /** Load and apply a preset */
  loadPreset: (presetId: string) => void;
  /** Delete a preset */
  deletePreset: (presetId: string) => void;
  /** Rename a preset */
  renamePreset: (presetId: string, newName: string) => void;
  /** Set a preset as default */
  setDefaultPreset: (presetId: string | null) => void;
  /** Clear current filters */
  clearFilters: () => void;
  /** Check if current filters match any preset */
  hasUnsavedChanges: boolean;
  /** Get the default preset */
  defaultPreset: FilterPreset<T> | null;
}

export function useFilterPresets<T extends Record<string, string>>(
  options: UseFilterPresetsOptions<T>
): UseFilterPresetsReturn<T> {
  const { storageKey, currentFilters, onApplyFilters } = options;
  const { t } = useLanguage();
  const [presets, setPresets] = useState<FilterPreset<T>[]>([]);
  const [activePreset, setActivePreset] = useState<FilterPreset<T> | null>(null);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as FilterPreset<T>[];
        setPresets(parsed);
        
        // Auto-apply default preset if exists
        const defaultPreset = parsed.find((p) => p.isDefault);
        if (defaultPreset) {
          setActivePreset(defaultPreset);
          onApplyFilters(defaultPreset.filters);
        }
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error);
    }
  }, [storageKey]);

  // Persist presets to localStorage
  const persistPresets = useCallback(
    (newPresets: FilterPreset<T>[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newPresets));
        setPresets(newPresets);
      } catch (error) {
        console.error('Failed to save filter presets:', error);
        toast.error(String(t('filterPreset.saveError')));
      }
    },
    [storageKey, t]
  );

  const savePreset = useCallback(
    (name: string) => {
      const newPreset: FilterPreset<T> = {
        id: crypto.randomUUID(),
        name,
        filters: { ...currentFilters },
        createdAt: new Date().toISOString(),
      };
      
      const newPresets = [...presets, newPreset];
      persistPresets(newPresets);
      setActivePreset(newPreset);
      toast.success(String(t('filterPreset.saved', { name })));
    },
    [currentFilters, presets, persistPresets, t]
  );

  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        onApplyFilters(preset.filters);
        setActivePreset(preset);
        toast.success(String(t('filterPreset.loaded', { name: preset.name })));
      }
    },
    [presets, onApplyFilters, t]
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      const newPresets = presets.filter((p) => p.id !== presetId);
      persistPresets(newPresets);
      
      if (activePreset?.id === presetId) {
        setActivePreset(null);
      }
      
      if (preset) {
        toast.success(String(t('filterPreset.deleted', { name: preset.name })));
      }
    },
    [presets, activePreset, persistPresets, t]
  );

  const renamePreset = useCallback(
    (presetId: string, newName: string) => {
      const newPresets = presets.map((p) =>
        p.id === presetId ? { ...p, name: newName } : p
      );
      persistPresets(newPresets);
      
      if (activePreset?.id === presetId) {
        setActivePreset({ ...activePreset, name: newName });
      }
      
      toast.success(String(t('filterPreset.renamed')));
    },
    [presets, activePreset, persistPresets, t]
  );

  const setDefaultPreset = useCallback(
    (presetId: string | null) => {
      const newPresets = presets.map((p) => ({
        ...p,
        isDefault: p.id === presetId,
      }));
      persistPresets(newPresets);
      toast.success(presetId ? String(t('filterPreset.defaultSet')) : String(t('filterPreset.defaultCleared')));
    },
    [presets, persistPresets, t]
  );

  const clearFilters = useCallback(() => {
    const emptyFilters = Object.keys(currentFilters).reduce(
      (acc, key) => ({ ...acc, [key]: '' }),
      {} as T
    );
    onApplyFilters(emptyFilters);
    setActivePreset(null);
  }, [currentFilters, onApplyFilters]);

  // Check if current filters differ from active preset
  const hasUnsavedChanges = activePreset
    ? JSON.stringify(currentFilters) !== JSON.stringify(activePreset.filters)
    : Object.values(currentFilters).some((v) => v !== '');

  const defaultPreset = presets.find((p) => p.isDefault) || null;

  return {
    presets,
    activePreset,
    savePreset,
    loadPreset,
    deletePreset,
    renamePreset,
    setDefaultPreset,
    clearFilters,
    hasUnsavedChanges,
    defaultPreset,
  };
}
