import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface MigrationProgress {
  isRunning: boolean;
  currentStep: string;
  processedItems: number;
  totalItems: number;
  errors: string[];
  result?: {
    success: boolean;
    dryRun: boolean;
    catalogItemsCreated: number;
    lotsLinked: number;
    incomingStockLinked: number;
    manufacturingOrdersLinked: number;
    skippedExisting: number;
    errors: string[];
    details: {
      uniquePairs: number;
      existingCatalogItems: number;
    };
    timedOut?: boolean;
  };
}

interface MigrationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: MigrationProgress;
  onCheckStatus?: () => void;
  onRerunMigration?: () => void;
}

const MigrationProgressDialog: React.FC<MigrationProgressDialogProps> = ({
  open,
  onOpenChange,
  progress,
  onCheckStatus,
  onRerunMigration,
}) => {
  const { t } = useLanguage();
  const { isRunning, currentStep, processedItems, totalItems, errors, result } = progress;

  const percentage = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;
  const isTimedOut = result?.timedOut === true;

  return (
    <Dialog open={open} onOpenChange={isRunning ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => isRunning && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {isTimedOut
              ? t('catalog.migration.serverProcessing')
              : result 
                ? (result.success ? t('catalog.migration.migrationComplete') : t('catalog.migration.migrationFailed'))
                : t('catalog.migration.runningMigration')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Running state */}
          {isRunning && !result && (
            <>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{currentStep || t('catalog.migration.processing')}</span>
              </div>
              
              <div className="space-y-2">
                <Progress value={percentage} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {processedItems} / {totalItems} ({percentage}%)
                </p>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {t('catalog.migration.doNotClose')}
              </p>
            </>
          )}

          {/* Timeout state - server still processing */}
          {isTimedOut && (
            <>
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-md border border-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">{t('catalog.migration.timeoutTitle')}</p>
                  <p className="text-muted-foreground text-xs mt-1">{t('catalog.migration.timeoutDescription')}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {onCheckStatus && (
                  <Button 
                    variant="outline" 
                    onClick={onCheckStatus}
                    className="flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('catalog.migration.checkStatus')}
                  </Button>
                )}
                {onRerunMigration && (
                  <Button 
                    variant="default" 
                    onClick={onRerunMigration}
                    className="flex-1"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    {t('catalog.migration.rerunMigration')}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Normal result state (not timed out) */}
          {result && !isTimedOut && (
            <>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className={`font-medium ${result.success ? 'text-green-600' : 'text-destructive'}`}>
                  {result.success ? t('catalog.migration.success') : t('catalog.migration.failed')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <span className="text-muted-foreground">{t('catalog.migration.uniquePairs')}:</span>
                <span className="font-medium">{result.details?.uniquePairs || 0}</span>
                <span className="text-muted-foreground">{t('catalog.migration.existingItems')}:</span>
                <span className="font-medium">{result.details?.existingCatalogItems || 0}</span>
                <span className="text-muted-foreground">{t('catalog.migration.catalogItemsCreated')}:</span>
                <span className="font-medium text-green-600">{result.catalogItemsCreated}</span>
                <span className="text-muted-foreground">{t('catalog.migration.skippedExisting')}:</span>
                <span className="font-medium">{result.skippedExisting}</span>
                <span className="text-muted-foreground">{t('catalog.migration.lotsLinked')}:</span>
                <span className="font-medium">{result.lotsLinked}</span>
                <span className="text-muted-foreground">{t('catalog.migration.incomingStockLinked')}:</span>
                <span className="font-medium">{result.incomingStockLinked}</span>
                <span className="text-muted-foreground">{t('catalog.migration.manufacturingOrdersLinked')}:</span>
                <span className="font-medium">{result.manufacturingOrdersLinked}</span>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="bg-destructive/10 p-3 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{t('catalog.migration.errors')}:</p>
                  </div>
                  <ScrollArea className="h-32">
                    <ul className="text-xs text-destructive space-y-1">
                      {result.errors.map((err: string, i: number) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {/* Errors during run */}
          {!result && errors.length > 0 && (
            <div className="bg-destructive/10 p-3 rounded-md max-h-32 overflow-auto">
              <p className="text-sm font-medium text-destructive mb-1">{t('catalog.migration.errors')}:</p>
              <ul className="text-xs text-destructive space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Close button (only when not running and not timed out) */}
          {!isRunning && !isTimedOut && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </div>
          )}

          {/* Close button for timeout state */}
          {isTimedOut && (
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MigrationProgressDialog;
