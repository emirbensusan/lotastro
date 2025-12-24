import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Search, Calendar, Hash, Type, ToggleLeft, DollarSign,
  Loader2, Columns, GripVertical, X, ArrowUpDown, Check, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

export interface SelectedColumn extends ColumnDefinition {
  sortOrder?: 'asc' | 'desc';
}

// Deduplicated column with table count
interface DeduplicatedColumn {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  tables: string[];
  primaryTable: string; // First table this column appears in
}

interface ColumnSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allColumns: ColumnDefinition[];
  selectedColumns: SelectedColumn[];
  onColumnsChange: (columns: SelectedColumn[]) => void;
  onValidateTables: (tables: string[]) => Promise<{ canJoin: boolean; error?: string }>;
  loading?: boolean;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  number: Hash,
  date: Calendar,
  currency: DollarSign,
  boolean: ToggleLeft,
};

const typeFilters = [
  { key: 'all', labelEn: 'All', labelTr: 'Tümü' },
  { key: 'text', labelEn: 'Text', labelTr: 'Metin' },
  { key: 'number', labelEn: 'Number', labelTr: 'Sayı' },
  { key: 'date', labelEn: 'Date', labelTr: 'Tarih' },
  { key: 'currency', labelEn: 'Currency', labelTr: 'Para' },
  { key: 'boolean', labelEn: 'Boolean', labelTr: 'Mantıksal' },
];

export const ColumnSelectorModal: React.FC<ColumnSelectorModalProps> = ({
  open,
  onOpenChange,
  allColumns,
  selectedColumns,
  onColumnsChange,
  onValidateTables,
  loading = false,
}) => {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [validationCache, setValidationCache] = useState<Record<string, { canJoin: boolean; error?: string }>>({});
  const [validatingColumns, setValidatingColumns] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [validatingAll, setValidatingAll] = useState(false);

  // Reset pending selections when modal opens
  useEffect(() => {
    if (open) {
      setPendingSelections(new Set(selectedColumns.map(c => `${c.table}.${c.key}`)));
      setValidationCache({});
      setValidatingAll(false);
    }
  }, [open, selectedColumns]);

  // Eager validation: validate all columns when selection changes
  useEffect(() => {
    if (!open) return;
    
    if (pendingSelections.size === 0) {
      setValidationCache({});
      setValidatingAll(false);
      return;
    }

    const validateAllColumns = async () => {
      setValidatingAll(true);
      
      // Get tables from currently pending selections
      const selectedTables = Array.from(pendingSelections).map(key => key.split('.')[0]);
      const uniqueSelectedTables = [...new Set(selectedTables)];
      
      // Get all unique tables from available columns
      const allTables = [...new Set(allColumns.map(c => c.table))];
      const tablesToValidate = allTables.filter(t => !uniqueSelectedTables.includes(t));
      
      const newCache: Record<string, { canJoin: boolean; error?: string }> = {};
      
      // Columns from selected tables are always compatible
      uniqueSelectedTables.forEach(table => {
        allColumns
          .filter(c => c.table === table)
          .forEach(c => {
            newCache[`${c.table}.${c.key}`] = { canJoin: true };
          });
      });
      
      // Validate each unselected table's compatibility by calling API with combined tables
      for (const table of tablesToValidate) {
        try {
          // Pass all selected tables + the candidate table to validate join path
          const result = await onValidateTables([...uniqueSelectedTables, table]);
          
          // Apply result to all columns in this table
          allColumns
            .filter(c => c.table === table)
            .forEach(c => {
              newCache[`${c.table}.${c.key}`] = result;
            });
        } catch (error) {
          // On error, mark as cannot join
          allColumns
            .filter(c => c.table === table)
            .forEach(c => {
              newCache[`${c.table}.${c.key}`] = { canJoin: false, error: 'Validation failed' };
            });
        }
      }
      
      setValidationCache(newCache);
      setValidatingAll(false);
    };

    validateAllColumns();
  }, [pendingSelections, open, allColumns, onValidateTables]);

  // Deduplicate columns by name (keeping track of which tables they appear in)
  const deduplicatedColumns = useMemo((): DeduplicatedColumn[] => {
    const columnMap = new Map<string, DeduplicatedColumn>();
    
    allColumns.forEach(col => {
      // Use labelEn as deduplication key
      const dedupeKey = `${col.labelEn.toLowerCase()}_${col.type}`;
      
      if (columnMap.has(dedupeKey)) {
        const existing = columnMap.get(dedupeKey)!;
        if (!existing.tables.includes(col.table)) {
          existing.tables.push(col.table);
        }
      } else {
        columnMap.set(dedupeKey, {
          key: col.key,
          labelEn: col.labelEn,
          labelTr: col.labelTr,
          type: col.type,
          tables: [col.table],
          primaryTable: col.table,
        });
      }
    });
    
    return Array.from(columnMap.values()).sort((a, b) => 
      a.labelEn.localeCompare(b.labelEn)
    );
  }, [allColumns]);

  // Filter columns by search and type
  const filteredColumns = useMemo(() => {
    let result = deduplicatedColumns;
    
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(col => 
        col.labelEn.toLowerCase().includes(searchLower) ||
        col.labelTr.toLowerCase().includes(searchLower) ||
        col.key.toLowerCase().includes(searchLower) ||
        col.tables.some(t => t.toLowerCase().includes(searchLower))
      );
    }
    
    if (typeFilter !== 'all') {
      result = result.filter(col => col.type === typeFilter);
    }
    
    return result;
  }, [deduplicatedColumns, search, typeFilter]);

  const getLabel = (item: { labelEn: string; labelTr: string }) => 
    language === 'tr' ? item.labelTr : item.labelEn;

  // Check if a column is selected (in pending selections)
  const isColumnPending = useCallback((col: DeduplicatedColumn) => {
    return col.tables.some(table => pendingSelections.has(`${table}.${col.key}`));
  }, [pendingSelections]);

  // Check if a column is already in selected (confirmed)
  const isColumnSelected = useCallback((col: DeduplicatedColumn) => {
    return selectedColumns.some(sc => col.tables.includes(sc.table) && sc.key === col.key);
  }, [selectedColumns]);

  // Check if a column can be joined (validation)
  const canColumnBeJoined = useCallback((col: DeduplicatedColumn): { canJoin: boolean; error?: string } => {
    // If no columns selected yet, all can be joined
    if (pendingSelections.size === 0) {
      return { canJoin: true };
    }
    
    // If this column is already pending, it can be "joined"
    if (isColumnPending(col)) {
      return { canJoin: true };
    }
    
    // Check validation cache
    const cacheKey = `${col.primaryTable}.${col.key}`;
    if (validationCache[cacheKey]) {
      return validationCache[cacheKey];
    }
    
    // Not yet validated - return uncertain state
    return { canJoin: true }; // Default to true, will be validated on hover/click
  }, [pendingSelections, isColumnPending, validationCache]);

  // Validate a column on hover
  const validateColumnOnHover = useCallback(async (col: DeduplicatedColumn) => {
    const cacheKey = `${col.primaryTable}.${col.key}`;
    
    // Skip if already cached or currently validating
    if (validationCache[cacheKey] || validatingColumns.has(cacheKey)) {
      return;
    }
    
    // Skip if no columns selected yet
    if (pendingSelections.size === 0) {
      return;
    }
    
    // Skip if already pending
    if (isColumnPending(col)) {
      return;
    }
    
    setValidatingColumns(prev => new Set(prev).add(cacheKey));
    
    try {
      // Get tables from pending selections and add candidate table
      const selectedTables = Array.from(pendingSelections).map(key => key.split('.')[0]);
      const uniqueSelectedTables = [...new Set(selectedTables)];
      
      const result = await onValidateTables([...uniqueSelectedTables, col.primaryTable]);
      
      setValidationCache(prev => ({
        ...prev,
        [cacheKey]: result,
      }));
    } finally {
      setValidatingColumns(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [pendingSelections, isColumnPending, validationCache, validatingColumns, onValidateTables]);

  // Toggle column selection
  const toggleColumn = useCallback(async (col: DeduplicatedColumn) => {
    const cacheKey = `${col.primaryTable}.${col.key}`;
    const fullKey = `${col.primaryTable}.${col.key}`;
    
    // Check if already pending
    const currentlyPending = isColumnPending(col);
    
    if (currentlyPending) {
      // Remove from pending
      setPendingSelections(prev => {
        const next = new Set(prev);
        col.tables.forEach(table => next.delete(`${table}.${col.key}`));
        return next;
      });
      // Clear validation cache since selection changed
      setValidationCache({});
    } else {
      // Check if can be joined
      const validation = canColumnBeJoined(col);
      
      if (!validation.canJoin) {
        return; // Cannot select
      }
      
      // If not yet validated, validate first
      if (!validationCache[cacheKey] && pendingSelections.size > 0) {
        setValidatingColumns(prev => new Set(prev).add(cacheKey));
        try {
          // Get tables from pending selections and add candidate table
          const selectedTables = Array.from(pendingSelections).map(key => key.split('.')[0]);
          const uniqueSelectedTables = [...new Set(selectedTables)];
          
          const result = await onValidateTables([...uniqueSelectedTables, col.primaryTable]);
          
          setValidationCache(prev => ({
            ...prev,
            [cacheKey]: result,
          }));
          
          if (!result.canJoin) {
            return; // Cannot select
          }
        } finally {
          setValidatingColumns(prev => {
            const next = new Set(prev);
            next.delete(cacheKey);
            return next;
          });
        }
      }
      
      // Add to pending
      setPendingSelections(prev => new Set(prev).add(fullKey));
    }
  }, [isColumnPending, canColumnBeJoined, validationCache, pendingSelections, onValidateTables]);

  // Handle adding selected columns
  const handleAddSelected = useCallback(() => {
    const newColumns: SelectedColumn[] = [];
    
    pendingSelections.forEach(key => {
      const [table, ...keyParts] = key.split('.');
      const colKey = keyParts.join('.');
      
      // Find the original column
      const originalCol = allColumns.find(c => c.table === table && c.key === colKey);
      if (originalCol && !selectedColumns.find(sc => sc.table === table && sc.key === colKey)) {
        newColumns.push({
          ...originalCol,
        });
      }
    });
    
    // Keep existing columns that are still in pending, add new ones
    const updatedColumns = selectedColumns.filter(sc => 
      pendingSelections.has(`${sc.table}.${sc.key}`)
    );
    
    // Add new columns that weren't in selected before
    newColumns.forEach(nc => {
      if (!updatedColumns.find(uc => uc.table === nc.table && uc.key === nc.key)) {
        updatedColumns.push(nc);
      }
    });
    
    onColumnsChange(updatedColumns);
    onOpenChange(false);
  }, [pendingSelections, allColumns, selectedColumns, onColumnsChange, onOpenChange]);

  // Handle removing a column from selected panel
  const handleRemoveFromSelected = useCallback((col: SelectedColumn) => {
    setPendingSelections(prev => {
      const next = new Set(prev);
      next.delete(`${col.table}.${col.key}`);
      return next;
    });
  }, []);

  // Handle reordering in selected panel
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const pendingArray = Array.from(pendingSelections);
      const [removed] = pendingArray.splice(draggedIndex, 1);
      pendingArray.splice(dragOverIndex > draggedIndex ? dragOverIndex - 1 : dragOverIndex, 0, removed);
      setPendingSelections(new Set(pendingArray));
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, pendingSelections]);

  // Toggle sort on a selected column
  const handleSortToggle = useCallback((key: string) => {
    const newColumns = selectedColumns.map(col => {
      if (`${col.table}.${col.key}` !== key) return col;
      const currentSort = col.sortOrder;
      let newSort: 'asc' | 'desc' | undefined;
      if (!currentSort) newSort = 'asc';
      else if (currentSort === 'asc') newSort = 'desc';
      else newSort = undefined;
      return { ...col, sortOrder: newSort };
    });
    onColumnsChange(newColumns);
  }, [selectedColumns, onColumnsChange]);

  // Get pending columns as array for display
  const pendingColumnsArray = useMemo(() => {
    return Array.from(pendingSelections).map(key => {
      const [table, ...keyParts] = key.split('.');
      const colKey = keyParts.join('.');
      const originalCol = allColumns.find(c => c.table === table && c.key === colKey);
      return originalCol ? { ...originalCol, fullKey: key } : null;
    }).filter(Boolean) as (ColumnDefinition & { fullKey: string })[];
  }, [pendingSelections, allColumns]);

  const TypeIcon = (type: string) => typeIcons[type] || Type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] sm:h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {language === 'tr' ? 'Sütun Seç' : 'Select Columns'}
          </DialogTitle>
          <DialogDescription>
            {language === 'tr' 
              ? 'Rapora eklemek istediğiniz sütunları seçin. Uyumsuz sütunlar gri olarak gösterilir.'
              : 'Select columns to add to your report. Incompatible columns are shown in gray.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* Available Columns Panel */}
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            {/* Search and Filters */}
            <div className="p-3 border-b bg-muted/50 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={language === 'tr' ? 'Sütun ara...' : 'Search columns...'}
                  className="pl-8 h-9"
                />
              </div>
              
              {/* Type Filters */}
              <div className="flex flex-wrap gap-1">
                {typeFilters.map(filter => (
                  <Button
                    key={filter.key}
                    variant={typeFilter === filter.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTypeFilter(filter.key)}
                  >
                    {getLabel(filter)}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Column Grid */}
            <ScrollArea className="flex-1">
              <div className="p-3">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredColumns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Columns className="h-8 w-8 mb-2" />
                    <p className="text-sm">
                      {language === 'tr' ? 'Sütun bulunamadı' : 'No columns found'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    <TooltipProvider delayDuration={200}>
                      {filteredColumns.map((col) => {
                        const isPending = isColumnPending(col);
                        const cacheKey = `${col.primaryTable}.${col.key}`;
                        const cachedValidation = validationCache[cacheKey];
                        const isValidating = validatingAll || validatingColumns.has(cacheKey);
                        // Column is disabled if:
                        // 1. There are pending selections AND
                        // 2. This column isn't pending AND
                        // 3. Either: still validating OR not yet validated OR explicitly cannot join
                        const isDisabled = pendingSelections.size > 0 && 
                          !isPending && 
                          (isValidating || !cachedValidation || cachedValidation.canJoin === false);
                        const isIncompatible = cachedValidation?.canJoin === false;
                        const Icon = TypeIcon(col.type);
                        
                        return (
                          <Tooltip key={`${col.primaryTable}.${col.key}`}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => !isDisabled && toggleColumn(col)}
                                onMouseEnter={() => !isDisabled && validateColumnOnHover(col)}
                                disabled={isDisabled}
                                className={cn(
                                  "relative flex flex-col items-start p-2 rounded-md border text-left transition-all",
                                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                                  isPending 
                                    ? "bg-primary/10 border-primary ring-1 ring-primary/50 hover:shadow-sm" 
                                    : isDisabled
                                      ? isIncompatible
                                        ? "bg-destructive/5 border-destructive/30 text-muted-foreground cursor-not-allowed opacity-50" // Incompatible
                                        : "bg-muted/30 border-muted text-muted-foreground cursor-wait opacity-60" // Still loading
                                      : "bg-card border-border hover:bg-accent/50 hover:shadow-sm"
                                )}
                              >
                                {/* Selection indicator */}
                                {isPending && (
                                  <div className="absolute top-1 right-1">
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                )}
                                
                                {/* Type icon and label */}
                                <div className="flex items-center gap-1.5 w-full">
                                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="text-xs font-medium truncate flex-1 pr-4">
                                    {getLabel(col)}
                                  </span>
                                </div>
                                
                                {/* Table count badge */}
                                {col.tables.length > 1 && (
                                  <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1">
                                    {col.tables.length} {language === 'tr' ? 'tablo' : 'tables'}
                                  </Badge>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              {isDisabled ? (
                                <p className="text-destructive">
                                  {cachedValidation?.error || (language === 'tr' ? 'Bu sütun seçili sütunlarla birleştirilemez' : 'This column cannot be joined with selected columns')}
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  <p className="font-medium">{getLabel(col)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'tr' ? 'Tip' : 'Type'}: {col.type}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'tr' ? 'Tablolar' : 'Tables'}: {col.tables.join(', ')}
                                  </p>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Selected Columns Sidebar */}
          <div className="w-72 shrink-0 flex flex-col border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">
                    {language === 'tr' ? 'Seçili Sütunlar' : 'Selected Columns'}
                  </h4>
                  <Badge variant="secondary">{pendingColumnsArray.length}</Badge>
                </div>
                {pendingColumnsArray.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setPendingSelections(new Set());
                      setValidationCache({});
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    {language === 'tr' ? 'Temizle' : 'Clear'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'tr' ? 'Sıralamak için sürükleyin' : 'Drag to reorder'}
              </p>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {pendingColumnsArray.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Columns className="h-6 w-6 mb-2" />
                    <p className="text-xs text-center">
                      {language === 'tr' ? 'Henüz sütun seçilmedi' : 'No columns selected yet'}
                    </p>
                  </div>
                ) : (
                  pendingColumnsArray.map((col, index) => {
                    const Icon = TypeIcon(col.type);
                    const selectedCol = selectedColumns.find(sc => sc.table === col.table && sc.key === col.key);
                    
                    return (
                      <div
                        key={col.fullKey}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md text-sm bg-primary/5 border transition-all group",
                          dragOverIndex === index ? "border-primary shadow-sm" : "border-transparent",
                          draggedIndex === index && "opacity-50",
                          "cursor-grab active:cursor-grabbing"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-muted-foreground w-5">{index + 1}.</span>
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-xs font-medium">{getLabel(col)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => selectedCol && handleSortToggle(col.fullKey)}
                          className={cn(
                            "h-5 w-5 p-0",
                            selectedCol?.sortOrder ? "text-primary" : "opacity-0 group-hover:opacity-100"
                          )}
                        >
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFromSelected(col as SelectedColumn)}
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'tr' ? 'İptal' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleAddSelected}
            disabled={pendingColumnsArray.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            {language === 'tr' 
              ? `${pendingColumnsArray.length} Sütun Ekle` 
              : `Add ${pendingColumnsArray.length} Columns`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnSelectorModal;
