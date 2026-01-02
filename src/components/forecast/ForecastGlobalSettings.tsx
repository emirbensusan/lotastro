import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Save, Loader2, RotateCcw } from 'lucide-react';
import SeasonalAdjustmentEditor from './SeasonalAdjustmentEditor';
import TrendDetectionSettings from './TrendDetectionSettings';

interface Props {
  settings: any;
  onSettingsChange: (settings: any) => void;
  onRefresh: () => void;
  readOnly: boolean;
}

const ForecastGlobalSettings: React.FC<Props> = ({ settings, onSettingsChange, onRefresh, readOnly }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings || getDefaultSettings());

  function getDefaultSettings() {
    const defaultSeasonalIndices: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) {
      defaultSeasonalIndices[String(i)] = 1.0;
    }
    return {
      forecast_horizon_months: 3,
      time_bucket: '2-week',
      history_window_months: 12,
      normalization_type: 'none',
      outlier_percentile: 95,
      weighting_method: 'fixed',
      default_safety_stock_weeks: 2,
      default_safety_stock_mode: 'weeks',
      min_order_zero_history: 0,
      demand_statuses: ['confirmed', 'reserved'],
      override_row_tint_color: '#FEF3C7',
      weekly_schedule_enabled: true,
      weekly_schedule_day: 1,
      weekly_schedule_hour: 6,
      weekly_schedule_timezone: 'Europe/Istanbul',
      stockout_alert_days: 14,
      overstock_alert_months: 6,
      email_digest_enabled: true,
      email_digest_day: 1,
      email_digest_hour: 8,
      seasonal_adjustment_enabled: false,
      seasonal_indices: defaultSeasonalIndices,
      trend_detection_enabled: false,
      trend_smoothing_periods: 3,
    };
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = { ...localSettings, updated_by: user?.id };
      
      // Log changes for audit
      if (settings?.id) {
        const changedFields = Object.keys(updates).filter(
          key => JSON.stringify(updates[key]) !== JSON.stringify(settings[key])
        );

        for (const field of changedFields) {
          // Log to forecast_settings_audit_log (existing)
          await supabase.from('forecast_settings_audit_log').insert({
            changed_by: user?.id,
            scope: 'global',
            parameter_name: field,
            old_value: settings[field],
            new_value: updates[field],
          });

          // Also log to main audit_logs table
          await supabase.rpc('log_audit_action', {
            p_action: 'UPDATE',
            p_entity_type: 'forecast_settings',
            p_entity_id: settings.id,
            p_entity_identifier: `Global: ${field}`,
            p_old_data: { scope: 'global', parameter_name: field, value: settings[field] },
            p_new_data: { scope: 'global', parameter_name: field, value: updates[field] },
            p_notes: `Updated global forecast setting: ${field}`
          });
        }

        const { error } = await supabase
          .from('forecast_settings_global')
          .update(updates)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data: insertedData, error } = await supabase
          .from('forecast_settings_global')
          .insert(updates)
          .select()
          .single();

        if (error) throw error;

        // Log creation to main audit_logs
        if (insertedData) {
          await supabase.rpc('log_audit_action', {
            p_action: 'CREATE',
            p_entity_type: 'forecast_settings',
            p_entity_id: insertedData.id,
            p_entity_identifier: 'Global Settings',
            p_new_data: { scope: 'global', settings: updates },
            p_notes: 'Created global forecast settings'
          });
        }
      }

      toast({
        title: t('success') as string,
        description: t('forecast.settingsSaved') as string || 'Settings saved successfully',
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: t('error') as string,
        description: error.message || t('forecast.saveError') as string,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const dayOptions = [
    { value: 0, label: t('sunday') || 'Sunday' },
    { value: 1, label: t('monday') || 'Monday' },
    { value: 2, label: t('tuesday') || 'Tuesday' },
    { value: 3, label: t('wednesday') || 'Wednesday' },
    { value: 4, label: t('thursday') || 'Thursday' },
    { value: 5, label: t('friday') || 'Friday' },
    { value: 6, label: t('saturday') || 'Saturday' },
  ];

  return (
    <div className="space-y-6">
      {/* Forecast Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forecast.forecastParameters') || 'Forecast Parameters'}</CardTitle>
          <CardDescription>
            {t('forecast.forecastParametersDesc') || 'Configure how forecasts are calculated'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Forecast Horizon */}
            <div className="space-y-2">
              <Label>{t('forecast.forecastHorizon') || 'Forecast Horizon'}</Label>
              <Select
                value={String(localSettings.forecast_horizon_months)}
                onValueChange={(v) => updateSetting('forecast_horizon_months', parseInt(v))}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 {t('month') || 'month'}</SelectItem>
                  <SelectItem value="3">3 {t('months') || 'months'}</SelectItem>
                  <SelectItem value="6">6 {t('months') || 'months'}</SelectItem>
                  <SelectItem value="12">12 {t('months') || 'months'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Bucket */}
            <div className="space-y-2">
              <Label>{t('forecast.timeBucket') || 'Time Bucket'}</Label>
              <Select
                value={localSettings.time_bucket}
                onValueChange={(v) => updateSetting('time_bucket', v)}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t('forecast.weekly') || 'Weekly'}</SelectItem>
                  <SelectItem value="2-week">{t('forecast.biweekly') || '2-Week'}</SelectItem>
                  <SelectItem value="monthly">{t('forecast.monthly') || 'Monthly'}</SelectItem>
                  <SelectItem value="quarterly">{t('forecast.quarterly') || 'Quarterly'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* History Window */}
            <div className="space-y-2">
              <Label>{t('forecast.historyWindow') || 'History Window'}</Label>
              <Select
                value={String(localSettings.history_window_months)}
                onValueChange={(v) => updateSetting('history_window_months', parseInt(v))}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 {t('months') || 'months'}</SelectItem>
                  <SelectItem value="12">12 {t('months') || 'months'}</SelectItem>
                  <SelectItem value="24">24 {t('months') || 'months'}</SelectItem>
                  <SelectItem value="36">36 {t('months') || 'months'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Weighting Method */}
            <div className="space-y-2">
              <Label>{t('forecast.weightingMethod') || 'Weighting Method'}</Label>
              <Select
                value={localSettings.weighting_method}
                onValueChange={(v) => updateSetting('weighting_method', v)}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{t('forecast.fixedWeights') || 'Fixed Weights (Simple Average)'}</SelectItem>
                  <SelectItem value="linear_decay">{t('forecast.linearDecay') || 'Linear Decay'}</SelectItem>
                  <SelectItem value="exponential_decay">{t('forecast.exponentialDecay') || 'Exponential Decay'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Normalization Type */}
            <div className="space-y-2">
              <Label>{t('forecast.normalization') || 'Normalization'}</Label>
              <Select
                value={localSettings.normalization_type}
                onValueChange={(v) => updateSetting('normalization_type', v)}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                  <SelectItem value="cap_outliers">{t('forecast.capOutliers') || 'Cap Outliers'}</SelectItem>
                  <SelectItem value="moving_average">{t('forecast.movingAverage') || 'Moving Average'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Outlier Percentile */}
            {localSettings.normalization_type === 'cap_outliers' && (
              <div className="space-y-2">
                <Label>{t('forecast.outlierPercentile') || 'Outlier Percentile'}: {localSettings.outlier_percentile}%</Label>
                <Slider
                  value={[localSettings.outlier_percentile]}
                  onValueChange={(v) => updateSetting('outlier_percentile', v[0])}
                  min={80}
                  max={99}
                  step={1}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Safety Stock Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forecast.safetyStock') || 'Safety Stock Settings'}</CardTitle>
          <CardDescription>
            {t('forecast.safetyStockDesc') || 'Configure default safety stock parameters'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Safety Stock Mode */}
            <div className="space-y-2">
              <Label>{t('forecast.safetyStockMode') || 'Safety Stock Mode'}</Label>
              <Select
                value={localSettings.default_safety_stock_mode}
                onValueChange={(v) => updateSetting('default_safety_stock_mode', v)}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weeks">{t('forecast.weeksOfCoverage') || 'Weeks of Coverage'}</SelectItem>
                  <SelectItem value="min_units">{t('forecast.minimumUnits') || 'Minimum Units'}</SelectItem>
                  <SelectItem value="min_per_color">{t('forecast.minPerColor') || 'Minimum per Color'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Safety Stock Value */}
            <div className="space-y-2">
              <Label>{t('forecast.defaultSafetyStock') || 'Default Safety Stock (weeks)'}</Label>
              <Input
                type="number"
                min={0}
                max={12}
                step={0.5}
                value={localSettings.default_safety_stock_weeks}
                onChange={(e) => updateSetting('default_safety_stock_weeks', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            {/* Min Order Zero History */}
            <div className="space-y-2">
              <Label>{t('forecast.minOrderZeroHistory') || 'Min Order (No History)'}</Label>
              <Input
                type="number"
                min={0}
                value={localSettings.min_order_zero_history}
                onChange={(e) => updateSetting('min_order_zero_history', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forecast.alertThresholds') || 'Alert Thresholds'}</CardTitle>
          <CardDescription>
            {t('forecast.alertThresholdsDesc') || 'Configure when alerts are triggered'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stockout Alert Days */}
            <div className="space-y-2">
              <Label>{t('forecast.stockoutAlertDays') || 'Stockout Alert (days before)'}</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={localSettings.stockout_alert_days}
                onChange={(e) => updateSetting('stockout_alert_days', parseInt(e.target.value) || 14)}
                disabled={readOnly}
              />
            </div>

            {/* Overstock Alert Months */}
            <div className="space-y-2">
              <Label>{t('forecast.overstockAlertMonths') || 'Overstock Alert (months of stock)'}</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={localSettings.overstock_alert_months}
                onChange={(e) => updateSetting('overstock_alert_months', parseInt(e.target.value) || 6)}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forecast.scheduleSettings') || 'Schedule Settings'}</CardTitle>
          <CardDescription>
            {t('forecast.scheduleSettingsDesc') || 'Configure automatic forecast runs and email digests'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Weekly Forecast Run */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">{t('forecast.weeklyForecastRun') || 'Weekly Forecast Run'}</Label>
              <p className="text-sm text-muted-foreground">
                {t('forecast.weeklyForecastRunDesc') || 'Automatically run forecasts on a schedule'}
              </p>
            </div>
            <Switch
              checked={localSettings.weekly_schedule_enabled}
              onCheckedChange={(v) => updateSetting('weekly_schedule_enabled', v)}
              disabled={readOnly}
            />
          </div>

          {localSettings.weekly_schedule_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4">
              <div className="space-y-2">
                <Label>{t('day') || 'Day'}</Label>
                <Select
                  value={String(localSettings.weekly_schedule_day)}
                  onValueChange={(v) => updateSetting('weekly_schedule_day', parseInt(v))}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map(d => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('hour') || 'Hour'}</Label>
                <Select
                  value={String(localSettings.weekly_schedule_hour)}
                  onValueChange={(v) => updateSetting('weekly_schedule_hour', parseInt(v))}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('timezone') || 'Timezone'}</Label>
                <Input
                  value={localSettings.weekly_schedule_timezone}
                  onChange={(e) => updateSetting('weekly_schedule_timezone', e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Email Digest */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">{t('forecast.emailDigest') || 'Weekly Email Digest'}</Label>
              <p className="text-sm text-muted-foreground">
                {t('forecast.emailDigestDesc') || 'Send weekly summary of forecasts and alerts'}
              </p>
            </div>
            <Switch
              checked={localSettings.email_digest_enabled}
              onCheckedChange={(v) => updateSetting('email_digest_enabled', v)}
              disabled={readOnly}
            />
          </div>

          {localSettings.email_digest_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
              <div className="space-y-2">
                <Label>{t('day') || 'Day'}</Label>
                <Select
                  value={String(localSettings.email_digest_day)}
                  onValueChange={(v) => updateSetting('email_digest_day', parseInt(v))}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map(d => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('hour') || 'Hour'}</Label>
                <Select
                  value={String(localSettings.email_digest_hour)}
                  onValueChange={(v) => updateSetting('email_digest_hour', parseInt(v))}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* UI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forecast.uiSettings') || 'UI Settings'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t('forecast.overrideRowTint') || 'Override Row Tint Color'}</Label>
            <div className="flex items-center gap-4">
              <Input
                type="color"
                value={localSettings.override_row_tint_color}
                onChange={(e) => updateSetting('override_row_tint_color', e.target.value)}
                className="w-16 h-10 p-1"
                disabled={readOnly}
              />
              <Input
                type="text"
                value={localSettings.override_row_tint_color}
                onChange={(e) => updateSetting('override_row_tint_color', e.target.value)}
                className="w-32"
                disabled={readOnly}
              />
              <div 
                className="w-32 h-10 rounded border"
                style={{ backgroundColor: localSettings.override_row_tint_color }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onRefresh}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('reset') || 'Reset'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('saveChanges') || 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ForecastGlobalSettings;