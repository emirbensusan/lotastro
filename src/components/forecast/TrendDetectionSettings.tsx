import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, Activity } from 'lucide-react';

interface Props {
  enabled: boolean;
  smoothingPeriods: number;
  onEnabledChange: (enabled: boolean) => void;
  onSmoothingPeriodsChange: (periods: number) => void;
  readOnly: boolean;
}

const TrendDetectionSettings: React.FC<Props> = ({
  enabled,
  smoothingPeriods,
  onEnabledChange,
  onSmoothingPeriodsChange,
  readOnly
}) => {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('forecast.trendDetection') || 'Trend Detection'}
            </CardTitle>
            <CardDescription>
              {t('forecast.trendDetectionDesc') || 
                'Automatically detect and apply demand trends to improve forecast accuracy'}
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
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              {t('forecast.trendDetectionHint') || 
                'When enabled, the forecast engine uses linear regression on historical data to detect rising or falling demand patterns and adjusts forecasts accordingly.'}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-medium text-sm">{t('forecast.risingTrend') || 'Rising Trend'}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('forecast.risingTrendDesc') || 'Increases forecast to anticipate growing demand'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                <div className="p-2 rounded-full bg-muted">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm">{t('forecast.stableTrend') || 'Stable'}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('forecast.stableTrendDesc') || 'No significant trend detected'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400 rotate-180" />
                </div>
                <div>
                  <div className="font-medium text-sm">{t('forecast.fallingTrend') || 'Falling Trend'}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('forecast.fallingTrendDesc') || 'Reduces forecast for declining demand'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('forecast.smoothingPeriods') || 'Smoothing Periods'}</Label>
            <Select
              value={String(smoothingPeriods)}
              onValueChange={(v) => onSmoothingPeriodsChange(parseInt(v))}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 {t('periods') || 'periods'}</SelectItem>
                <SelectItem value="3">3 {t('periods') || 'periods'}</SelectItem>
                <SelectItem value="4">4 {t('periods') || 'periods'}</SelectItem>
                <SelectItem value="6">6 {t('periods') || 'periods'}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('forecast.smoothingPeriodsHint') || 
                'Higher values create smoother trend lines but may miss recent changes'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendDetectionSettings;
