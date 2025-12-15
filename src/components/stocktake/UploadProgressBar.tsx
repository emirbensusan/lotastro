import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, ImageIcon, Upload, Cpu, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'queued' | 'processing' | 'complete' | 'error' | 'timeout';
  percent: number;
  message: string;
}

interface UploadProgressBarProps {
  progress: UploadProgress;
  className?: string;
  onProceedManual?: () => void;
}

const stageIcons = {
  compressing: ImageIcon,
  uploading: Upload,
  queued: Clock,
  processing: Cpu,
  complete: CheckCircle2,
  error: XCircle,
  timeout: AlertTriangle,
};

const stageColors = {
  compressing: 'text-blue-500',
  uploading: 'text-amber-500',
  queued: 'text-cyan-500',
  processing: 'text-purple-500',
  complete: 'text-green-500',
  error: 'text-destructive',
  timeout: 'text-amber-500',
};

export const UploadProgressBar = ({ progress, className, onProceedManual }: UploadProgressBarProps) => {
  const Icon = stageIcons[progress.stage];
  const isAnimating = !['complete', 'error', 'timeout'].includes(progress.stage);

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
          progress.stage === 'error' && '[&>div]:bg-destructive',
          progress.stage === 'timeout' && '[&>div]:bg-amber-500'
        )}
      />

      {/* Timeout action button */}
      {progress.stage === 'timeout' && onProceedManual && (
        <button
          onClick={onProceedManual}
          className="w-full mt-2 py-2 px-4 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900 rounded-md transition-colors"
        >
          Manuel Giriş Yap
        </button>
      )}

      {/* Stage indicators */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={cn(
          progress.stage === 'compressing' && 'text-foreground font-medium',
          ['uploading', 'queued', 'processing', 'complete'].includes(progress.stage) && 'text-green-600'
        )}>
          Sıkıştır
        </span>
        <span className={cn(
          progress.stage === 'uploading' && 'text-foreground font-medium',
          ['queued', 'processing', 'complete'].includes(progress.stage) && 'text-green-600'
        )}>
          Yükle
        </span>
        <span className={cn(
          ['queued', 'processing'].includes(progress.stage) && 'text-foreground font-medium',
          progress.stage === 'complete' && 'text-green-600',
          progress.stage === 'timeout' && 'text-amber-500 font-medium'
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
