import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  threshold?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  className,
  threshold = 80,
}: PullToRefreshProps) {
  const {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress,
    canRefresh,
  } = usePullToRefresh({ onRefresh, threshold });

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-opacity duration-200 z-10 pointer-events-none",
          isPulling || isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: 0,
          height: `${Math.max(pullDistance, isRefreshing ? threshold : 0)}px`,
          transform: `translateY(${-threshold + pullDistance}px)`,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm transition-transform",
            canRefresh && "scale-110"
          )}
          style={{
            transform: `rotate(${pullProgress * 180}deg)`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <ArrowDown 
              className={cn(
                "h-5 w-5 transition-colors",
                canRefresh ? "text-primary" : "text-muted-foreground"
              )} 
            />
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
