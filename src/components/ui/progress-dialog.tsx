import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface ProgressDialogProps {
  isOpen: boolean;
  title: string;
  progress: number;
  statusText: string;
  isComplete: boolean;
  onComplete?: () => void;
}

export const ProgressDialog: React.FC<ProgressDialogProps> = ({
  isOpen,
  title,
  progress,
  statusText,
  isComplete,
  onComplete
}) => {
  useEffect(() => {
    if (isComplete && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete && <CheckCircle className="h-5 w-5 text-green-600" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Progress value={progress} className="w-full" />
          
          <div className="text-sm text-muted-foreground">
            {isComplete ? (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle className="h-4 w-4" />
                Successful
              </div>
            ) : (
              statusText
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {progress}% complete
          </div>
        </div>
        
        {isComplete && (
          <div className="flex justify-end">
            <Button onClick={onComplete} size="sm">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};