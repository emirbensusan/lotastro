import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronRight, X, ArrowLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// Storage key for countdown duration setting
const TRANSITION_COUNTDOWN_KEY = 'quality_transition_countdown_seconds';
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

interface QualityTransitionScreenProps {
  isOpen: boolean;
  completedQuality: string;
  completedColor: string;
  nextQuality: string;
  currentQualityIndex: number;
  totalQualities: number;
  remainingQualities: number;
  onProceed: () => void;
  onCancel: () => void;
  onGoBack: () => void;
}

const QualityTransitionScreen: React.FC<QualityTransitionScreenProps> = ({
  isOpen,
  completedQuality,
  completedColor,
  nextQuality,
  currentQualityIndex,
  totalQualities,
  remainingQualities,
  onProceed,
  onCancel,
  onGoBack,
}) => {
  const { t } = useLanguage();
  const [countdown, setCountdown] = useState(getTransitionCountdownDuration());
  const [isPaused, setIsPaused] = useState(false);

  // Reset countdown when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(getTransitionCountdownDuration());
      setIsPaused(false);
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isPaused || countdown <= 0) return;

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
  }, [isOpen, isPaused, countdown]);

  // Auto-proceed when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && isOpen && !isPaused) {
      onProceed();
    }
  }, [countdown, isOpen, isPaused, onProceed]);

  const handleProceedNow = useCallback(() => {
    setIsPaused(true);
    onProceed();
  }, [onProceed]);

  const handleCancel = useCallback(() => {
    setIsPaused(true);
    onCancel();
  }, [onCancel]);

  const handleGoBack = useCallback(() => {
    setIsPaused(true);
    onGoBack();
  }, [onGoBack]);

  // Calculate progress percentage for visual indicator
  const totalDuration = getTransitionCountdownDuration();
  const progressPercent = ((totalDuration - countdown) / totalDuration) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar at top */}
        <div className="h-1 bg-muted overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-6 space-y-6">
          {/* Success Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('qualityComplete')}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-base px-3 py-1">
                  {completedQuality}
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{completedColor}</span>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="text-center text-sm text-muted-foreground">
            {String(t('qualityNumberOf'))
              .replace('{current}', String(currentQualityIndex + 1))
              .replace('{total}', String(totalQualities))}
            {remainingQualities > 0 && (
              <span className="ml-2">
                ({remainingQualities} {t('remaining')})
              </span>
            )}
          </div>

          {/* Next Quality Info */}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">{t('proceedingToQuality')}</p>
            <p className="text-lg font-semibold text-primary">{nextQuality}</p>
          </div>

          {/* Countdown Display */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {t('autoNavigatingIn')}
              </span>
            </div>
            <div className="text-4xl font-bold tabular-nums text-primary">
              {countdown}
              <span className="text-lg font-normal text-muted-foreground ml-1">
                {t('seconds')}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Primary Action - Proceed Now */}
            <Button 
              onClick={handleProceedNow}
              className="w-full"
              size="lg"
            >
              {t('proceedNow')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={handleGoBack}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('goBackToPreviousQuality')}
              </Button>
              
              <Button 
                variant="secondary" 
                onClick={handleCancel}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                {t('cancelQualitySelection')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QualityTransitionScreen;
