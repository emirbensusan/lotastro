import React, { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, ChevronDown, ChevronRight, Plus, GripVertical, X, 
  Calendar, Hash, Type, ToggleLeft, DollarSign,
  AlertCircle, Loader2, Columns, ArrowUpDown
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

export interface TableDefinition {
  table: string;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  columns: ColumnDefinition[];
  columnCount: number;
}

interface ColumnBrowserGridProps {
  tables: TableDefinition[];
  selectedColumns: SelectedColumn[];
  onColumnAdd: (column: ColumnDefinition) => void;
  onColumnRemove: (columnKey: string) => void;
  onReorderColumns: (columns: SelectedColumn[]) => void;
  onColumnSortToggle: (columnKey: string) => void;
  onValidateColumn: (column: ColumnDefinition) => Promise<{ canJoin: boolean; error?: string }>;
  validationErrors: Record<string, string>;
  loading?: boolean;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  number: Hash,
  date: Calendar,
  currency: DollarSign,
  boolean: ToggleLeft,
};

export const ColumnBrowserGrid: React.FC<ColumnBrowserGridProps> = ({
  tables,
  selectedColumns,
  onColumnAdd,
  onColumnRemove,
  onReorderColumns,
  onColumnSortToggle,
  onValidateColumn,
  validationErrors,
  loading = false,
}) => {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [validatingColumn, setValidatingColumn] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragValidation, setDragValidation] = useState<{ canJoin: boolean; error?: string } | null>(null);

  // Filter columns by search
  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    
    const searchLower = search.toLowerCase();
    return tables.map(table => {
      const filteredColumns = table.columns.filter(col => {
        const label = language === 'tr' ? col.labelTr : col.labelEn;
        return (
          label.toLowerCase().includes(searchLower) ||
          col.key.toLowerCase().includes(searchLower) ||
          table.table.toLowerCase().includes(searchLower)
        );
      });
      return { ...table, columns: filteredColumns };
    }).filter(table => table.columns.length > 0);
  }, [tables, search, language]);

  const toggleTable = useCallback((table: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) {
        next.delete(table);
      } else {
        next.add(table);
      }
      return next;
    });
  }, []);

  const isColumnSelected = useCallback((column: ColumnDefinition) => {
    return selectedColumns.some(c => c.key === column.key && c.table === column.table);
  }, [selectedColumns]);

  const getColumnError = useCallback((column: ColumnDefinition) => {
    return validationErrors[`${column.table}.${column.key}`];
  }, [validationErrors]);

  // Handle adding column from available panel
  const handleAddColumn = useCallback(async (column: ColumnDefinition) => {
    if (isColumnSelected(column)) return;

    setValidatingColumn(`${column.table}.${column.key}`);
    try {
      const result = await onValidateColumn(column);
      if (result.canJoin) {
        onColumnAdd(column);
      }
    } finally {
      setValidatingColumn(null);
    }
  }, [isColumnSelected, onValidateColumn, onColumnAdd]);

  // Drag from available columns
  const handleDragStartFromAvailable = useCallback(async (e: React.DragEvent, column: ColumnDefinition) => {
    if (isColumnSelected(column)) return;
    
    setDraggedColumn(`${column.table}.${column.key}`);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('column', JSON.stringify(column));
    
    // Validate on drag start
    const result = await onValidateColumn(column);
    setDragValidation(result);
  }, [isColumnSelected, onValidateColumn]);

  // Drag from selected columns (for reordering)
  const handleDragStartFromSelected = useCallback((e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('reorder', columnKey);
    setDragValidation({ canJoin: true });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragValidation?.canJoin !== false) {
      setDragOverIndex(index);
    }
  }, [dragValidation]);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverIndex(null);
    setDragValidation(null);
  }, []);

  const handleDropOnSelected = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    const reorderKey = e.dataTransfer.getData('reorder');
    const columnData = e.dataTransfer.getData('column');

    if (reorderKey) {
      // Reordering existing columns
      const currentIndex = selectedColumns.findIndex(c => c.key === reorderKey);
      if (currentIndex !== -1 && currentIndex !== targetIndex) {
        const newSelected = [...selectedColumns];
        const [removed] = newSelected.splice(currentIndex, 1);
        newSelected.splice(targetIndex > currentIndex ? targetIndex - 1 : targetIndex, 0, removed);
        onReorderColumns(newSelected);
      }
    } else if (columnData && dragValidation?.canJoin) {
      // Adding new column from available
      const column = JSON.parse(columnData) as ColumnDefinition;
      if (!selectedColumns.find(c => c.key === column.key)) {
        const newColumn: SelectedColumn = { ...column };
        const newSelected = [...selectedColumns];
        newSelected.splice(targetIndex, 0, newColumn);
        onReorderColumns(newSelected);
      }
    }

    handleDragEnd();
  }, [selectedColumns, dragValidation, onReorderColumns, handleDragEnd]);

  const getLabel = (item: { labelEn: string; labelTr: string }) => 
    language === 'tr' ? item.labelTr : item.labelEn;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-[450px]">
      {/* Available Columns Panel */}
      <div className="border rounded-lg flex flex-col">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-medium text-sm mb-2">
            {language === 'tr' ? 'Kullanılabilir Sütunlar' : 'Available Columns'}
          </h4>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'tr' ? 'Sütun veya tablo ara...' : 'Search columns or tables...'}
              className="pl-8 h-9"
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredTables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Columns className="h-8 w-8 mb-2" />
                <p className="text-sm">
                  {tables.length === 0
                    ? (language === 'tr' ? 'Şema yükleniyor...' : 'Loading schema...')
                    : (language === 'tr' ? 'Sütun bulunamadı' : 'No columns found')
                  }
                </p>
              </div>
            ) : (
              filteredTables.map((table) => {
                const isExpanded = expandedTables.has(table.table);
                const selectedCount = selectedColumns.filter(c => c.table === table.table).length;
                
                return (
                  <Collapsible key={table.table} open={isExpanded} onOpenChange={() => toggleTable(table.table)}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start px-2 py-2 h-auto",
                          selectedCount > 0 && "bg-primary/5"
                        )}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-2 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2 shrink-0" />
                        )}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getLabel(table)}</span>
                            <Badge variant="outline" className="text-xs">
                              {table.columnCount}
                            </Badge>
                            {selectedCount > 0 && (
                              <Badge variant="default" className="text-xs">
                                {selectedCount} {language === 'tr' ? 'seçili' : 'selected'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-normal truncate">
                            {language === 'tr' ? table.descriptionTr : table.descriptionEn}
                          </p>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-2 border-l space-y-0.5 py-1">
                        {table.columns.map((column) => {
                          const selected = isColumnSelected(column);
                          const error = getColumnError(column);
                          const isValidating = validatingColumn === `${column.table}.${column.key}`;
                          const isDragging = draggedColumn === `${column.table}.${column.key}`;
                          const TypeIcon = typeIcons[column.type] || Type;
                          
                          return (
                            <div
                              key={`${column.table}.${column.key}`}
                              draggable={!selected && !isValidating}
                              onDragStart={(e) => handleDragStartFromAvailable(e, column)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group",
                                selected 
                                  ? "bg-muted text-muted-foreground cursor-default" 
                                  : error 
                                    ? "bg-destructive/10 text-destructive cursor-not-allowed"
                                    : "hover:bg-muted/50 cursor-grab active:cursor-grabbing",
                                isDragging && "opacity-50",
                                isValidating && "opacity-50 cursor-wait"
                              )}
                            >
                              {!selected && !isValidating && (
                                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                              )}
                              {isValidating && (
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              )}
                              {error && !isValidating && (
                                <AlertCircle className="h-4 w-4 shrink-0" />
                              )}
                              <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate">{getLabel(column)}</span>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {column.type}
                              </Badge>
                              {!selected && !isValidating && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAddColumn(column)}
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Selected Columns Panel */}
      <div className="border rounded-lg flex flex-col">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-medium text-sm">
            {language === 'tr' ? 'Seçili Sütunlar' : 'Selected Columns'} ({selectedColumns.length})
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'tr' ? 'Sıralamak için sürükleyin' : 'Drag to reorder'}
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div
            className="p-2 space-y-1 min-h-full"
            onDragOver={(e) => e.preventDefault()}
          >
            {selectedColumns.length === 0 ? (
              <div 
                className={cn(
                  "flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg transition-colors",
                  draggedColumn && dragValidation?.canJoin && "border-primary bg-primary/5",
                  draggedColumn && !dragValidation?.canJoin && "border-destructive bg-destructive/5"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(0);
                }}
                onDrop={(e) => handleDropOnSelected(e, 0)}
              >
                <Columns className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {draggedColumn 
                    ? (dragValidation?.canJoin 
                        ? (language === 'tr' ? 'Buraya bırakın' : 'Drop here')
                        : (dragValidation?.error || (language === 'tr' ? 'Bu sütun eklenemez' : 'Cannot add this column'))
                      )
                    : (language === 'tr' ? 'Sütunları sürükleyip buraya bırakın' : 'Drag columns and drop them here')
                  }
                </p>
              </div>
            ) : (
              <>
                {selectedColumns.map((col, index) => {
                  const TypeIcon = typeIcons[col.type] || Type;
                  const isDragging = draggedColumn === col.key;
                  
                  return (
                    <div
                      key={col.key}
                      draggable
                      onDragStart={(e) => handleDragStartFromSelected(e, col.key)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDropOnSelected(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md text-sm bg-primary/5 border transition-all",
                        dragOverIndex === index ? "border-primary shadow-sm" : "border-transparent",
                        isDragging && "opacity-50",
                        "cursor-grab active:cursor-grabbing group"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-muted-foreground w-5">{index + 1}.</span>
                      <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate font-medium">{getLabel(col)}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {col.table}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onColumnSortToggle(col.key)}
                        className={cn(
                          "h-6 w-6 p-0",
                          col.sortOrder ? "text-primary" : "opacity-0 group-hover:opacity-100"
                        )}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onColumnRemove(col.key)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                
                {/* Drop zone at end */}
                <div
                  className={cn(
                    "p-3 border-2 border-dashed rounded-md text-center text-sm text-muted-foreground transition-colors",
                    draggedColumn && dragValidation?.canJoin 
                      ? "border-primary bg-primary/5" 
                      : draggedColumn && !dragValidation?.canJoin
                        ? "border-destructive bg-destructive/5"
                        : "border-muted"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(selectedColumns.length);
                  }}
                  onDrop={(e) => handleDropOnSelected(e, selectedColumns.length)}
                >
                  {draggedColumn && !dragValidation?.canJoin
                    ? (dragValidation?.error || (language === 'tr' ? 'Bu sütun eklenemez' : 'Cannot add this column'))
                    : (language === 'tr' ? 'Buraya bırakın' : 'Drop here')
                  }
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};