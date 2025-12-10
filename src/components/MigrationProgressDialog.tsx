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
  };
}

interface MigrationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: MigrationProgress;
}

const MigrationProgressDialog: React.FC<MigrationProgressDialogProps> = ({
  open,
  onOpenChange,
  progress,
}) => {
  const { t } = useLanguage();
  const { isRunning, currentStep, processedItems, totalItems, errors, result } = progress;

  const percentage = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={isRunning ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => isRunning && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {result 
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

          {/* Result state */}
          {result && (
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

          {/* Close button (only when not running) */}
          {!isRunning && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
