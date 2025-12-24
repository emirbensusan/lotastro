import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { OUTPUT_FORMATS } from '../reportBuilderTypes';

interface OutputTabProps {
  outputFormats: string[];
  includeCharts: boolean;
  onOutputFormatsChange: (formats: string[]) => void;
  onIncludeChartsChange: (include: boolean) => void;
}

export const OutputTab: React.FC<OutputTabProps> = ({
  outputFormats,
  includeCharts,
  onOutputFormatsChange,
  onIncludeChartsChange,
}) => {
  const { language, t } = useLanguage();

  const toggleFormat = (formatKey: string) => {
    const isSelected = outputFormats.includes(formatKey);
    onOutputFormatsChange(
      isSelected
        ? outputFormats.filter(f => f !== formatKey)
        : [...outputFormats, formatKey]
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>{t('reportBuilder.outputFormats')}</Label>
        <div className="flex flex-wrap gap-3">
          {OUTPUT_FORMATS.map((format) => {
            const Icon = format.icon;
            const isSelected = outputFormats.includes(format.key);
            return (
              <div
                key={format.key}
                className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleFormat(format.key)}
              >
                <Checkbox checked={isSelected} />
                <Icon className="h-4 w-4" />
                <span>{language === 'tr' ? format.labelTr : format.labelEn}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{t('reportBuilder.includeCharts')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('reportBuilder.includeChartsDescription')}
          </p>
        </div>
        <Switch
          checked={includeCharts}
          onCheckedChange={onIncludeChartsChange}
        />
      </div>
    </div>
  );
};
