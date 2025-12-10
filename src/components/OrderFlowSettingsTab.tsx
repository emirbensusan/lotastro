import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  getTransitionCountdownDuration, 
  setTransitionCountdownDuration,
  getAutoProceEnabled,
  setAutoProceEnabled,
  getShowPopupsEnabled,
  setShowPopupsEnabled
} from '@/components/QualityTransitionScreen';

const OrderFlowSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  
  const [countdown, setCountdown] = useState(getTransitionCountdownDuration());
  const [autoProceed, setAutoProceed] = useState(getAutoProceEnabled());
  const [showPopups, setShowPopups] = useState(getShowPopupsEnabled());

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
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderFlowSettingsTab;
