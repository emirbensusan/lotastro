import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  enabled: boolean;
  indices: Record<string, number>;
  onEnabledChange: (enabled: boolean) => void;
  onIndicesChange: (indices: Record<string, number>) => void;
  readOnly: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SeasonalAdjustmentEditor: React.FC<Props> = ({
  enabled,
  indices,
  onEnabledChange,
  onIndicesChange,
  readOnly
}) => {
  const { t } = useLanguage();

  const handleIndexChange = (month: number, value: number) => {
    onIndicesChange({
      ...indices,
      [String(month)]: value
    });
  };

  const resetToDefaults = () => {
    const defaultIndices: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) {
      defaultIndices[String(i)] = 1.0;
    }
    onIndicesChange(defaultIndices);
  };

  const getSeasonalColor = (value: number) => {
    if (value > 1.2) return 'text-green-600 dark:text-green-400';
    if (value < 0.8) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getBarWidth = (value: number) => {
    // Scale 0.5-1.5 to 0-100%
    const scaled = ((value - 0.5) / 1.0) * 100;
    return Math.max(0, Math.min(100, scaled));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('forecast.seasonalAdjustments') || 'Seasonal Adjustments'}
            </CardTitle>
            <CardDescription>
              {t('forecast.seasonalAdjustmentsDesc') || 
                'Adjust forecast multipliers by month to account for seasonal demand patterns'}
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={readOnly}
          />
        </div>
      </CardHeader>
      <CardContent className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t('forecast.seasonalAdjustmentsHint') || 
                'Values > 1.0 increase forecast, < 1.0 decrease. E.g., 1.2 = 20% higher demand expected.'}
            </p>
            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="h-4 w-4 mr-1" />
                {t('reset') || 'Reset'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MONTHS.map((month, idx) => {
              const monthNum = idx + 1;
              const value = indices[String(monthNum)] ?? 1.0;
              
              return (
                <div key={month} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <Label className="font-medium">{t(`months.${month.toLowerCase()}`) || month}</Label>
                    <span className={`text-sm font-mono ${getSeasonalColor(value)}`}>
                      {value.toFixed(2)}x
                      {value > 1.0 && <TrendingUp className="inline h-3 w-3 ml-1" />}
                      {value < 1.0 && <TrendingDown className="inline h-3 w-3 ml-1" />}
                    </span>
                  </div>
                  
                  {/* Visual bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        value > 1.0 ? 'bg-green-500' : value < 1.0 ? 'bg-red-500' : 'bg-primary'
                      }`}
                      style={{ width: `${getBarWidth(value)}%` }}
                    />
                  </div>
                  
                  <Slider
                    value={[value]}
                    onValueChange={([v]) => handleIndexChange(monthNum, v)}
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    disabled={readOnly}
                  />
                </div>
              );
            })}
          </div>

          {/* Summary stats */}
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">{t('forecast.seasonalSummary') || 'Seasonal Summary'}</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('forecast.peakMonths') || 'Peak Months'}:</span>
                <div className="font-medium">
                  {MONTHS.filter((_, i) => (indices[String(i + 1)] ?? 1) > 1.1)
                    .map(m => m.substring(0, 3))
                    .join(', ') || 'None'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('forecast.lowMonths') || 'Low Months'}:</span>
                <div className="font-medium">
                  {MONTHS.filter((_, i) => (indices[String(i + 1)] ?? 1) < 0.9)
                    .map(m => m.substring(0, 3))
                    .join(', ') || 'None'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('forecast.avgIndex') || 'Avg Index'}:</span>
                <div className="font-medium">
                  {(Object.values(indices).reduce((a, b) => a + b, 0) / 12).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SeasonalAdjustmentEditor;
