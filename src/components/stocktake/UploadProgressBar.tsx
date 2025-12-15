import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, ImageIcon, Upload, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'processing' | 'complete' | 'error';
  percent: number;
  message: string;
}

interface UploadProgressBarProps {
  progress: UploadProgress;
  className?: string;
}

const stageIcons = {
  compressing: ImageIcon,
  uploading: Upload,
  processing: Cpu,
  complete: CheckCircle2,
  error: XCircle,
};

const stageColors = {
  compressing: 'text-blue-500',
  uploading: 'text-amber-500',
  processing: 'text-purple-500',
  complete: 'text-green-500',
  error: 'text-destructive',
};

export const UploadProgressBar = ({ progress, className }: UploadProgressBarProps) => {
  const Icon = stageIcons[progress.stage];
  const isAnimating = progress.stage !== 'complete' && progress.stage !== 'error';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        {isAnimating ? (
          <Loader2 className={cn('h-4 w-4 animate-spin', stageColors[progress.stage])} />
        ) : (
          <Icon className={cn('h-4 w-4', stageColors[progress.stage])} />
        )}
        <span className="text-sm font-medium">{progress.message}</span>
      </div>
      
      <Progress 
        value={progress.percent} 
        className={cn(
          'h-2',
          progress.stage === 'error' && '[&>div]:bg-destructive'
        )}
      />

      {/* Stage indicators */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={cn(
          progress.stage === 'compressing' && 'text-foreground font-medium',
          ['uploading', 'processing', 'complete'].includes(progress.stage) && 'text-green-600'
        )}>
          Sıkıştır
        </span>
        <span className={cn(
          progress.stage === 'uploading' && 'text-foreground font-medium',
          ['processing', 'complete'].includes(progress.stage) && 'text-green-600'
        )}>
          Yükle
        </span>
        <span className={cn(
          progress.stage === 'processing' && 'text-foreground font-medium',
          progress.stage === 'complete' && 'text-green-600'
        )}>
          OCR
        </span>
        <span className={cn(
          progress.stage === 'complete' && 'text-green-600 font-medium'
        )}>
          Tamam
        </span>
      </div>
    </div>
  );
};
