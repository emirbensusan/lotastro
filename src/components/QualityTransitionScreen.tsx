import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, ChevronRight, X, ArrowLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// Storage keys for settings
const TRANSITION_COUNTDOWN_KEY = 'quality_transition_countdown_seconds';
const AUTO_PROCEED_ENABLED_KEY = 'quality_transition_auto_proceed';
const SHOW_POPUPS_KEY = 'quality_transition_show_popups';
const DEFAULT_COUNTDOWN = 10;

export const getTransitionCountdownDuration = (): number => {
  try {
    const stored = localStorage.getItem(TRANSITION_COUNTDOWN_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 3 && parsed <= 60) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading countdown setting:', e);
  }
  return DEFAULT_COUNTDOWN;
};

export const setTransitionCountdownDuration = (seconds: number): void => {
  try {
    const value = Math.max(3, Math.min(60, seconds));
    localStorage.setItem(TRANSITION_COUNTDOWN_KEY, String(value));
  } catch (e) {
    console.error('Error saving countdown setting:', e);
  }
};

export const getAutoProceEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(AUTO_PROCEED_ENABLED_KEY);
    return stored !== 'false'; // Default to true
  } catch (e) {
    return true;
  }
};

export const setAutoProceEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(AUTO_PROCEED_ENABLED_KEY, String(enabled));
  } catch (e) {
    console.error('Error saving auto-proceed setting:', e);
  }
};

export const getShowPopupsEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(SHOW_POPUPS_KEY);
    return stored !== 'false'; // Default to true
  } catch (e) {
    return true;
  }
};

export const setShowPopupsEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(SHOW_POPUPS_KEY, String(enabled));
  } catch (e) {
    console.error('Error saving show popups setting:', e);
  }
};

export interface SelectionOverviewItem {
  quality: string;
  color: string;
  meters: number;
  rolls: number;
}

interface QualityTransitionScreenProps {
  isOpen: boolean;
  completedQuality: string;
  completedColor: string;
  nextDestination: 'color' | 'quality' | 'cart';
  nextQualityOrColor: string;
  currentQualityIndex: number;
  totalQualities: number;
  currentColorIndex?: number;
  totalColors?: number;
  selectionOverview: SelectionOverviewItem[];
  onYesProceed: () => void;
  onNoAddMoreColors: () => void;
  onGoBack: () => void;
}

const QualityTransitionScreen: React.FC<QualityTransitionScreenProps> = ({
  isOpen,
  completedQuality,
  completedColor,
  nextDestination,
  nextQualityOrColor,
  currentQualityIndex,
  totalQualities,
  currentColorIndex = 0,
  totalColors = 1,
  selectionOverview,
  onYesProceed,
  onNoAddMoreColors,
  onGoBack,
}) => {
  const { t } = useLanguage();
  const [countdown, setCountdown] = useState(getTransitionCountdownDuration());
  const [isPaused, setIsPaused] = useState(false);
  const autoProceEnabled = getAutoProceEnabled();

  // Reset countdown when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(getTransitionCountdownDuration());
      setIsPaused(false);
    }
  }, [isOpen]);

  // Countdown timer - only if auto-proceed is enabled
  useEffect(() => {
    if (!isOpen || isPaused || countdown <= 0 || !autoProceEnabled) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, countdown, autoProceEnabled]);

  // Auto-proceed when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && isOpen && !isPaused && autoProceEnabled) {
      onYesProceed();
    }
  }, [countdown, isOpen, isPaused, autoProceEnabled, onYesProceed]);

  const handleYesProceed = useCallback(() => {
    setIsPaused(true);
    onYesProceed();
  }, [onYesProceed]);

  const handleNoAddMore = useCallback(() => {
    setIsPaused(true);
    onNoAddMoreColors();
  }, [onNoAddMoreColors]);

  const handleGoBack = useCallback(() => {
    setIsPaused(true);
    onGoBack();
  }, [onGoBack]);

  // Calculate progress percentage for visual indicator
  const totalDuration = getTransitionCountdownDuration();
  const progressPercent = autoProceEnabled ? ((totalDuration - countdown) / totalDuration) * 100 : 0;

  // Calculate totals from selection overview
  const totalMeters = selectionOverview.reduce((sum, item) => sum + item.meters, 0);
  const totalRolls = selectionOverview.reduce((sum, item) => sum + item.rolls, 0);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-2xl p-0 overflow-hidden max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar at top */}
        {autoProceEnabled && (
          <div className="h-1 bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-2rem)]">
          {/* Success Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('colorSelectionComplete')}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {completedQuality}
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{completedColor}</span>
              </div>
            </div>
          </div>

          {/* Selection Overview Table */}
          {selectionOverview.length > 0 && (
            <div className="border rounded-lg">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <h3 className="font-medium text-sm">{t('selectionOverview')}</h3>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t('quality')}</TableHead>
                      <TableHead className="text-xs">{t('color')}</TableHead>
                      <TableHead className="text-xs text-right">{t('meters')}</TableHead>
                      <TableHead className="text-xs text-right">{t('rolls')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectionOverview.map((item, idx) => (
                      <TableRow key={`${item.quality}-${item.color}-${idx}`}>
                        <TableCell className="text-sm py-2">{item.quality}</TableCell>
                        <TableCell className="text-sm py-2">{item.color}</TableCell>
                        <TableCell className="text-sm py-2 text-right">{item.meters.toLocaleString()}</TableCell>
                        <TableCell className="text-sm py-2 text-right">{item.rolls}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="bg-muted/30 px-4 py-2 border-t flex justify-between text-sm">
                <span className="font-medium">{t('total')}</span>
                <span>{totalMeters.toLocaleString()} m • {totalRolls} {t('rolls')}</span>
              </div>
            </div>
          )}

          {/* Main Question */}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-base font-medium text-primary mb-1">
              {nextDestination === 'color' 
                ? t('continueToNextColor')
                : t('isQualitySelectionComplete')
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {nextDestination === 'color' && (
                <>{t('nextColor')}: <span className="font-medium">{nextQualityOrColor}</span></>
              )}
              {nextDestination === 'quality' && (
                <>{t('nextQuality')}: <span className="font-medium">{nextQualityOrColor}</span></>
              )}
              {nextDestination === 'cart' && t('allQualitiesProcessed')}
            </p>
          </div>

          {/* Countdown Display - only if auto-proceed enabled */}
          {autoProceEnabled && (
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {t('autoNavigatingIn')}
                </span>
              </div>
              <div className="text-3xl font-bold tabular-nums text-primary">
                {countdown}
                <span className="text-base font-normal text-muted-foreground ml-1">
                  {t('seconds')}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Primary Actions - YES/NO */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleYesProceed}
                className="w-full"
                size="lg"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('yesQualityComplete')}
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleNoAddMore}
                className="w-full"
                size="lg"
              >
                {t('noAddMoreColors')}
              </Button>
            </div>

            {/* Secondary Action - Go Back */}
            <Button 
              variant="secondary" 
              onClick={handleGoBack}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('goBackToPreviousSelection')}
            </Button>
          </div>

          {/* Progress Indicator */}
          <div className="text-center text-xs text-muted-foreground pt-2 border-t">
            {String(t('qualityNumberOf'))
              .replace('{current}', String(currentQualityIndex + 1))
              .replace('{total}', String(totalQualities))}
            {totalColors > 1 && (
              <span className="ml-2">
                • {t('colorProgress')} {currentColorIndex + 1}/{totalColors}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QualityTransitionScreen;
