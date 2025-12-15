import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, ImageIcon, Upload, Cpu, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'ocr' | 'complete' | 'error' | 'timeout';
  percent: number;
  message: string;
  ocrProgress?: number; // 0-100 for OCR stage
}

interface UploadProgressBarProps {
  progress: UploadProgress;
  className?: string;
  onProceedManual?: () => void;
}

const stageIcons = {
  compressing: ImageIcon,
  uploading: Upload,
  ocr: Cpu,
  complete: CheckCircle2,
  error: XCircle,
  timeout: AlertTriangle,
};

const stageColors = {
  compressing: 'text-blue-500',
  uploading: 'text-amber-500',
  ocr: 'text-purple-500',
  complete: 'text-green-500',
  error: 'text-destructive',
  timeout: 'text-amber-500',
};

export const UploadProgressBar = ({ progress, className, onProceedManual }: UploadProgressBarProps) => {
  const Icon = stageIcons[progress.stage];
  const isAnimating = !['complete', 'error', 'timeout'].includes(progress.stage);

  // Calculate display percent - use ocrProgress when in OCR stage
  const displayPercent = progress.stage === 'ocr' && progress.ocrProgress !== undefined
    ? 50 + (progress.ocrProgress * 0.5) // OCR is 50-100% of total
    : progress.percent;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        {isAnimating ? (
          <Loader2 className={cn('h-4 w-4 animate-spin', stageColors[progress.stage])} />
        ) : (
          <Icon className={cn('h-4 w-4', stageColors[progress.stage])} />
        )}
        <span className="text-sm font-medium">{progress.message}</span>
        {progress.stage === 'ocr' && progress.ocrProgress !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto">
            {progress.ocrProgress}%
          </span>
        )}
      </div>
      
      <Progress 
        value={displayPercent} 
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
          ['uploading', 'ocr', 'complete'].includes(progress.stage) && 'text-green-600'
        )}>
          Sıkıştır
        </span>
        <span className={cn(
          progress.stage === 'uploading' && 'text-foreground font-medium',
          ['ocr', 'complete'].includes(progress.stage) && 'text-green-600'
        )}>
          Yükle
        </span>
        <span className={cn(
          progress.stage === 'ocr' && 'text-foreground font-medium',
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
