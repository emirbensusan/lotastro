import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, Plus, X, Search, Columns, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ColumnDefinition, SelectedColumn, getColumnLabel } from '../reportBuilderTypes';

interface ColumnsTabProps {
  availableColumns: ColumnDefinition[];
  filteredAvailableColumns: ColumnDefinition[];
  selectedColumns: SelectedColumn[];
  columnSearch: string;
  onColumnSearchChange: (search: string) => void;
  onAddColumn: (column: ColumnDefinition) => void;
  onRemoveColumn: (columnKey: string) => void;
  onColumnSortToggle: (columnKey: string) => void;
  onReorderColumns: (columns: SelectedColumn[]) => void;
}

export const ColumnsTab: React.FC<ColumnsTabProps> = ({
  availableColumns,
  filteredAvailableColumns,
  selectedColumns,
  columnSearch,
  onColumnSearchChange,
  onAddColumn,
  onRemoveColumn,
  onColumnSortToggle,
  onReorderColumns,
}) => {
  const { language, t } = useLanguage();
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverIndex(null);
  };

  const handleDropOnSelected = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (!draggedColumn) return;

    // Check if dragging from available columns
    const fromAvailable = availableColumns.find(c => c.key === draggedColumn);

    if (fromAvailable && !selectedColumns.find(c => c.key === draggedColumn)) {
      // Add new column at target position
      const newColumn: SelectedColumn = { ...fromAvailable };
      const newSelected = [...selectedColumns];
      newSelected.splice(targetIndex, 0, newColumn);
      onReorderColumns(newSelected);
    } else {
      // Reorder existing columns
      const currentIndex = selectedColumns.findIndex(c => c.key === draggedColumn);
      if (currentIndex !== -1 && currentIndex !== targetIndex) {
        const newSelected = [...selectedColumns];
        const [removed] = newSelected.splice(currentIndex, 1);
        newSelected.splice(targetIndex > currentIndex ? targetIndex - 1 : targetIndex, 0, removed);
        onReorderColumns(newSelected);
      }
    }

    handleDragEnd();
  };

  return (
    <div className="grid grid-cols-2 gap-4 h-[400px]">
      {/* Available Columns */}
      <div className="border rounded-lg flex flex-col">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-medium text-sm">{t('reportBuilder.availableColumns')}</h4>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={columnSearch}
              onChange={(e) => onColumnSearchChange(e.target.value)}
              placeholder={String(t('reportBuilder.searchColumns'))}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredAvailableColumns.map((col) => {
              const isSelected = selectedColumns.some(c => c.key === col.key);
              return (
                <div
                  key={col.key}
                  draggable={!isSelected}
                  onDragStart={(e) => handleDragStart(e, col.key)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between p-2 rounded-md text-sm ${
                    isSelected
                      ? 'bg-muted text-muted-foreground'
                      : 'hover:bg-muted/50 cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!isSelected && <GripVertical className="h-4 w-4 text-muted-foreground" />}
                    <span>{getColumnLabel(col, language)}</span>
                    <Badge variant="outline" className="text-xs">
                      {col.type}
                    </Badge>
                  </div>
                  {!isSelected && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAddColumn(col)}
                      className="h-7 w-7 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Selected Columns */}
      <div className="border rounded-lg flex flex-col">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-medium text-sm">
            {t('reportBuilder.selectedColumns')} ({selectedColumns.length})
          </h4>
        </div>
        <ScrollArea className="flex-1">
          <div
            className="p-2 space-y-1 min-h-full"
            onDragOver={(e) => e.preventDefault()}
          >
            {selectedColumns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Columns className="h-8 w-8 mb-2" />
                <p className="text-sm">{t('reportBuilder.dragColumnsHere')}</p>
              </div>
            ) : (
              selectedColumns.map((col, index) => (
                <div
                  key={col.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.key)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDropOnSelected(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between p-2 rounded-md text-sm bg-primary/5 border ${
                    dragOverIndex === index ? 'border-primary' : 'border-transparent'
                  } cursor-grab active:cursor-grabbing`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{index + 1}.</span>
                    <span>{getColumnLabel(col, language)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onColumnSortToggle(col.key)}
                      className={`h-7 w-7 p-0 ${col.sortOrder ? 'text-primary' : ''}`}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveColumn(col.key)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {/* Drop zone at end */}
            {selectedColumns.length > 0 && (
              <div
                className={`p-2 border-2 border-dashed rounded-md text-center text-sm text-muted-foreground ${
                  draggedColumn && !selectedColumns.find(c => c.key === draggedColumn)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(selectedColumns.length);
                }}
                onDrop={(e) => handleDropOnSelected(e, selectedColumns.length)}
              >
                {t('reportBuilder.dropHere')}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
