import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatusBadgeProps {
  onClick?: () => void;
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ onClick, compact = false }) => {
  const { isOnline, syncStatus, forceSync } = useOffline();
  
  const totalPending = syncStatus.pendingCount + syncStatus.failedCount;
  const hasConflicts = syncStatus.conflictCount > 0;
  
  if (compact) {
    if (!isOnline) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="cursor-pointer" onClick={onClick}>
              <CloudOff className="h-3 w-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Offline - changes will sync when connected</TooltipContent>
        </Tooltip>
      );
    }
    
    if (hasConflicts) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="cursor-pointer animate-pulse" onClick={onClick}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {syncStatus.conflictCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{syncStatus.conflictCount} conflict(s) need resolution</TooltipContent>
        </Tooltip>
      );
    }
    
    if (totalPending > 0) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-pointer" onClick={onClick}>
              <RefreshCw className={`h-3 w-3 mr-1 ${syncStatus.isProcessing ? 'animate-spin' : ''}`} />
              {totalPending}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{totalPending} pending change(s)</TooltipContent>
        </Tooltip>
      );
    }
    
    return null;
  }
  
  // Full display
  return (
    <div className="flex items-center gap-2">
      {!isOnline ? (
        <Badge variant="destructive" className="flex items-center gap-1">
          <CloudOff className="h-3 w-3" />
          <span>Offline</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
          <Cloud className="h-3 w-3" />
          <span>Online</span>
        </Badge>
      )}
      
      {hasConflicts && (
        <Badge variant="destructive" className="flex items-center gap-1 cursor-pointer animate-pulse" onClick={onClick}>
          <AlertTriangle className="h-3 w-3" />
          <span>{syncStatus.conflictCount} Conflict{syncStatus.conflictCount > 1 ? 's' : ''}</span>
        </Badge>
      )}
      
      {totalPending > 0 && (
        <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${syncStatus.isProcessing ? 'animate-spin' : ''}`} />
          <span>{totalPending} Pending</span>
        </Badge>
      )}
      
      {syncStatus.lastSyncAt && (
        <span className="text-xs text-muted-foreground">
          Last sync: {formatDistanceToNow(syncStatus.lastSyncAt, { addSuffix: true })}
        </span>
      )}
      
      {isOnline && totalPending > 0 && !syncStatus.isProcessing && (
        <Button variant="ghost" size="sm" onClick={() => forceSync()}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Sync Now
        </Button>
      )}
    </div>
  );
};
