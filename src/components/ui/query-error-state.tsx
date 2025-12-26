import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QueryErrorStateProps {
  error: Error | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
  compact?: boolean;
  title?: string;
}

type ErrorType = 'network' | 'auth' | 'server' | 'unknown';

function getErrorType(error: Error | null): ErrorType {
  if (!error) return 'unknown';
  
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return 'network';
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('auth') || message.includes('jwt')) {
    return 'auth';
  }
  if (message.includes('500') || message.includes('server') || message.includes('internal')) {
    return 'server';
  }
  
  return 'unknown';
}

const errorConfig: Record<ErrorType, { icon: React.ElementType; title: string; description: string }> = {
  network: {
    icon: WifiOff,
    title: 'Connection Error',
    description: 'Unable to connect. Please check your internet connection and try again.',
  },
  auth: {
    icon: ShieldAlert,
    title: 'Authentication Error',
    description: 'Your session may have expired. Please try refreshing or signing in again.',
  },
  server: {
    icon: ServerCrash,
    title: 'Server Error',
    description: 'Something went wrong on our end. Please try again in a moment.',
  },
  unknown: {
    icon: AlertTriangle,
    title: 'Error Loading Data',
    description: 'An unexpected error occurred. Please try again.',
  },
};

export function QueryErrorState({ 
  error, 
  onRetry, 
  isRetrying = false,
  className,
  compact = false,
  title: customTitle,
}: QueryErrorStateProps) {
  const errorType = getErrorType(error);
  const config = errorConfig[errorType];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-lg",
        className
      )}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            {customTitle || config.title}
          </span>
        </div>
        {onRetry && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-7 text-xs"
          >
            {isRetrying ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border-destructive/20", className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="font-semibold text-lg mb-1">
          {customTitle || config.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {config.description}
        </p>
        {error?.message && (
          <p className="text-xs text-muted-foreground/70 mb-4 font-mono max-w-sm truncate">
            {error.message}
          </p>
        )}
        {onRetry && (
          <Button 
            variant="outline" 
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default QueryErrorState;
