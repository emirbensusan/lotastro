import React, { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Eye, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { ReportStyling } from './StyleBuilder';
import { FilterGroup } from './FilterBuilder';
import { CalculatedField } from './CalculatedFieldBuilder';

interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

interface SelectedColumn extends ColumnDefinition {
  displayLabel?: string;
  width?: number;
  sortOrder?: 'asc' | 'desc' | null;
  sortPriority?: number;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
  priority: number;
}

interface ReportPreviewProps {
  reportName: string;
  selectedColumns: SelectedColumn[];
  calculatedFields: CalculatedField[];
  styling: ReportStyling;
  sortConfigs: SortConfig[];
  filterGroups: FilterGroup[];
  includeCharts: boolean;
}

// Sample data generator based on column types
const generateSampleData = (columns: SelectedColumn[], calculatedFields: CalculatedField[], rowCount: number = 5) => {
  const sampleValues: Record<string, (index: number) => string | number> = {
    text: (i) => ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][i % 5],
    number: (i) => Math.floor(Math.random() * 1000) + 100 * (i + 1),
    currency: (i) => (Math.random() * 500 + 50).toFixed(2),
    date: (i) => {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);
      return date.toLocaleDateString();
    },
    boolean: (i) => i % 2 === 0 ? 'Yes' : 'No',
  };

  const qualityColors = [
    { quality: 'Q-001', color: 'Blue' },
    { quality: 'Q-002', color: 'Red' },
    { quality: 'Q-003', color: 'Green' },
    { quality: 'Q-004', color: 'Navy' },
    { quality: 'Q-005', color: 'Black' },
  ];

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, string | number> = {};
    
    columns.forEach((col) => {
      // Special handling for known column types
      if (col.key.toLowerCase().includes('quality')) {
        row[col.key] = qualityColors[rowIndex % 5].quality;
      } else if (col.key.toLowerCase().includes('color')) {
        row[col.key] = qualityColors[rowIndex % 5].color;
      } else if (col.key.toLowerCase().includes('meter') || col.key.toLowerCase().includes('amount')) {
        row[col.key] = Math.floor(Math.random() * 2000) + 500;
      } else if (col.key.toLowerCase().includes('roll')) {
        row[col.key] = Math.floor(Math.random() * 20) + 1;
      } else if (col.key.toLowerCase().includes('lot')) {
        row[col.key] = `LOT-${String(1000 + rowIndex).padStart(4, '0')}`;
      } else if (col.key.toLowerCase().includes('supplier')) {
        row[col.key] = ['Supplier A', 'Supplier B', 'Supplier C'][rowIndex % 3];
      } else {
        row[col.key] = sampleValues[col.type]?.(rowIndex) ?? `Value ${rowIndex + 1}`;
      }
    });

    // Add calculated fields with sample values
    calculatedFields.forEach((field) => {
      if (field.type === 'percentage_change') {
        row[field.id] = `${(Math.random() * 20 - 10).toFixed(1)}%`;
      } else if (field.type === 'difference') {
        row[field.id] = Math.floor(Math.random() * 500) - 250;
      } else if (field.type === 'ratio') {
        row[field.id] = (Math.random() * 2 + 0.5).toFixed(2);
      } else if (field.type === 'aggregation') {
        row[field.id] = Math.floor(Math.random() * 10000) + 1000;
      } else {
        row[field.id] = Math.floor(Math.random() * 1000);
      }
    });

    return row;
  });
};

// Check if a value matches a conditional rule
const matchesCondition = (value: string | number, operator: string, ruleValue: string): boolean => {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  const numRuleValue = parseFloat(ruleValue);

  switch (operator) {
    case 'equals':
      return String(value).toLowerCase() === ruleValue.toLowerCase();
    case 'not_equals':
      return String(value).toLowerCase() !== ruleValue.toLowerCase();
    case 'contains':
      return String(value).toLowerCase().includes(ruleValue.toLowerCase());
    case 'greater_than':
      return !isNaN(numValue) && !isNaN(numRuleValue) && numValue > numRuleValue;
    case 'less_than':
      return !isNaN(numValue) && !isNaN(numRuleValue) && numValue < numRuleValue;
    case 'is_empty':
      return value === '' || value === null || value === undefined;
    case 'is_true':
      return String(value) === 'true' || String(value) === 'Yes' || String(value) === '1';
    case 'is_false':
      return String(value) === 'false' || String(value) === 'No' || String(value) === '0';
    default:
      return false;
  }
};

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  reportName,
  selectedColumns,
  calculatedFields,
  styling,
  sortConfigs,
  filterGroups,
  includeCharts,
}) => {
  const { language } = useLanguage();

  const getColumnLabel = (col: SelectedColumn) => {
    return col.displayLabel || (language === 'tr' ? col.labelTr : col.labelEn);
  };

  const getCalcFieldLabel = (field: CalculatedField) => {
    return language === 'tr' ? field.labelTr : field.labelEn;
  };

  const sampleData = useMemo(() => {
    return generateSampleData(selectedColumns, calculatedFields, 5);
  }, [selectedColumns, calculatedFields]);

  const getCellStyle = (columnKey: string, value: string | number): React.CSSProperties => {
    // Check conditional rules
    for (const rule of styling.conditionalRules) {
      if (rule.column === columnKey && matchesCondition(value, rule.operator, rule.value)) {
        return {
          backgroundColor: rule.backgroundColor,
          color: rule.textColor,
          fontWeight: rule.fontWeight,
        };
      }
    }
    return {};
  };

  const getBorderWidth = () => {
    switch (styling.borderStyle) {
      case 'none': return 0;
      case 'light': return 1;
      case 'medium': return 2;
      case 'heavy': return 3;
      default: return 1;
    }
  };

  const getFontSize = () => {
    switch (styling.fontSize) {
      case 'small': return '12px';
      case 'large': return '16px';
      default: return '14px';
    }
  };

  if (selectedColumns.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <FileSpreadsheet className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">
          {language === 'tr' 
            ? 'Önizleme görmek için sütun ekleyin'
            : 'Add columns to see preview'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {language === 'tr' ? 'Canlı Önizleme' : 'Live Preview'}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          {language === 'tr' ? 'Örnek Veri' : 'Sample Data'}
        </Badge>
      </div>

      {/* Report Title */}
      <div className="p-3 border-b">
        <h3 className="font-semibold text-lg">
          {reportName || (language === 'tr' ? 'Başlıksız Rapor' : 'Untitled Report')}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{selectedColumns.length} {language === 'tr' ? 'sütun' : 'columns'}</span>
          {calculatedFields.length > 0 && (
            <>
              <span>•</span>
              <span>{calculatedFields.length} {language === 'tr' ? 'hesaplanan' : 'calculated'}</span>
            </>
          )}
          {filterGroups.length > 0 && (
            <>
              <span>•</span>
              <span>{filterGroups.reduce((sum, g) => sum + g.conditions.length, 0)} {language === 'tr' ? 'filtre' : 'filters'}</span>
            </>
          )}
          {sortConfigs.length > 0 && (
            <>
              <span>•</span>
              <span>{sortConfigs.length} {language === 'tr' ? 'sıralama' : 'sorts'}</span>
            </>
          )}
        </div>
      </div>

      {/* Active Filters Indicator */}
      {filterGroups.length > 0 && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b text-xs flex items-center gap-2">
          <AlertCircle className="h-3 w-3 text-blue-500" />
          <span className="text-blue-700 dark:text-blue-300">
            {language === 'tr' 
              ? `${filterGroups.reduce((sum, g) => sum + g.conditions.length, 0)} filtre aktif`
              : `${filterGroups.reduce((sum, g) => sum + g.conditions.length, 0)} filters active`
            }
          </span>
        </div>
      )}

      {/* Table Preview */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <div className="border rounded-lg overflow-hidden" style={{ fontSize: getFontSize() }}>
            <table className="w-full">
              <thead>
                <tr style={{
                  backgroundColor: styling.headerBackgroundColor,
                  color: styling.headerTextColor,
                  fontWeight: styling.headerFontWeight,
                }}>
                  {selectedColumns.map((col) => (
                    <th 
                      key={col.key} 
                      className="p-2 text-left whitespace-nowrap"
                      style={{
                        borderWidth: getBorderWidth(),
                        borderColor: '#e5e7eb',
                        borderStyle: 'solid',
                      }}
                    >
                      {getColumnLabel(col)}
                      {sortConfigs.find(s => s.column === col.key) && (
                        <span className="ml-1 opacity-75">
                          {sortConfigs.find(s => s.column === col.key)?.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                  ))}
                  {calculatedFields.map((field) => (
                    <th 
                      key={field.id} 
                      className="p-2 text-left whitespace-nowrap italic"
                      style={{
                        borderWidth: getBorderWidth(),
                        borderColor: '#e5e7eb',
                        borderStyle: 'solid',
                      }}
                    >
                      {getCalcFieldLabel(field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex}
                    style={{
                      backgroundColor: styling.alternateRowColors
                        ? (rowIndex % 2 === 0 ? styling.evenRowColor : styling.oddRowColor)
                        : styling.evenRowColor,
                    }}
                  >
                    {selectedColumns.map((col) => (
                      <td
                        key={col.key}
                        className="p-2 whitespace-nowrap"
                        style={{
                          borderWidth: getBorderWidth(),
                          borderColor: '#e5e7eb',
                          borderStyle: 'solid',
                          ...getCellStyle(col.key, row[col.key]),
                        }}
                      >
                        {col.type === 'currency' ? `$${row[col.key]}` : String(row[col.key])}
                      </td>
                    ))}
                    {calculatedFields.map((field) => (
                      <td
                        key={field.id}
                        className="p-2 whitespace-nowrap font-medium"
                        style={{
                          borderWidth: getBorderWidth(),
                          borderColor: '#e5e7eb',
                          borderStyle: 'solid',
                          ...getCellStyle(field.id, row[field.id]),
                        }}
                      >
                        {String(row[field.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart Placeholder */}
          {includeCharts && (
            <div className="mt-4 p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-full h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded mb-2 flex items-end justify-around px-4 pb-2">
                {[60, 85, 45, 70, 55, 90, 40].map((height, i) => (
                  <div 
                    key={i}
                    className="bg-primary/60 rounded-t w-6"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <p className="text-sm">
                {language === 'tr' ? 'Grafik buraya eklenecek' : 'Chart will appear here'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Conditional Formatting Legend */}
      {styling.conditionalRules.length > 0 && (
        <div className="p-3 border-t bg-muted/30">
          <p className="text-xs font-medium mb-2">
            {language === 'tr' ? 'Koşullu Biçimlendirme' : 'Conditional Formatting'}
          </p>
          <div className="flex flex-wrap gap-2">
            {styling.conditionalRules.map((rule, index) => {
              const column = selectedColumns.find(c => c.key === rule.column);
              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: rule.backgroundColor,
                    color: rule.textColor,
                    fontWeight: rule.fontWeight,
                  }}
                >
                  {column ? (language === 'tr' ? column.labelTr : column.labelEn) : rule.column}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPreview;
