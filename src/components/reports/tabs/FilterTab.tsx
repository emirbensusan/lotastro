import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { FilterBuilder, FilterGroup } from '../FilterBuilder';
import { ColumnDefinition } from '../reportBuilderTypes';

interface FilterTabProps {
  filters: FilterGroup[];
  availableColumns: ColumnDefinition[];
  onFiltersChange: (filters: FilterGroup[]) => void;
}

export const FilterTab: React.FC<FilterTabProps> = ({
  filters,
  availableColumns,
  onFiltersChange,
}) => {
  const { t } = useLanguage();

  // Convert ColumnDefinition to FilterBuilder's expected format
  const filterColumns = availableColumns.map(col => ({
    key: col.key,
    labelEn: col.labelEn,
    labelTr: col.labelTr,
    type: col.type as 'text' | 'number' | 'date' | 'currency' | 'boolean',
    table: col.table,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{t('reportBuilder.filterTitle')}</h4>
          <p className="text-sm text-muted-foreground">
            {t('reportBuilder.filterDescription')}
          </p>
        </div>
      </div>
      
      <FilterBuilder
        filters={filters}
        onChange={onFiltersChange}
        availableColumns={filterColumns}
      />
    </div>
  );
};
