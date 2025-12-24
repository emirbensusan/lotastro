import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, ArrowDown, X, MoveUp, MoveDown } from 'lucide-react';
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
    const filtered = sortConfigs.filter(sc => sc.column !== column);
    onSortConfigsChange(filtered.map((sc, idx) => ({ ...sc, priority: idx })));
  };

  const addSort = (column: string, direction: 'asc' | 'desc') => {
    onSortConfigsChange([
      ...sortConfigs,
      { column, direction, priority: sortConfigs.length }
    ]);
  };

  const moveSortUp = useCallback((index: number) => {
    if (index <= 0) return;
    const newConfigs = [...sortConfigs];
    [newConfigs[index - 1], newConfigs[index]] = [newConfigs[index], newConfigs[index - 1]];
    onSortConfigsChange(newConfigs.map((sc, idx) => ({ ...sc, priority: idx })));
  }, [sortConfigs, onSortConfigsChange]);

  const moveSortDown = useCallback((index: number) => {
    if (index >= sortConfigs.length - 1) return;
    const newConfigs = [...sortConfigs];
    [newConfigs[index], newConfigs[index + 1]] = [newConfigs[index + 1], newConfigs[index]];
    onSortConfigsChange(newConfigs.map((sc, idx) => ({ ...sc, priority: idx })));
  }, [sortConfigs, onSortConfigsChange]);

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

      {/* Explanation for hierarchical sorting */}
      {sortConfigs.length > 1 && (
        <div className="bg-muted/50 border rounded-lg p-3 text-sm">
          <p className="text-muted-foreground">
            {language === 'tr' 
              ? '🔢 Sıralama önceliği: Birinci kural uygulandıktan sonra, aynı değere sahip satırlar ikinci kurala göre sıralanır.'
              : '🔢 Sort priority: After the first rule is applied, rows with the same value are sorted by the second rule, and so on.'
            }
          </p>
        </div>
      )}

      {/* Active Sort Rules */}
      {sortConfigs.length > 0 && (
        <div className="space-y-2 mb-4">
          <Label className="text-sm font-medium">{t('reportBuilder.activeSortRules')}</Label>
          <div className="space-y-2">
            {sortConfigs.map((sortConfig, index) => {
              const col = selectedColumns.find(c => c.key === sortConfig.column) || availableColumns.find(c => c.key === sortConfig.column);
              return (
                <div
                  key={sortConfig.column}
                  className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSortUp(index)}
                        disabled={index === 0}
                        className="h-5 w-5 p-0"
                        title={language === 'tr' ? 'Önceliği artır' : 'Increase priority'}
                      >
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSortDown(index)}
                        disabled={index === sortConfigs.length - 1}
                        className="h-5 w-5 p-0"
                        title={language === 'tr' ? 'Önceliği azalt' : 'Decrease priority'}
                      >
                        <MoveDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {index + 1}
                    </Badge>
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
                        <><ArrowUp className="h-4 w-4" /> {t('reportBuilder.ascending')}</>
                      ) : (
                        <><ArrowDown className="h-4 w-4" /> {t('reportBuilder.descending')}</>
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
                      <ArrowUp className="h-3 w-3" />
                      A→Z
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addSort(col.key, 'desc')}
                      className="h-7 gap-1"
                    >
                      <ArrowDown className="h-3 w-3" />
                      Z→A
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

      {/* Summary */}
      {sortConfigs.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-3">
          {language === 'tr' 
            ? `Sıralama: ${sortConfigs.map((sc, i) => `${i + 1}. ${getColLabel(sc.column)} (${sc.direction === 'asc' ? 'A→Z' : 'Z→A'})`).join(' → ')}`
            : `Sort order: ${sortConfigs.map((sc, i) => `${i + 1}. ${getColLabel(sc.column)} (${sc.direction === 'asc' ? 'A→Z' : 'Z→A'})`).join(' → ')}`
          }
        </div>
      )}
    </div>
  );
};