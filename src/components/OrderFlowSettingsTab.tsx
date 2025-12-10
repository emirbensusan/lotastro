import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  getTransitionCountdownDuration, 
  setTransitionCountdownDuration,
  getAutoProceEnabled,
  setAutoProceEnabled,
  getShowPopupsEnabled,
  setShowPopupsEnabled
} from '@/components/QualityTransitionScreen';

// Minimum qualities for multi-order localStorage helpers
const MIN_QUALITIES_KEY = 'multi_order_min_qualities';
const DEFAULT_MIN_QUALITIES = 2;

export const getMinQualitiesForMultiOrder = (): number => {
  try {
    const stored = localStorage.getItem(MIN_QUALITIES_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 2 && parsed <= 10) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading min qualities setting:', e);
  }
  return DEFAULT_MIN_QUALITIES;
};

export const setMinQualitiesForMultiOrder = (value: number): void => {
  const clamped = Math.max(2, Math.min(10, value));
  localStorage.setItem(MIN_QUALITIES_KEY, clamped.toString());
};

const OrderFlowSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  
  const [countdown, setCountdown] = useState(getTransitionCountdownDuration());
  const [autoProceed, setAutoProceed] = useState(getAutoProceEnabled());
  const [showPopups, setShowPopups] = useState(getShowPopupsEnabled());
  const [minQualities, setMinQualities] = useState(getMinQualitiesForMultiOrder());

  const handleCountdownChange = (value: number[]) => {
    const newValue = value[0];
    setCountdown(newValue);
    setTransitionCountdownDuration(newValue);
  };

  const handleAutoProceedChange = (checked: boolean) => {
    setAutoProceed(checked);
    setAutoProceEnabled(checked);
  };

  const handleShowPopupsChange = (checked: boolean) => {
    setShowPopups(checked);
    setShowPopupsEnabled(checked);
  };

  const handleMinQualitiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 2 && value <= 10) {
      setMinQualities(value);
      setMinQualitiesForMultiOrder(value);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('multiOrderSettings')}</CardTitle>
          <CardDescription>{t('multiOrderSettingsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Show Transition Popups Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-popups">{t('showTransitionPopups')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('showTransitionPopupsDesc')}
              </p>
            </div>
            <Switch
              id="show-popups"
              checked={showPopups}
              onCheckedChange={handleShowPopupsChange}
            />
          </div>

          {/* Auto-Proceed Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-proceed">{t('enableAutoProceed')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('enableAutoProceedDesc')}
              </p>
            </div>
            <Switch
              id="auto-proceed"
              checked={autoProceed}
              onCheckedChange={handleAutoProceedChange}
              disabled={!showPopups}
            />
          </div>

          {/* Countdown Duration Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('transitionCountdown')}</Label>
              <span className="text-sm font-medium tabular-nums">
                {countdown} {t('seconds')}
              </span>
            </div>
            <Slider
              value={[countdown]}
              onValueChange={handleCountdownChange}
              min={3}
              max={60}
              step={1}
              disabled={!showPopups || !autoProceed}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {t('transitionCountdownDesc')}
            </p>
          </div>

          {/* Minimum Qualities for Multi-Order */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="min-qualities">{t('minQualitiesForMultiOrder')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('minQualitiesForMultiOrderDesc')}
                </p>
              </div>
              <Input
                id="min-qualities"
                type="number"
                min={2}
                max={10}
                value={minQualities}
                onChange={handleMinQualitiesChange}
                className="w-20 text-center"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderFlowSettingsTab;
