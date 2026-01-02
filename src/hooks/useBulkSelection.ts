import { useState, useCallback, useMemo } from 'react';

interface UseBulkSelectionOptions<T> {
  /** Function to extract unique ID from item */
  getItemId: (item: T) => string;
  /** Items available for selection */
  items: T[];
}

interface UseBulkSelectionReturn<T> {
  /** Set of selected item IDs */
  selectedIds: Set<string>;
  /** Whether an item is selected */
  isSelected: (id: string) => boolean;
  /** Toggle selection for a single item */
  toggle: (id: string) => void;
  /** Select a single item (deselect others) */
  selectOne: (id: string) => void;
  /** Select multiple items */
  selectMultiple: (ids: string[]) => void;
  /** Select all items */
  selectAll: () => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Toggle select all */
  toggleAll: () => void;
  /** Clear selection */
  clear: () => void;
  /** Number of selected items */
  count: number;
  /** Whether all items are selected */
  allSelected: boolean;
  /** Whether some but not all items are selected */
  someSelected: boolean;
  /** Get selected items */
  getSelectedItems: () => T[];
  /** Whether bulk selection mode is active */
  isActive: boolean;
  /** Enable bulk selection mode */
  enable: () => void;
  /** Disable bulk selection mode */
  disable: () => void;
  /** Toggle bulk selection mode */
  toggleMode: () => void;
}

export function useBulkSelection<T>(
  options: UseBulkSelectionOptions<T>
): UseBulkSelectionReturn<T> {
  const { getItemId, items } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(false);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectOne = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = items.map(getItemId);
    setSelectedIds(new Set(allIds));
  }, [items, getItemId]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    const allIds = items.map(getItemId);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [items, getItemId, selectedIds.size]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const count = selectedIds.size;

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size]
  );

  const someSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < items.length,
    [selectedIds.size, items.length]
  );

  const getSelectedItems = useCallback(() => {
    return items.filter((item) => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  const enable = useCallback(() => {
    setIsActive(true);
  }, []);

  const disable = useCallback(() => {
    setIsActive(false);
    setSelectedIds(new Set());
  }, []);

  const toggleMode = useCallback(() => {
    setIsActive((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  return {
    selectedIds,
    isSelected,
    toggle,
    selectOne,
    selectMultiple,
    selectAll,
    deselectAll,
    toggleAll,
    clear,
    count,
    allSelected,
    someSelected,
    getSelectedItems,
    isActive,
    enable,
    disable,
    toggleMode,
  };
}
