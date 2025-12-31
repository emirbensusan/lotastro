import React from 'react';
import { RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DataFreshnessProps {
  lastUpdated: Date | null | undefined;
  staleAfterMinutes?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  compact?: boolean;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

export function DataFreshness({
  lastUpdated,
  staleAfterMinutes = 10,
  onRefresh,
  isRefreshing,
  className,
  compact = false,
}: DataFreshnessProps) {
  const isStale = lastUpdated
    ? (Date.now() - lastUpdated.getTime()) > staleAfterMinutes * 60 * 1000
    : false;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', className)}
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                isRefreshing && 'animate-spin',
                isStale && 'text-amber-500'
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {lastUpdated ? (
            <span>Updated {formatRelativeTime(lastUpdated)}</span>
          ) : (
            <span>Never updated</span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground',
        className
      )}
    >
      {isStale ? (
        <AlertTriangle className="h-3 w-3 text-amber-500" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <span className={cn(isStale && 'text-amber-600')}>
        {lastUpdated ? (
          <>Updated {formatRelativeTime(lastUpdated)}</>
        ) : (
          'Loading...'
        )}
      </span>
      {onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn('h-3 w-3 mr-1', isRefreshing && 'animate-spin')}
          />
          Refresh
        </Button>
      )}
    </div>
  );
}
