import React, { useState, useEffect } from 'react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Activity, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Performance Overlay - Dev-only component for monitoring app performance
 * Toggle with Ctrl+Shift+P
 */
export function PerformanceOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { metrics, getAllMarks } = usePerformanceMetrics();

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+P to toggle
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isVisible) {
    return null;
  }

  const allMarks = getAllMarks();
  const formatMs = (ms: number | null | undefined) => 
    ms !== null && ms !== undefined ? `${ms.toFixed(0)}ms` : '—';

  return (
    <Card className="fixed bottom-4 left-4 z-[9999] bg-card/95 backdrop-blur-sm border shadow-lg min-w-[280px] text-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-semibold">Performance</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3">
          {/* Key Metrics */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Key Metrics
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <MetricRow label="Boot Time" value={formatMs(metrics.appBootMs)} />
              <MetricRow label="Auth Ready" value={formatMs(metrics.authReadyMs)} />
              <MetricRow label="MFA Check" value={formatMs(metrics.mfaCheckMs)} />
              <MetricRow label="Dashboard" value={formatMs(metrics.dashboardReadyMs)} />
            </div>
          </div>

          {/* Browser Metrics */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Browser
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <MetricRow label="FCP" value={formatMs(metrics.firstContentfulPaint)} />
              <MetricRow label="DOM Interactive" value={formatMs(metrics.domInteractive)} />
            </div>
          </div>

          {/* All Marks */}
          {Object.keys(allMarks).length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                All Marks
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {Object.entries(allMarks)
                  .sort((a, b) => a[1] - b[1])
                  .map(([name, time]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[160px]">
                        {name}
                      </span>
                      <span className="font-mono">{formatMs(time)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground text-center">
            Press Ctrl+Shift+P to toggle
          </div>
        </div>
      )}
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

export default PerformanceOverlay;
