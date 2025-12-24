import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Calendar, GitCompare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ColumnDefinition } from './reportBuilderTypes';

export interface ComparisonConfig {
  enabled: boolean;
  type: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  dateColumn: string;
  displayOptions: {
    showAbsolute: boolean;
    showDifference: boolean;
    showPercentage: boolean;
  };
  customRange?: {
    period1Start: string;
    period1End: string;
    period2Start: string;
    period2End: string;
  };
}

interface TimePeriodComparisonProps {
  config: ComparisonConfig;
  onChange: (config: ComparisonConfig) => void;
  availableColumns: ColumnDefinition[];
}

const COMPARISON_TYPES = [
  { value: 'week', labelEn: 'This Week vs Last Week', labelTr: 'Bu Hafta vs Geçen Hafta' },
  { value: 'month', labelEn: 'This Month vs Last Month', labelTr: 'Bu Ay vs Geçen Ay' },
  { value: 'quarter', labelEn: 'This Quarter vs Last Quarter', labelTr: 'Bu Çeyrek vs Geçen Çeyrek' },
  { value: 'year', labelEn: 'This Year vs Last Year', labelTr: 'Bu Yıl vs Geçen Yıl' },
  { value: 'custom', labelEn: 'Custom Date Ranges', labelTr: 'Özel Tarih Aralıkları' },
];

export const TimePeriodComparison: React.FC<TimePeriodComparisonProps> = ({
  config,
  onChange,
  availableColumns,
}) => {
  const { language } = useLanguage();

  const dateColumns = availableColumns.filter(col => col.type === 'date');

  const updateConfig = (updates: Partial<ComparisonConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateDisplayOptions = (key: keyof ComparisonConfig['displayOptions'], value: boolean) => {
    onChange({
      ...config,
      displayOptions: {
        ...config.displayOptions,
        [key]: value,
      },
    });
  };

  const updateCustomRange = (key: keyof NonNullable<ComparisonConfig['customRange']>, value: string) => {
    onChange({
      ...config,
      customRange: {
        period1Start: config.customRange?.period1Start || '',
        period1End: config.customRange?.period1End || '',
        period2Start: config.customRange?.period2Start || '',
        period2End: config.customRange?.period2End || '',
        [key]: value,
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            {language === 'tr' ? 'Dönem Karşılaştırması' : 'Period Comparison'}
          </CardTitle>
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>
      </CardHeader>
      
      {config.enabled && (
        <CardContent className="space-y-4">
          {/* Date Column Selection */}
          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Tarih Sütunu' : 'Date Column'}</Label>
            <Select
              value={config.dateColumn}
              onValueChange={(dateColumn) => updateConfig({ dateColumn })}
            >
              <SelectTrigger>
                <SelectValue placeholder={language === 'tr' ? 'Tarih sütunu seçin' : 'Select date column'} />
              </SelectTrigger>
              <SelectContent>
                {dateColumns.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    {language === 'tr' ? 'Tarih sütunu bulunamadı' : 'No date columns found'}
                  </SelectItem>
                ) : (
                  dateColumns.map((col) => (
                    <SelectItem key={`${col.table}.${col.key}`} value={`${col.table}.${col.key}`}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{language === 'tr' ? col.labelTr : col.labelEn}</span>
                        <span className="text-xs text-muted-foreground">({col.table})</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Comparison Type */}
          <div className="space-y-2">
            <Label>{language === 'tr' ? 'Karşılaştırma Tipi' : 'Comparison Type'}</Label>
            <Select
              value={config.type}
              onValueChange={(type: ComparisonConfig['type']) => updateConfig({ type })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARISON_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {language === 'tr' ? type.labelTr : type.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {config.type === 'custom' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {language === 'tr' ? 'Dönem 1' : 'Period 1'}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === 'tr' ? 'Başlangıç' : 'Start'}
                    </Label>
                    <Input
                      type="date"
                      value={config.customRange?.period1Start || ''}
                      onChange={(e) => updateCustomRange('period1Start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === 'tr' ? 'Bitiş' : 'End'}
                    </Label>
                    <Input
                      type="date"
                      value={config.customRange?.period1End || ''}
                      onChange={(e) => updateCustomRange('period1End', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {language === 'tr' ? 'Dönem 2' : 'Period 2'}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === 'tr' ? 'Başlangıç' : 'Start'}
                    </Label>
                    <Input
                      type="date"
                      value={config.customRange?.period2Start || ''}
                      onChange={(e) => updateCustomRange('period2Start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {language === 'tr' ? 'Bitiş' : 'End'}
                    </Label>
                    <Input
                      type="date"
                      value={config.customRange?.period2End || ''}
                      onChange={(e) => updateCustomRange('period2End', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Display Options */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-medium">
              {language === 'tr' ? 'Gösterim Seçenekleri' : 'Display Options'}
            </Label>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showAbsolute"
                  checked={config.displayOptions.showAbsolute}
                  onCheckedChange={(checked) => updateDisplayOptions('showAbsolute', checked === true)}
                />
                <Label htmlFor="showAbsolute" className="text-sm cursor-pointer flex items-center gap-1">
                  <Minus className="h-3 w-3" />
                  {language === 'tr' ? 'Mutlak Değerler' : 'Absolute Values'}
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showDifference"
                  checked={config.displayOptions.showDifference}
                  onCheckedChange={(checked) => updateDisplayOptions('showDifference', checked === true)}
                />
                <Label htmlFor="showDifference" className="text-sm cursor-pointer flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {language === 'tr' ? 'Fark (Δ)' : 'Difference (Δ)'}
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showPercentage"
                  checked={config.displayOptions.showPercentage}
                  onCheckedChange={(checked) => updateDisplayOptions('showPercentage', checked === true)}
                />
                <Label htmlFor="showPercentage" className="text-sm cursor-pointer flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {language === 'tr' ? 'Yüzde (%)' : 'Percentage (%)'}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  enabled: false,
  type: 'month',
  dateColumn: '',
  displayOptions: {
    showAbsolute: true,
    showDifference: true,
    showPercentage: true,
  },
};
