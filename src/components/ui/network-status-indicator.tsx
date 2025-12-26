import React from 'react';
import { WifiOff, Wifi, Signal } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NetworkStatusIndicatorProps {
  showLabel?: boolean;
  className?: string;
  compact?: boolean;
}

export function NetworkStatusIndicator({ 
  showLabel = false, 
  className,
  compact = false,
}: NetworkStatusIndicatorProps) {
  const { isOnline, isSlowConnection, connectionType } = useNetworkStatus();

  // Only show indicator when there's an issue or on mobile
  const showIndicator = !isOnline || isSlowConnection;

  if (!showIndicator && !showLabel) {
    return null;
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        label: 'Offline',
        description: 'No internet connection',
      };
    }
    
    if (isSlowConnection) {
      return {
        icon: Signal,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        label: 'Slow',
        description: `Slow connection (${connectionType})`,
      };
    }

    return {
      icon: Wifi,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      label: 'Online',
      description: connectionType ? `Connected (${connectionType})` : 'Connected',
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center justify-center rounded-full p-1",
            status.bgColor,
            className
          )}>
            <Icon className={cn("h-3.5 w-3.5", status.color)} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{status.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
      status.bgColor,
      status.color,
      className
    )}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span>{status.label}</span>}
    </div>
  );
}

// Full-screen offline banner for critical states
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium animate-fade-in">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>You are offline. Some features may be unavailable.</span>
      </div>
    </div>
  );
}

export default NetworkStatusIndicator;
