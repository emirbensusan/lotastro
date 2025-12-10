import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export interface QualityStep {
  quality: string;
  status: 'completed' | 'current' | 'pending';
  colorsCompleted?: number;
  totalColors?: number;
}

interface MultiOrderProgressStepperProps {
  steps: QualityStep[];
  currentQuality?: string;
  className?: string;
}

const MultiOrderProgressStepper: React.FC<MultiOrderProgressStepperProps> = ({
  steps,
  currentQuality,
  className,
}) => {
  const { t } = useLanguage();

  if (steps.length <= 1) return null;

  return (
    <div className={cn("bg-card border rounded-lg p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t('multiOrderProgress')}
        </span>
        <Badge variant="outline" className="text-xs">
          {steps.filter(s => s.status === 'completed').length} / {steps.length} {t('qualitiesCompleted')}
        </Badge>
      </div>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <React.Fragment key={step.quality}>
            {/* Step indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status icon */}
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full",
                step.status === 'completed' && "bg-green-100 dark:bg-green-900/30",
                step.status === 'current' && "bg-primary/20",
                step.status === 'pending' && "bg-muted"
              )}>
                {step.status === 'completed' && (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
                {step.status === 'current' && (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                )}
                {step.status === 'pending' && (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              {/* Quality name */}
              <div className="flex flex-col">
                <span className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  step.status === 'completed' && "text-green-600 dark:text-green-400",
                  step.status === 'current' && "text-primary",
                  step.status === 'pending' && "text-muted-foreground"
                )}>
                  {step.quality}
                </span>
                {step.status === 'current' && step.totalColors && (
                  <span className="text-xs text-muted-foreground">
                    {t('colorProgress')} {step.colorsCompleted || 0}/{step.totalColors}
                  </span>
                )}
              </div>
            </div>
            
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className={cn(
                "h-0.5 w-8 flex-shrink-0",
                steps[index + 1].status === 'pending' ? "bg-muted" : "bg-primary"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default MultiOrderProgressStepper;
