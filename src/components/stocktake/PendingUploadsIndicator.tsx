import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface PendingUploadsIndicatorProps {
  pendingCount: number;
  isRetrying: boolean;
  currentRetry: number;
  maxRetries: number;
  nextRetryIn: number | null;
  lastRetryResult?: { succeeded: number; failed: number } | null;
  onRetryClick: () => void;
}

const PendingUploadsIndicator: React.FC<PendingUploadsIndicatorProps> = ({
  pendingCount,
  isRetrying,
  currentRetry,
  maxRetries,
  nextRetryIn,
  lastRetryResult,
  onRetryClick,
}) => {
  const { language } = useLanguage();

  if (pendingCount === 0 && !lastRetryResult) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Pending uploads alert */}
      {pendingCount > 0 && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              {language === 'tr' 
                ? `${pendingCount} yükleme bekliyor` 
                : `${pendingCount} upload(s) pending`}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={onRetryClick}
              disabled={isRetrying}
              className="ml-2"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  {language === 'tr' ? 'Deneniyor...' : 'Retrying...'}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {language === 'tr' ? 'Yeniden Dene' : 'Retry'}
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Retry progress */}
      {isRetrying && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {language === 'tr' 
              ? `Deneme ${currentRetry}/${maxRetries}` 
              : `Attempt ${currentRetry}/${maxRetries}`}
            {nextRetryIn && (
              <span className="ml-1">
                ({language === 'tr' ? 'sonraki' : 'next in'} {Math.ceil(nextRetryIn / 1000)}s)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Last retry result */}
      {lastRetryResult && !isRetrying && (
        <div className="flex items-center gap-2">
          {lastRetryResult.succeeded > 0 && (
            <Badge variant="outline" className="border-green-500/50 text-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              {lastRetryResult.succeeded} {language === 'tr' ? 'başarılı' : 'succeeded'}
            </Badge>
          )}
          {lastRetryResult.failed > 0 && (
            <Badge variant="outline" className="border-red-500/50 text-red-600">
              <XCircle className="mr-1 h-3 w-3" />
              {lastRetryResult.failed} {language === 'tr' ? 'başarısız' : 'failed'}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default PendingUploadsIndicator;
