import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useStockTakeUpload } from '@/hooks/useStockTakeUpload';
import { useStockTakeSession } from '@/hooks/useStockTakeSession';
import { useUploadRetry } from '@/hooks/useUploadRetry';
import { useStockTakeSettings } from '@/hooks/useStockTakeSettings';
import { useClientOCR } from '@/hooks/useClientOCR';
import { UploadProgressBar } from '@/components/stocktake/UploadProgressBar';
import { CameraCapture } from '@/components/stocktake/CameraCapture';
import { OCRConfirmDialog } from '@/components/stocktake/OCRConfirmDialog';
import PendingUploadsIndicator from '@/components/stocktake/PendingUploadsIndicator';
import { Camera, StopCircle, AlertTriangle, Play, ClipboardList, Clock, FlaskConical } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OCRData {
  quality: string;
  color: string;
  lotNumber: string;
  meters: number | null;
  confidence: {
    overallScore: number;
    level: 'high' | 'medium' | 'low';
  };
  isLikelyLabel: boolean;
  rawText: string;
}

const StockTakeCapture = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  
  const { uploadAndProcessImage, progress, isUploading, ocrTimedOut, resetProgress, skipOCR } = useStockTakeUpload();
  
  // Use retry/backup hook
  const {
    retryState,
    backupBeforeUpload,
    markUploadSuccess,
    markUploadFailed,
    retryFailedUploads,
    pendingCount,
  } = useUploadRetry();
  
  const [lastRetryResult, setLastRetryResult] = useState<{ succeeded: number; failed: number } | null>(null);
  
  // Fetch stock take settings (including session timeout)
  const { settings: stockTakeSettings, isLoading: settingsLoading } = useStockTakeSettings();
  
  // Use the session management hook with timeout handling
  const {
    session,
    isLoading,
    isExpiring,
    hasExistingSession,
    startSession,
    endSession,
    cancelSession,
    keepSessionActive,
  } = useStockTakeSession({
    userId: user?.id,
    timeoutMinutes: stockTakeSettings.session_timeout_minutes,
    onSessionExpired: () => navigate('/'),
  });
  
  const [isStartingSession, setIsStartingSession] = useState(false);
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [showOCRConfirm, setShowOCRConfirm] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [captureSequence, setCaptureSequence] = useState(1);
  
  // OCR test state
  const [isTestingOCR, setIsTestingOCR] = useState(false);
  const { runOCR, isProcessing: isOCRProcessing, progress: ocrProgress, progressMessage } = useClientOCR();

  // Check permissions - use database format (no underscores)
  const canStartSession = hasPermission('stocktake', 'startsession');

  // Handle photo capture
  const handleCapture = useCallback((imageDataUrl: string) => {
    console.log('[StockTakeCapture] ========== HANDLE CAPTURE ==========');
    console.log('[StockTakeCapture] Received imageDataUrl type:', typeof imageDataUrl);
    console.log('[StockTakeCapture] Received imageDataUrl length:', imageDataUrl?.length || 0);
    console.log('[StockTakeCapture] Received imageDataUrl prefix:', imageDataUrl?.substring(0, 50));
    console.log('[StockTakeCapture] Is valid data URL?', imageDataUrl?.startsWith('data:image/'));
    
    if (!imageDataUrl || imageDataUrl.length < 100) {
      console.error('[StockTakeCapture] ❌ Invalid image data received!');
      toast({
        title: 'Error',
        description: 'Invalid image data received from camera/crop',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('[StockTakeCapture] ✅ Valid image data, proceeding...');
    setCapturedImage(imageDataUrl);
    setShowCamera(false);
    processImage(imageDataUrl);
  }, [session, captureSequence, toast]);

  // State for current roll being processed
  const [currentRollId, setCurrentRollId] = useState<string | null>(null);
  const [currentStoragePath, setCurrentStoragePath] = useState<string | null>(null);

  // Process captured image with backup
  const processImage = async (imageDataUrl: string) => {
    if (!session || !user) return;

    // Save backup before upload attempt
    let backupId = '';
    try {
      backupId = await backupBeforeUpload(session.id, captureSequence, user.id, imageDataUrl);
    } catch (err) {
      console.warn('[StockTakeCapture] Backup failed, continuing without:', err);
    }

    try {
      const result = await uploadAndProcessImage(
        imageDataUrl, 
        session.id, 
        captureSequence,
        user.id,
        true // Use async OCR
      );
      
      if (!result.upload.success) {
        // Mark backup as failed for retry
        if (backupId) {
          await markUploadFailed(backupId, result.upload.error || 'Upload failed');
        }
        toast({
          title: String(t('stocktake.uploadFailed')),
          description: result.upload.error,
          variant: 'destructive',
        });
        return;
      }

      // Upload succeeded - remove backup
      if (backupId) {
        await markUploadSuccess(backupId);
      }

      // Store roll info for later update
      if (result.rollId) {
        setCurrentRollId(result.rollId);
      }
      if (result.upload.storagePath) {
        setCurrentStoragePath(result.upload.storagePath);
      }

      // Prepare OCR data for confirmation
      const ocr = result.ocr;
      if (ocr?.success) {
        setOcrData({
          quality: ocr.extracted?.quality || '',
          color: ocr.extracted?.color || '',
          lotNumber: ocr.extracted?.lotNumber || '',
          meters: ocr.extracted?.meters || null,
          confidence: ocr.confidence || { overallScore: 0, level: 'low' },
          isLikelyLabel: ocr.validation?.isLikelyLabel || false,
          rawText: ocr.ocr?.rawText || '',
        });
      } else {
        // OCR failed or timed out, set empty data for manual entry
        setOcrData({
          quality: '',
          color: '',
          lotNumber: '',
          meters: null,
          confidence: { overallScore: 0, level: 'low' },
          isLikelyLabel: false,
          rawText: ocr?.timedOut ? 'OCR_TIMEOUT' : '',
        });
      }
      
      setShowOCRConfirm(true);
    } catch (error) {
      console.error('[StockTakeCapture] Process error:', error);
      // Mark backup as failed for retry
      if (backupId) {
        await markUploadFailed(backupId, (error as Error).message);
      }
      toast({
        title: String(t('error')),
        description: String(t('stocktake.processingError')),
        variant: 'destructive',
      });
    }
  };

  // Handle retry of failed uploads
  const handleRetryUploads = async () => {
    setLastRetryResult(null);
    const result = await retryFailedUploads(async (upload) => {
      if (!session) return false;
      
      try {
        const uploadResult = await uploadAndProcessImage(
          upload.imageDataUrl,
          upload.sessionId,
          upload.captureSequence,
          upload.userId,
          true
        );
        return uploadResult.upload.success;
      } catch {
        return false;
      }
    });
    
    setLastRetryResult(result);
    
    if (result.succeeded > 0) {
      toast({
        title: t('stocktake.retrySuccess') as string,
        description: `${result.succeeded} ${t('stocktake.uploadsSucceeded')}`,
      });
    }
  };

  // Handle proceeding with manual entry when OCR times out
  const handleProceedManual = () => {
    skipOCR();
    setOcrData({
      quality: '',
      color: '',
      lotNumber: '',
      meters: null,
      confidence: { overallScore: 0, level: 'low' },
      isLikelyLabel: false,
      rawText: 'MANUAL_ENTRY',
    });
    setShowOCRConfirm(true);
  };

  // Handle OCR confirmation
  const handleOCRConfirm = async (confirmedData: {
    quality: string;
    color: string;
    lotNumber: string;
    meters: number;
    isManualEntry: boolean;
    editReason?: string;
    editReasonOther?: string;
    fieldsEdited?: string[];
  }) => {
    if (!session) return;

    try {
      // Update existing roll record (created during upload)
      if (currentRollId) {
        const { error } = await supabase
          .from('count_rolls')
          .update({
            counter_quality: confirmedData.quality.toUpperCase(),
            counter_color: confirmedData.color.toUpperCase(),
            counter_lot_number: confirmedData.lotNumber.toUpperCase(),
            counter_meters: confirmedData.meters,
            counter_confirmed_at: new Date().toISOString(),
            is_manual_entry: confirmedData.isManualEntry,
            manual_edit_reason: confirmedData.editReason as any,
            manual_edit_reason_other: confirmedData.editReasonOther,
            fields_manually_edited: confirmedData.fieldsEdited,
            // Update OCR status if it was skipped
            ocr_status: ocrData?.rawText === 'MANUAL_ENTRY' ? 'skipped' : undefined,
          })
          .eq('id', currentRollId);

        if (error) throw error;
      } else {
        // Fallback: Insert new record (shouldn't happen in normal flow)
        const { error } = await supabase
          .from('count_rolls')
          .insert({
            session_id: session.id,
            capture_sequence: captureSequence,
            photo_path: currentStoragePath || `${session.id}/${captureSequence}_${Date.now()}.jpg`,
            photo_hash_sha256: '',
            counter_quality: confirmedData.quality.toUpperCase(),
            counter_color: confirmedData.color.toUpperCase(),
            counter_lot_number: confirmedData.lotNumber.toUpperCase(),
            counter_meters: confirmedData.meters,
            captured_by: user!.id,
            is_manual_entry: confirmedData.isManualEntry,
            manual_edit_reason: confirmedData.editReason as any,
            manual_edit_reason_other: confirmedData.editReasonOther,
            fields_manually_edited: confirmedData.fieldsEdited,
            ocr_quality: ocrData?.quality,
            ocr_color: ocrData?.color,
            ocr_lot_number: ocrData?.lotNumber,
            ocr_meters: ocrData?.meters,
            ocr_confidence_score: ocrData?.confidence.overallScore,
            ocr_confidence_level: ocrData?.confidence.level as any,
            ocr_raw_text: ocrData?.rawText,
            ocr_processed_at: new Date().toISOString(),
            is_not_label_warning: !ocrData?.isLikelyLabel,
            ocr_status: 'completed',
          });

        if (error) throw error;
      }

      // Update session activity
      await supabase
        .from('count_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', session.id);

      toast({
        title: String(t('stocktake.rollSaved')),
        description: `${String(t('stocktake.rollNumber'))}: ${captureSequence}`,
      });

      // Reset for next capture
      setCaptureSequence(prev => prev + 1);
      setCapturedImage(null);
      setOcrData(null);
      setShowOCRConfirm(false);
      setCurrentRollId(null);
      setCurrentStoragePath(null);
      resetProgress();
      
    } catch (error) {
      console.error('[StockTakeCapture] Save error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.saveFailed')),
        variant: 'destructive',
      });
    }
  };

  // Handle retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setOcrData(null);
    setShowOCRConfirm(false);
    resetProgress();
    setShowCamera(true);
  };

  // Handle end session
  const handleEndSession = async () => {
    if (!session) return;

    try {
      await supabase
        .from('count_sessions')
        .update({
          status: 'counting_complete',
          completed_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      toast({
        title: String(t('stocktake.sessionEnded')),
        description: `${String(t('stocktake.totalRolls'))}: ${captureSequence - 1}`,
      });

      navigate('/');
    } catch (error) {
      console.error('[StockTakeCapture] End session error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.endSessionError')),
        variant: 'destructive',
      });
    }
  };

  // Handle cancel session
  const handleCancelSession = async () => {
    if (!session) return;

    try {
      await supabase
        .from('count_sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      toast({
        title: String(t('stocktake.sessionCancelled')),
      });

      navigate('/');
    } catch (error) {
      console.error('[StockTakeCapture] Cancel error:', error);
    }
  };

  // Permission check
  if (!permissionsLoading && !canStartSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">{String(t('accessDenied'))}</h2>
        <p className="text-muted-foreground text-center">{String(t('stocktake.noPermission'))}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading || permissionsLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Handle starting a new session
  const handleStartSession = async () => {
    setIsStartingSession(true);
    try {
      await startSession();
    } finally {
      setIsStartingSession(false);
    }
  };

  // TEST OCR: Generate a test image with text and run OCR on it
  const handleTestOCR = async () => {
    setIsTestingOCR(true);
    console.log('[StockTakeCapture] ========== TEST OCR START ==========');
    
    try {
      // Create a canvas with test text
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('[StockTakeCapture] Failed to get canvas context');
        toast({ title: 'Error', description: 'Failed to create test image', variant: 'destructive' });
        return;
      }

      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 200);
      
      // Black text
      ctx.fillStyle = 'black';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('Quality: A800', 20, 40);
      ctx.fillText('Color: RED 1234', 20, 80);
      ctx.fillText('Lot: LOT-2024-001', 20, 120);
      ctx.fillText('Meters: 500', 20, 160);
      
      // Convert to data URL
      const testImageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      console.log('[StockTakeCapture] Test image created, length:', testImageDataUrl.length);
      console.log('[StockTakeCapture] Test image preview (first 100 chars):', testImageDataUrl.substring(0, 100));
      
      // Run OCR
      console.log('[StockTakeCapture] Calling runOCR on test image...');
      const result = await runOCR(testImageDataUrl);
      
      console.log('[StockTakeCapture] ========== TEST OCR RESULT ==========');
      console.log('[StockTakeCapture] Success:', result.success);
      console.log('[StockTakeCapture] Raw Text:', result.ocr?.rawText);
      console.log('[StockTakeCapture] Extracted:', result.extracted);
      console.log('[StockTakeCapture] Confidence:', result.confidence);
      console.log('[StockTakeCapture] Error:', result.error);
      console.log('[StockTakeCapture] Full result:', JSON.stringify(result, null, 2));
      
      // Show result in toast
      if (result.success && result.ocr?.rawText) {
        toast({
          title: '✅ OCR Test SUCCESS',
          description: `Extracted: "${result.ocr.rawText.substring(0, 80)}..."`,
        });
      } else {
        toast({
          title: '❌ OCR Test FAILED',
          description: result.error || 'No text extracted - check console',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[StockTakeCapture] Test OCR error:', error);
      toast({
        title: 'Test Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsTestingOCR(false);
      console.log('[StockTakeCapture] ========== TEST OCR END ==========');
    }
  };

  // Welcome screen - shown when no active session
  if (!session && !isStartingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">{String(t('stocktake.welcome.title'))}</h1>
              <p className="text-muted-foreground">
                {hasExistingSession 
                  ? String(t('stocktake.welcome.resumeDescription'))
                  : String(t('stocktake.welcome.description'))
                }
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-3 bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{String(t('stocktake.welcome.instruction1'))}</p>
              </div>
              <div className="flex items-start gap-3">
                <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{String(t('stocktake.welcome.instruction2'))}</p>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{String(t('stocktake.welcome.instruction3', { minutes: stockTakeSettings.session_timeout_minutes }))}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button 
                size="lg" 
                className="w-full h-14 text-lg font-semibold"
                onClick={handleStartSession}
                disabled={isStartingSession}
              >
                {isStartingSession ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {hasExistingSession 
                  ? String(t('stocktake.welcome.resumeButton'))
                  : String(t('stocktake.welcome.startButton'))
                }
              </Button>
              
              {/* TEST OCR Button - Debug only */}
              <Button 
                variant="outline"
                size="lg"
                className="w-full h-12 border-dashed border-amber-500 text-amber-600 hover:bg-amber-50"
                onClick={handleTestOCR}
                disabled={isTestingOCR}
              >
                {isTestingOCR ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2" />
                    Testing OCR... ({Math.round(ocrProgress)}%)
                  </>
                ) : (
                  <>
                    <FlaskConical className="h-4 w-4 mr-2" />
                    🧪 Test OCR (Debug)
                  </>
                )}
              </Button>
              {isTestingOCR && progressMessage && (
                <p className="text-xs text-center text-muted-foreground">{progressMessage}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Starting session loading state
  if (isStartingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{String(t('stocktake.welcome.starting'))}</p>
      </div>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCapture}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 space-y-6">
      {/* Session info */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          {String(t('stocktake.session'))}: <span className="font-mono font-medium">{session?.session_number}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {String(t('stocktake.rollsCounted'))}: <span className="font-bold text-foreground">{captureSequence - 1}</span>
        </p>
      </div>

      {/* Session expiring warning */}
      {isExpiring && (
        <Card className="w-full max-w-sm border-destructive bg-destructive/10">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium">{String(t('stocktake.sessionExpiringSoon'))}</span>
            </div>
            <Button size="sm" variant="outline" onClick={keepSessionActive}>
              {String(t('stocktake.keepSessionActive'))}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending uploads indicator */}
      {pendingCount > 0 && !isUploading && (
        <div className="w-full max-w-sm">
          <PendingUploadsIndicator
            pendingCount={pendingCount}
            isRetrying={retryState.isRetrying}
            currentRetry={retryState.currentRetry}
            maxRetries={retryState.maxRetries}
            nextRetryIn={retryState.nextRetryIn}
            lastRetryResult={lastRetryResult}
            onRetryClick={handleRetryUploads}
          />
        </div>
      )}

      {/* Progress bar when uploading */}
      {isUploading && (
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <UploadProgressBar progress={progress} onProceedManual={handleProceedManual} />
          </CardContent>
        </Card>
      )}

      {/* Main action buttons - MINIMAL UI */}
      {!isUploading && !showOCRConfirm && (
        <div className="flex flex-col items-center space-y-4 w-full max-w-sm">
          {/* Take Photo - Primary action */}
          <Button
            size="lg"
            className="w-full h-20 text-xl font-semibold"
            onClick={() => setShowCamera(true)}
          >
            <Camera className="h-8 w-8 mr-3" />
            {String(t('stocktake.takePhoto'))}
          </Button>

          {/* End Session - Secondary action */}
          <Button
            variant="outline"
            size="lg"
            className="w-full h-14"
            onClick={() => setShowEndSessionDialog(true)}
            disabled={captureSequence === 1}
          >
            <StopCircle className="h-5 w-5 mr-2" />
            {String(t('stocktake.endSession'))}
          </Button>

          {/* Cancel Session - Only after first capture */}
          {captureSequence > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              {String(t('stocktake.cancelSession'))}
            </Button>
          )}
        </div>
      )}

      {/* OCR Confirmation Dialog */}
      <OCRConfirmDialog
        open={showOCRConfirm}
        onOpenChange={setShowOCRConfirm}
        imageUrl={capturedImage || ''}
        ocrData={ocrData}
        onConfirm={handleOCRConfirm}
        onRetake={handleRetake}
      />

      {/* End Session Confirmation */}
      <AlertDialog open={showEndSessionDialog} onOpenChange={setShowEndSessionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.endSessionConfirmTitle'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.endSessionConfirmDesc')).replace('{count}', String(captureSequence - 1))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndSession}>
              {String(t('stocktake.endSession'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Session Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{String(t('stocktake.cancelSessionConfirmTitle'))}</AlertDialogTitle>
            <AlertDialogDescription>
              {String(t('stocktake.cancelSessionConfirmDesc'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{String(t('cancel'))}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {String(t('stocktake.cancelSession'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockTakeCapture;
