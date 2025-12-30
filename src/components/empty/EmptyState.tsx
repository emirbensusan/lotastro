import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'success' | 'filtered';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className
}: EmptyStateProps) {
  const iconColors = {
    default: 'text-muted-foreground',
    success: 'text-green-600 dark:text-green-400',
    filtered: 'text-muted-foreground'
  };

  const bgColors = {
    default: 'bg-muted/30',
    success: 'bg-green-50 dark:bg-green-900/10',
    filtered: 'bg-muted/30'
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className={cn(
        'rounded-full p-4 mb-4',
        bgColors[variant]
      )}>
        <Icon className={cn('h-8 w-8', iconColors[variant])} />
      </div>
      
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
