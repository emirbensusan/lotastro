import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, X, Filter, GripVertical, Trash2 } from 'lucide-react';

interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

export interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  value2?: string; // For "between" operator
}

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

interface FilterBuilderProps {
  filters: FilterGroup[];
  onChange: (filters: FilterGroup[]) => void;
  availableColumns: ColumnDefinition[];
}

const TEXT_OPERATORS = [
  { key: 'equals', labelEn: 'Equals', labelTr: 'Eşittir' },
  { key: 'not_equals', labelEn: 'Not Equals', labelTr: 'Eşit Değil' },
  { key: 'contains', labelEn: 'Contains', labelTr: 'İçerir' },
  { key: 'not_contains', labelEn: 'Not Contains', labelTr: 'İçermez' },
  { key: 'starts_with', labelEn: 'Starts With', labelTr: 'İle Başlar' },
  { key: 'ends_with', labelEn: 'Ends With', labelTr: 'İle Biter' },
  { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
  { key: 'is_not_empty', labelEn: 'Is Not Empty', labelTr: 'Boş Değil' },
];

const NUMBER_OPERATORS = [
  { key: 'equals', labelEn: 'Equals', labelTr: 'Eşittir' },
  { key: 'not_equals', labelEn: 'Not Equals', labelTr: 'Eşit Değil' },
  { key: 'greater_than', labelEn: 'Greater Than', labelTr: 'Büyüktür' },
  { key: 'greater_or_equal', labelEn: 'Greater or Equal', labelTr: 'Büyük veya Eşit' },
  { key: 'less_than', labelEn: 'Less Than', labelTr: 'Küçüktür' },
  { key: 'less_or_equal', labelEn: 'Less or Equal', labelTr: 'Küçük veya Eşit' },
  { key: 'between', labelEn: 'Between', labelTr: 'Arasında' },
  { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
];

const DATE_OPERATORS = [
  { key: 'equals', labelEn: 'Equals', labelTr: 'Eşittir' },
  { key: 'before', labelEn: 'Before', labelTr: 'Önce' },
  { key: 'after', labelEn: 'After', labelTr: 'Sonra' },
  { key: 'between', labelEn: 'Between', labelTr: 'Arasında' },
  { key: 'last_n_days', labelEn: 'Last N Days', labelTr: 'Son N Gün' },
  { key: 'next_n_days', labelEn: 'Next N Days', labelTr: 'Sonraki N Gün' },
  { key: 'this_week', labelEn: 'This Week', labelTr: 'Bu Hafta' },
  { key: 'this_month', labelEn: 'This Month', labelTr: 'Bu Ay' },
  { key: 'this_year', labelEn: 'This Year', labelTr: 'Bu Yıl' },
  { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
];

const BOOLEAN_OPERATORS = [
  { key: 'is_true', labelEn: 'Is True', labelTr: 'Doğru' },
  { key: 'is_false', labelEn: 'Is False', labelTr: 'Yanlış' },
  { key: 'is_empty', labelEn: 'Is Empty', labelTr: 'Boş' },
];

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  filters,
  onChange,
  availableColumns,
}) => {
  const { language } = useLanguage();

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const getOperatorsForColumn = (columnKey: string) => {
    const column = availableColumns.find(c => c.key === columnKey);
    if (!column) return TEXT_OPERATORS;
    
    switch (column.type) {
      case 'number':
      case 'currency':
        return NUMBER_OPERATORS;
      case 'date':
        return DATE_OPERATORS;
      case 'boolean':
        return BOOLEAN_OPERATORS;
      default:
        return TEXT_OPERATORS;
    }
  };

  const getColumnLabel = (col: ColumnDefinition) => {
    return language === 'tr' ? col.labelTr : col.labelEn;
  };

  const getOperatorLabel = (operators: typeof TEXT_OPERATORS, key: string) => {
    const op = operators.find(o => o.key === key);
    if (!op) return key;
    return language === 'tr' ? op.labelTr : op.labelEn;
  };

  const addGroup = () => {
    const newGroup: FilterGroup = {
      id: generateId(),
      logic: 'AND',
      conditions: [],
    };
    onChange([...filters, newGroup]);
  };

  const removeGroup = (groupId: string) => {
    onChange(filters.filter(g => g.id !== groupId));
  };

  const updateGroupLogic = (groupId: string, logic: 'AND' | 'OR') => {
    onChange(filters.map(g => g.id === groupId ? { ...g, logic } : g));
  };

  const addCondition = (groupId: string) => {
    const firstColumn = availableColumns[0];
    const operators = getOperatorsForColumn(firstColumn?.key || '');
    const newCondition: FilterCondition = {
      id: generateId(),
      column: firstColumn?.key || '',
      operator: operators[0]?.key || 'equals',
      value: '',
    };
    onChange(filters.map(g => 
      g.id === groupId 
        ? { ...g, conditions: [...g.conditions, newCondition] }
        : g
    ));
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    onChange(filters.map(g => 
      g.id === groupId 
        ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
        : g
    ));
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    onChange(filters.map(g => 
      g.id === groupId 
        ? { 
            ...g, 
            conditions: g.conditions.map(c => 
              c.id === conditionId ? { ...c, ...updates } : c
            ) 
          }
        : g
    ));
  };

  const needsValue = (operator: string) => {
    return !['is_empty', 'is_not_empty', 'is_true', 'is_false', 'this_week', 'this_month', 'this_year'].includes(operator);
  };

  const needsSecondValue = (operator: string) => {
    return operator === 'between';
  };

  const getColumnType = (columnKey: string) => {
    return availableColumns.find(c => c.key === columnKey)?.type || 'text';
  };

  return (
    <div className="space-y-4">
      {filters.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Filter className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {language === 'tr' ? 'Henüz filtre eklenmedi' : 'No filters added yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'tr' ? 'Verileri filtrelemek için bir grup ekleyin' : 'Add a group to filter your data'}
          </p>
          <Button variant="outline" className="mt-4" onClick={addGroup}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'tr' ? 'Filtre Grubu Ekle' : 'Add Filter Group'}
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4 pr-4">
            {filters.map((group, groupIndex) => (
              <div key={group.id} className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">
                      {language === 'tr' ? `Grup ${groupIndex + 1}` : `Group ${groupIndex + 1}`}
                    </Badge>
                    {group.conditions.length > 1 && (
                      <Select
                        value={group.logic}
                        onValueChange={(val) => updateGroupLogic(group.id, val as 'AND' | 'OR')}
                      >
                        <SelectTrigger className="w-20 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGroup(group.id)}
                    className="h-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {group.conditions.map((condition, condIndex) => {
                    const operators = getOperatorsForColumn(condition.column);
                    const colType = getColumnType(condition.column);
                    
                    return (
                      <div key={condition.id} className="flex flex-wrap items-center gap-2 bg-background p-2 rounded-md">
                        {condIndex > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {group.logic}
                          </Badge>
                        )}
                        
                        {/* Column Select */}
                        <Select
                          value={condition.column}
                          onValueChange={(val) => {
                            const newOperators = getOperatorsForColumn(val);
                            updateCondition(group.id, condition.id, { 
                              column: val,
                              operator: newOperators[0]?.key || 'equals',
                              value: '',
                              value2: undefined
                            });
                          }}
                        >
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue placeholder={language === 'tr' ? 'Sütun Seç' : 'Select Column'} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map(col => (
                              <SelectItem key={col.key} value={col.key}>
                                {getColumnLabel(col)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Operator Select */}
                        <Select
                          value={condition.operator}
                          onValueChange={(val) => updateCondition(group.id, condition.id, { 
                            operator: val,
                            value2: needsSecondValue(val) ? '' : undefined
                          })}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map(op => (
                              <SelectItem key={op.key} value={op.key}>
                                {language === 'tr' ? op.labelTr : op.labelEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Value Input */}
                        {needsValue(condition.operator) && (
                          <>
                            <Input
                              type={colType === 'date' ? 'date' : colType === 'number' || colType === 'currency' ? 'number' : 'text'}
                              value={condition.value}
                              onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                              placeholder={language === 'tr' ? 'Değer' : 'Value'}
                              className="w-32 h-8"
                            />
                            
                            {needsSecondValue(condition.operator) && (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {language === 'tr' ? 've' : 'and'}
                                </span>
                                <Input
                                  type={colType === 'date' ? 'date' : colType === 'number' || colType === 'currency' ? 'number' : 'text'}
                                  value={condition.value2 || ''}
                                  onChange={(e) => updateCondition(group.id, condition.id, { value2: e.target.value })}
                                  placeholder={language === 'tr' ? 'Değer 2' : 'Value 2'}
                                  className="w-32 h-8"
                                />
                              </>
                            )}
                          </>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(group.id, condition.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => addCondition(group.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {language === 'tr' ? 'Koşul Ekle' : 'Add Condition'}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {filters.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'tr' ? 'Başka Grup Ekle' : 'Add Another Group'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {language === 'tr' 
              ? `${filters.reduce((sum, g) => sum + g.conditions.length, 0)} koşul, ${filters.length} grup`
              : `${filters.reduce((sum, g) => sum + g.conditions.length, 0)} conditions in ${filters.length} groups`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
