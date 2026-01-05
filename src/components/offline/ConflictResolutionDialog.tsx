import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Check, X, ChevronLeft, ChevronRight, GitMerge, Clock, Database } from 'lucide-react';
import { QueuedMutation } from '@/hooks/useSyncQueue';
import { analyzeConflicts, formatValueForDisplay, applyResolutions, ConflictInfo } from '@/utils/conflictDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';

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
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  
  const currentConflict = conflicts[currentIndex];
  
  if (!currentConflict) {
    return null;
  }
  
  const analysis = useMemo(() => analyzeConflicts(
    currentConflict.originalData || {},
    currentConflict.data,
    currentConflict.originalData || {}
  ), [currentConflict]);
  
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

  const moveToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setResolutions({});
    }
  };
  
  const allResolved = analysis.conflicts.every(c => resolutions[c.field]);
  const progress = conflicts.length > 0 ? ((currentIndex) / conflicts.length) * 100 : 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]" data-owner="conflict-resolution">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Sync Conflict Resolution
          </DialogTitle>
          <DialogDescription>
            Changes were made both locally and on the server. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Resolving {currentIndex + 1} of {conflicts.length}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <div className="space-y-4">
          {/* Conflict metadata */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {currentConflict.table}
            </Badge>
            <Badge variant="secondary">
              {currentConflict.recordId.slice(0, 8)}...
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(currentConflict.createdAt, { addSuffix: true })}
            </Badge>
            <Badge variant={currentConflict.type === 'CREATE' ? 'default' : currentConflict.type === 'UPDATE' ? 'secondary' : 'destructive'}>
              {currentConflict.type}
            </Badge>
          </div>
          
          {/* View mode toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
              <TabsTrigger value="unified">Unified View</TabsTrigger>
            </TabsList>
            
            <TabsContent value="side-by-side" className="mt-4">
              <ScrollArea className="h-[350px] rounded-md border p-4">
                <div className="space-y-4">
                  {analysis.conflicts.length > 0 ? (
                    analysis.conflicts.map((conflict) => (
                      <ConflictFieldRow
                        key={conflict.field}
                        conflict={conflict}
                        resolution={resolutions[conflict.field]}
                        onResolve={(value) => handleFieldResolution(conflict.field, value)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <GitMerge className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">
                        No field-level conflicts detected. Changes can be auto-merged.
                      </p>
                    </div>
                  )}
                  
                  {analysis.autoMergeable.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                        Auto-Mergeable Changes ({analysis.autoMergeable.length})
                      </h4>
                      <div className="space-y-2">
                        {analysis.autoMergeable.slice(0, 5).map((item) => (
                          <div key={item.field} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                            <span className="capitalize">{item.field.replace(/_/g, ' ')}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.resolution === 'local' ? 'Your change' : 'Server update'}
                            </Badge>
                          </div>
                        ))}
                        {analysis.autoMergeable.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{analysis.autoMergeable.length - 5} more fields
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="unified" className="mt-4">
              <ScrollArea className="h-[350px] rounded-md border p-4">
                <div className="space-y-3">
                  {analysis.conflicts.map((conflict) => (
                    <div key={conflict.field} className="p-3 border rounded-lg space-y-2">
                      <div className="font-medium text-sm capitalize">
                        {conflict.field.replace(/_/g, ' ')}
                      </div>
                      <div className="grid gap-2 text-xs">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="shrink-0">Original</Badge>
                          <code className="bg-muted p-1 rounded flex-1 break-all">
                            {formatValueForDisplay(conflict.originalValue)}
                          </code>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="shrink-0">Yours</Badge>
                          <code className="bg-blue-500/10 p-1 rounded flex-1 break-all">
                            {formatValueForDisplay(conflict.localValue)}
                          </code>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="default" className="shrink-0">Server</Badge>
                          <code className="bg-green-500/10 p-1 rounded flex-1 break-all">
                            {formatValueForDisplay(conflict.serverValue)}
                          </code>
                        </div>
                      </div>
                      <RadioGroup 
                        value={resolutions[conflict.field]} 
                        onValueChange={(v) => handleFieldResolution(conflict.field, v as 'local' | 'server')}
                        className="flex gap-4 pt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="local" id={`unified-${conflict.field}-local`} />
                          <Label htmlFor={`unified-${conflict.field}-local`}>Keep mine</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="server" id={`unified-${conflict.field}-server`} />
                          <Label htmlFor={`unified-${conflict.field}-server`}>Use server</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-2 mr-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={moveToPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {conflicts.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={moveToNext}
              disabled={currentIndex === conflicts.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Actions */}
          <Button variant="outline" onClick={handleKeepServer} disabled={isResolving}>
            <X className="h-4 w-4 mr-1" />
            Keep Server
          </Button>
          <Button variant="outline" onClick={handleKeepMine} disabled={isResolving}>
            <Check className="h-4 w-4 mr-1" />
            Keep Mine
          </Button>
          {analysis.conflicts.length > 0 && (
            <Button onClick={handleMerge} disabled={!allResolved || isResolving}>
              <GitMerge className="h-4 w-4 mr-1" />
              Merge ({Object.keys(resolutions).length}/{analysis.conflicts.length})
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
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm capitalize">
          {conflict.field.replace(/_/g, ' ')}
        </div>
        {resolution && (
          <Badge variant="default" className="text-xs">
            {resolution === 'local' ? 'Your change selected' : 'Server selected'}
          </Badge>
        )}
      </div>
      
      <RadioGroup value={resolution} onValueChange={(v) => onResolve(v as 'local' | 'server')}>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              resolution === 'local' 
                ? 'border-primary bg-primary/5' 
                : 'border-transparent bg-muted hover:border-muted-foreground/20'
            }`}
            onClick={() => onResolve('local')}
          >
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="local" id={`${conflict.field}-local`} />
              <Label htmlFor={`${conflict.field}-local`} className="text-xs font-medium cursor-pointer">
                Your Change
              </Label>
            </div>
            <div className="text-sm font-mono bg-background p-2 rounded border break-all">
              {formatValueForDisplay(conflict.localValue)}
            </div>
          </div>
          
          <div 
            className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              resolution === 'server' 
                ? 'border-primary bg-primary/5' 
                : 'border-transparent bg-muted hover:border-muted-foreground/20'
            }`}
            onClick={() => onResolve('server')}
          >
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="server" id={`${conflict.field}-server`} />
              <Label htmlFor={`${conflict.field}-server`} className="text-xs font-medium cursor-pointer">
                Server Version
              </Label>
            </div>
            <div className="text-sm font-mono bg-background p-2 rounded border break-all">
              {formatValueForDisplay(conflict.serverValue)}
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
};
