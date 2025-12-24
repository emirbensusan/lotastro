import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Calculator, TrendingUp, TrendingDown, Minus, Percent, 
  Calendar, Hash, Save, Plus
} from 'lucide-react';

export interface CalculatedField {
  id: string;
  name: string;
  labelEn: string;
  labelTr: string;
  type: 'percentage_change' | 'difference' | 'ratio' | 'period_comparison' | 'aggregation' | 'trend';
  config: {
    sourceColumn?: string;
    compareColumn?: string;
    operation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    period?: 'week' | 'month' | 'quarter' | 'year';
    format?: 'percentage' | 'number' | 'trend_arrow';
  };
}

interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

interface CalculatedFieldBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (field: CalculatedField) => void;
  availableColumns: ColumnDefinition[];
  editingField?: CalculatedField | null;
}

const CALCULATION_TYPES = [
  { 
    key: 'percentage_change', 
    labelEn: 'Percentage Change', 
    labelTr: 'Yüzde Değişim',
    descriptionEn: 'Calculate % change between two columns',
    descriptionTr: 'İki sütun arasındaki % değişimi hesapla',
    icon: Percent,
    requiresColumns: 2,
  },
  { 
    key: 'difference', 
    labelEn: 'Difference', 
    labelTr: 'Fark',
    descriptionEn: 'Subtract one column from another',
    descriptionTr: 'Bir sütunu diğerinden çıkar',
    icon: Minus,
    requiresColumns: 2,
  },
  { 
    key: 'ratio', 
    labelEn: 'Ratio', 
    labelTr: 'Oran',
    descriptionEn: 'Divide one column by another',
    descriptionTr: 'Bir sütunu diğerine böl',
    icon: Hash,
    requiresColumns: 2,
  },
  { 
    key: 'period_comparison', 
    labelEn: 'Period Comparison', 
    labelTr: 'Dönem Karşılaştırma',
    descriptionEn: 'Compare with previous period (week/month/quarter)',
    descriptionTr: 'Önceki dönemle karşılaştır (hafta/ay/çeyrek)',
    icon: Calendar,
    requiresColumns: 1,
  },
  { 
    key: 'aggregation', 
    labelEn: 'Aggregation', 
    labelTr: 'Toplama',
    descriptionEn: 'SUM, AVG, COUNT, MIN, MAX operations',
    descriptionTr: 'TOPLAM, ORT, SAYI, MİN, MAKS işlemleri',
    icon: Calculator,
    requiresColumns: 1,
  },
  { 
    key: 'trend', 
    labelEn: 'Trend Indicator', 
    labelTr: 'Trend Göstergesi',
    descriptionEn: 'Show ↑ ↓ → based on comparison',
    descriptionTr: 'Karşılaştırmaya göre ↑ ↓ → göster',
    icon: TrendingUp,
    requiresColumns: 2,
  },
];

const AGGREGATION_OPERATIONS = [
  { key: 'sum', labelEn: 'Sum', labelTr: 'Toplam' },
  { key: 'avg', labelEn: 'Average', labelTr: 'Ortalama' },
  { key: 'count', labelEn: 'Count', labelTr: 'Sayı' },
  { key: 'min', labelEn: 'Minimum', labelTr: 'Minimum' },
  { key: 'max', labelEn: 'Maximum', labelTr: 'Maksimum' },
];

const COMPARISON_PERIODS = [
  { key: 'week', labelEn: 'Previous Week', labelTr: 'Önceki Hafta' },
  { key: 'month', labelEn: 'Previous Month', labelTr: 'Önceki Ay' },
  { key: 'quarter', labelEn: 'Previous Quarter', labelTr: 'Önceki Çeyrek' },
  { key: 'year', labelEn: 'Previous Year', labelTr: 'Önceki Yıl' },
];

export const CalculatedFieldBuilder: React.FC<CalculatedFieldBuilderProps> = ({
  open,
  onClose,
  onSave,
  availableColumns,
  editingField,
}) => {
  const { language, t } = useLanguage();
  
  const [fieldName, setFieldName] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelTr, setLabelTr] = useState('');
  const [calcType, setCalcType] = useState<CalculatedField['type']>('percentage_change');
  const [sourceColumn, setSourceColumn] = useState('');
  const [compareColumn, setCompareColumn] = useState('');
  const [operation, setOperation] = useState<'sum' | 'avg' | 'count' | 'min' | 'max'>('sum');
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Filter to only show numeric columns for calculations
  const numericColumns = availableColumns.filter(c => 
    c.type === 'number' || c.type === 'currency'
  );

  useEffect(() => {
    if (editingField) {
      setFieldName(editingField.name);
      setLabelEn(editingField.labelEn);
      setLabelTr(editingField.labelTr);
      setCalcType(editingField.type);
      setSourceColumn(editingField.config.sourceColumn || '');
      setCompareColumn(editingField.config.compareColumn || '');
      setOperation(editingField.config.operation || 'sum');
      setPeriod(editingField.config.period || 'month');
    } else {
      // Reset form
      setFieldName('');
      setLabelEn('');
      setLabelTr('');
      setCalcType('percentage_change');
      setSourceColumn('');
      setCompareColumn('');
      setOperation('sum');
      setPeriod('month');
    }
  }, [editingField, open]);

  const handleSave = () => {
    const field: CalculatedField = {
      id: editingField?.id || `calc_${Date.now()}`,
      name: fieldName || `${calcType}_${sourceColumn}`,
      labelEn: labelEn || `${getCalcTypeLabel(calcType)} of ${sourceColumn}`,
      labelTr: labelTr || `${sourceColumn} ${getCalcTypeLabel(calcType, 'tr')}`,
      type: calcType,
      config: {
        sourceColumn,
        compareColumn: needsCompareColumn() ? compareColumn : undefined,
        operation: calcType === 'aggregation' ? operation : undefined,
        period: calcType === 'period_comparison' ? period : undefined,
        format: calcType === 'percentage_change' ? 'percentage' : 
                calcType === 'trend' ? 'trend_arrow' : 'number',
      },
    };
    
    onSave(field);
    onClose();
  };

  const needsCompareColumn = () => {
    return ['percentage_change', 'difference', 'ratio', 'trend'].includes(calcType);
  };

  const getCalcTypeLabel = (type: string, lang: string = language) => {
    const calcType = CALCULATION_TYPES.find(c => c.key === type);
    return lang === 'tr' ? calcType?.labelTr : calcType?.labelEn;
  };

  const getColumnLabel = (colKey: string) => {
    const col = availableColumns.find(c => c.key === colKey);
    if (!col) return colKey;
    return language === 'tr' ? col.labelTr : col.labelEn;
  };

  const selectedCalcType = CALCULATION_TYPES.find(c => c.key === calcType);
  const Icon = selectedCalcType?.icon || Calculator;

  const isValid = () => {
    if (!sourceColumn) return false;
    if (needsCompareColumn() && !compareColumn) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {editingField 
              ? t('reportBuilder.editCalculatedField')
              : t('reportBuilder.addCalculatedField')
            }
          </DialogTitle>
          <DialogDescription>
            {t('reportBuilder.calculatedFieldDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Calculation Type Selection */}
          <div className="space-y-2">
            <Label>{t('reportBuilder.calculationType')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {CALCULATION_TYPES.map((type) => {
                const TypeIcon = type.icon;
                const isSelected = calcType === type.key;
                return (
                  <div
                    key={type.key}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setCalcType(type.key as CalculatedField['type'])}
                  >
                    <div className="flex items-center gap-2">
                      <TypeIcon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-medium text-sm">
                        {language === 'tr' ? type.labelTr : type.labelEn}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'tr' ? type.descriptionTr : type.descriptionEn}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Source Column */}
          <div className="space-y-2">
            <Label>{t('reportBuilder.sourceColumn')}</Label>
            <Select value={sourceColumn} onValueChange={setSourceColumn}>
              <SelectTrigger>
                <SelectValue placeholder={String(t('reportBuilder.selectColumn'))} />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    {t('reportBuilder.noNumericColumns')}
                  </div>
                ) : (
                  numericColumns.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {getColumnLabel(col.key)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Compare Column (for types that need it) */}
          {needsCompareColumn() && (
            <div className="space-y-2">
              <Label>{t('reportBuilder.compareColumn')}</Label>
              <Select value={compareColumn} onValueChange={setCompareColumn}>
                <SelectTrigger>
                  <SelectValue placeholder={String(t('reportBuilder.selectColumn'))} />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns
                    .filter(c => c.key !== sourceColumn)
                    .map((col) => (
                      <SelectItem key={col.key} value={col.key}>
                        {getColumnLabel(col.key)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aggregation Operation */}
          {calcType === 'aggregation' && (
            <div className="space-y-2">
              <Label>{t('reportBuilder.operation')}</Label>
              <Select value={operation} onValueChange={(v) => setOperation(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_OPERATIONS.map((op) => (
                    <SelectItem key={op.key} value={op.key}>
                      {language === 'tr' ? op.labelTr : op.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Period Comparison */}
          {calcType === 'period_comparison' && (
            <div className="space-y-2">
              <Label>{t('reportBuilder.comparisonPeriod')}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISON_PERIODS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {language === 'tr' ? p.labelTr : p.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Custom Labels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('reportBuilder.labelEnglish')}</Label>
              <Input
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                placeholder="e.g. % Change"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('reportBuilder.labelTurkish')}</Label>
              <Input
                value={labelTr}
                onChange={(e) => setLabelTr(e.target.value)}
                placeholder="ör. % Değişim"
              />
            </div>
          </div>

          {/* Preview */}
          {sourceColumn && (
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">{t('reportBuilder.preview')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {getCalcTypeLabel(calcType)}:
                </span>
                <Badge variant="outline">{getColumnLabel(sourceColumn)}</Badge>
                {needsCompareColumn() && compareColumn && (
                  <>
                    <span className="text-muted-foreground">vs</span>
                    <Badge variant="outline">{getColumnLabel(compareColumn)}</Badge>
                  </>
                )}
                {calcType === 'aggregation' && (
                  <Badge variant="secondary">
                    {AGGREGATION_OPERATIONS.find(o => o.key === operation)?.[language === 'tr' ? 'labelTr' : 'labelEn']}
                  </Badge>
                )}
                {calcType === 'period_comparison' && (
                  <Badge variant="secondary">
                    {COMPARISON_PERIODS.find(p => p.key === period)?.[language === 'tr' ? 'labelTr' : 'labelEn']}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!isValid()}>
            <Save className="h-4 w-4 mr-2" />
            {editingField ? t('save') : t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CalculatedFieldBuilder;
