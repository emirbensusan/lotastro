import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Check, X } from 'lucide-react';
import { QueuedMutation } from '@/hooks/useSyncQueue';
import { analyzeConflicts, formatValueForDisplay, applyResolutions, ConflictInfo } from '@/utils/conflictDetection';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: QueuedMutation[];
  onResolve: (id: string, resolution: 'local' | 'server' | 'merge', mergedData?: Record<string, unknown>) => Promise<void>;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  open,
  onOpenChange,
  conflicts,
  onResolve,
}) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, 'local' | 'server'>>({});
  const [isResolving, setIsResolving] = useState(false);
  
  const currentConflict = conflicts[currentIndex];
  
  if (!currentConflict) {
    return null;
  }
  
  const analysis = analyzeConflicts(
    currentConflict.originalData || {},
    currentConflict.data,
    currentConflict.originalData || {}
  );
  
  const handleFieldResolution = (field: string, value: 'local' | 'server') => {
    setResolutions(prev => ({ ...prev, [field]: value }));
  };
  
  const handleKeepMine = async () => {
    setIsResolving(true);
    await onResolve(currentConflict.id, 'local');
    moveToNext();
    setIsResolving(false);
  };
  
  const handleKeepServer = async () => {
    setIsResolving(true);
    await onResolve(currentConflict.id, 'server');
    moveToNext();
    setIsResolving(false);
  };
  
  const handleMerge = async () => {
    setIsResolving(true);
    const mergedData = applyResolutions(
      currentConflict.originalData || {},
      currentConflict.data,
      currentConflict.originalData || {},
      resolutions
    );
    await onResolve(currentConflict.id, 'merge', mergedData);
    moveToNext();
    setIsResolving(false);
  };
  
  const moveToNext = () => {
    setResolutions({});
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onOpenChange(false);
      setCurrentIndex(0);
    }
  };
  
  const allResolved = analysis.conflicts.every(c => resolutions[c.field]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Sync Conflict Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">
              {currentConflict.table} - {currentConflict.recordId.slice(0, 8)}...
            </Badge>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {conflicts.length}
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            The following fields were changed both locally and on the server. Choose which version to keep:
          </p>
          
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-4">
              {analysis.conflicts.map((conflict) => (
                <ConflictFieldRow
                  key={conflict.field}
                  conflict={conflict}
                  resolution={resolutions[conflict.field]}
                  onResolve={(value) => handleFieldResolution(conflict.field, value)}
                />
              ))}
              
              {analysis.conflicts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No field-level conflicts detected. Changes can be auto-merged.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleKeepServer} disabled={isResolving}>
            <X className="h-4 w-4 mr-1" />
            Keep Server Version
          </Button>
          <Button variant="outline" onClick={handleKeepMine} disabled={isResolving}>
            <Check className="h-4 w-4 mr-1" />
            Keep My Changes
          </Button>
          {analysis.conflicts.length > 0 && (
            <Button onClick={handleMerge} disabled={!allResolved || isResolving}>
              Merge Selected
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ConflictFieldRowProps {
  conflict: ConflictInfo;
  resolution?: 'local' | 'server';
  onResolve: (value: 'local' | 'server') => void;
}

const ConflictFieldRow: React.FC<ConflictFieldRowProps> = ({ conflict, resolution, onResolve }) => {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="font-medium text-sm capitalize">
        {conflict.field.replace(/_/g, ' ')}
      </div>
      
      <RadioGroup value={resolution} onValueChange={(v) => onResolve(v as 'local' | 'server')}>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-2 rounded border ${resolution === 'local' ? 'border-primary bg-primary/5' : ''}`}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id={`${conflict.field}-local`} />
              <Label htmlFor={`${conflict.field}-local`} className="text-xs font-medium">
                Your Change
              </Label>
            </div>
            <div className="mt-1 text-sm font-mono bg-muted p-1 rounded truncate">
              {formatValueForDisplay(conflict.localValue)}
            </div>
          </div>
          
          <div className={`p-2 rounded border ${resolution === 'server' ? 'border-primary bg-primary/5' : ''}`}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="server" id={`${conflict.field}-server`} />
              <Label htmlFor={`${conflict.field}-server`} className="text-xs font-medium">
                Server Version
              </Label>
            </div>
            <div className="mt-1 text-sm font-mono bg-muted p-1 rounded truncate">
              {formatValueForDisplay(conflict.serverValue)}
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
};
