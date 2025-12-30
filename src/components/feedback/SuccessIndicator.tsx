import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuccessIndicatorProps {
  show: boolean;
  message?: string;
  variant?: 'checkmark' | 'badge' | 'inline';
  className?: string;
  duration?: number;
  onComplete?: () => void;
}

export function SuccessIndicator({ 
  show, 
  message, 
  variant = 'checkmark',
  className,
  duration = 2000,
  onComplete
}: SuccessIndicatorProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  if (!visible) return null;

  if (variant === 'checkmark') {
    return (
      <div className={cn(
        'fixed inset-0 flex items-center justify-center z-50 pointer-events-none',
        className
      )}>
        <div className="bg-background/80 backdrop-blur-sm rounded-full p-6 shadow-lg animate-scale-in">
          <svg
            className="h-16 w-16 text-green-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              className="opacity-20"
            />
            <path
              d="M7 13l3 3 7-7"
              className="animate-check-draw"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 20,
                strokeDashoffset: 20,
                animation: 'check-draw 0.4s ease-out 0.2s forwards'
              }}
            />
          </svg>
          {message && (
            <p className="text-sm font-medium text-center mt-2 text-foreground">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        'animate-fade-in',
        className
      )}>
        <Check className="h-3 w-3" />
        {message || 'Complete'}
      </div>
    );
  }

  // inline variant
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400',
      'animate-fade-in',
      className
    )}>
      <Check className="h-3 w-3" />
      {message || 'Saved'}
    </span>
  );
}

// CSS for the check animation - add to index.css or tailwind.config
// @keyframes check-draw {
//   to {
//     stroke-dashoffset: 0;
//   }
// }
