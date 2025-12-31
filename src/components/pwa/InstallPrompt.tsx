import React from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useLanguage } from '@/contexts/LanguageContext';

export function InstallPrompt() {
  const { canShow, promptInstall, dismiss } = usePWAInstall();
  const { t } = useLanguage();

  if (!canShow) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-fade-in">
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground">
              {t('installApp') || 'Install LotAstro'}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {t('installAppDescription') || 'Add to home screen for faster access and offline support'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={promptInstall}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-1" />
                {t('install') || 'Install'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
              >
                {t('notNow') || 'Not now'}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
