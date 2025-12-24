import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SortConfig, SelectedColumn, ColumnDefinition, getColumnLabel } from '../reportBuilderTypes';

interface SortingTabProps {
  sortConfigs: SortConfig[];
  selectedColumns: SelectedColumn[];
  availableColumns: ColumnDefinition[];
  onSortConfigsChange: (configs: SortConfig[]) => void;
}

export const SortingTab: React.FC<SortingTabProps> = ({
  sortConfigs,
  selectedColumns,
  availableColumns,
  onSortConfigsChange,
}) => {
  const { language, t } = useLanguage();

  const getColLabel = (columnKey: string): string => {
    const col = selectedColumns.find(c => c.key === columnKey) || availableColumns.find(c => c.key === columnKey);
    return col ? getColumnLabel(col, language) : columnKey;
  };

  const toggleDirection = (column: string) => {
    onSortConfigsChange(sortConfigs.map(sc =>
      sc.column === column
        ? { ...sc, direction: sc.direction === 'asc' ? 'desc' : 'asc' }
        : sc
    ));
  };

  const removeSort = (column: string) => {
    onSortConfigsChange(sortConfigs.filter(sc => sc.column !== column));
  };

  const addSort = (column: string, direction: 'asc' | 'desc') => {
    onSortConfigsChange([
      ...sortConfigs,
      { column, direction, priority: sortConfigs.length }
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{t('reportBuilder.sortingTitle')}</h4>
          <p className="text-sm text-muted-foreground">
            {t('reportBuilder.sortingDescription')}
          </p>
        </div>
      </div>

      {/* Active Sort Rules */}
      {sortConfigs.length > 0 && (
        <div className="space-y-2 mb-4">
          <Label className="text-sm font-medium">{t('reportBuilder.activeSortRules')}</Label>
          {sortConfigs.map((sortConfig, index) => {
            const col = selectedColumns.find(c => c.key === sortConfig.column) || availableColumns.find(c => c.key === sortConfig.column);
            return (
              <div
                key={sortConfig.column}
                className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="font-medium">{col ? getColumnLabel(col, language) : sortConfig.column}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDirection(sortConfig.column)}
                    className="h-8 gap-1"
                  >
                    {sortConfig.direction === 'asc' ? (
                      <><ChevronUp className="h-4 w-4" /> {t('reportBuilder.ascending')}</>
                    ) : (
                      <><ChevronDown className="h-4 w-4" /> {t('reportBuilder.descending')}</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSort(sortConfig.column)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Columns for Sorting */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('reportBuilder.addSortColumn')}</Label>
        <ScrollArea className="h-[250px] border rounded-lg">
          <div className="p-2 space-y-1">
            {selectedColumns
              .filter(col => !sortConfigs.find(sc => sc.column === col.key))
              .map((col) => (
                <div
                  key={col.key}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span>{getColumnLabel(col, language)}</span>
                    <Badge variant="outline" className="text-xs">{col.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addSort(col.key, 'asc')}
                      className="h-7 gap-1"
                    >
                      <ChevronUp className="h-3 w-3" />
                      {t('reportBuilder.asc')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addSort(col.key, 'desc')}
                      className="h-7 gap-1"
                    >
                      <ChevronDown className="h-3 w-3" />
                      {t('reportBuilder.desc')}
                    </Button>
                  </div>
                </div>
              ))}
            {selectedColumns.filter(col => !sortConfigs.find(sc => sc.column === col.key)).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t('reportBuilder.allColumnsSorted')}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
