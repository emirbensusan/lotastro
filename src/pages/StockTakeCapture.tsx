import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useStockTakeUpload } from '@/hooks/useStockTakeUpload';
import { UploadProgressBar } from '@/components/stocktake/UploadProgressBar';
import { CameraCapture } from '@/components/stocktake/CameraCapture';
import { OCRConfirmDialog } from '@/components/stocktake/OCRConfirmDialog';
import { Camera, StopCircle, AlertTriangle } from 'lucide-react';
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

interface CountSession {
  id: string;
  session_number: string;
  status: string;
  total_rolls_counted: number;
}

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
  
  const { uploadAndProcessImage, progress, isUploading, resetProgress } = useStockTakeUpload();
  
  const [session, setSession] = useState<CountSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [showOCRConfirm, setShowOCRConfirm] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [captureSequence, setCaptureSequence] = useState(1);

  // Check permissions
  const canStartSession = hasPermission('stocktake', 'start_session');

  // Load or create session on mount
  useEffect(() => {
    if (!permissionsLoading && user) {
      loadOrCreateSession();
    }
  }, [user, permissionsLoading]);

  const loadOrCreateSession = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Check for existing active session
      const { data: existingSession, error: fetchError } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('started_by', user.id)
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingSession && !fetchError) {
        setSession(existingSession as CountSession);
        setCaptureSequence(existingSession.total_rolls_counted + 1);
        
        // Update status to active if draft
        if (existingSession.status === 'draft') {
          await supabase
            .from('count_sessions')
            .update({ status: 'active' })
            .eq('id', existingSession.id);
        }
      } else {
        // Create new session
        const { data: sessionNumber } = await supabase.rpc('generate_count_session_number');
        
        const { data: newSession, error: createError } = await supabase
          .from('count_sessions')
          .insert({
            session_number: sessionNumber,
            started_by: user.id,
            status: 'active',
          })
          .select()
          .single();

        if (createError) throw createError;
        
        setSession(newSession as CountSession);
        setCaptureSequence(1);
        
        toast({
          title: String(t('stocktake.sessionStarted')),
          description: `${String(t('stocktake.sessionNumber'))}: ${sessionNumber}`,
        });
      }
    } catch (error) {
      console.error('[StockTakeCapture] Error loading session:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.sessionLoadError')),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle photo capture
  const handleCapture = useCallback((imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    setShowCamera(false);
    processImage(imageDataUrl);
  }, [session, captureSequence]);

  // Process captured image
  const processImage = async (imageDataUrl: string) => {
    if (!session) return;

    try {
      const result = await uploadAndProcessImage(imageDataUrl, session.id, captureSequence);
      
      if (!result.upload.success) {
        toast({
          title: String(t('stocktake.uploadFailed')),
          description: result.upload.error,
          variant: 'destructive',
        });
        return;
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
        // OCR failed, set empty data for manual entry
        setOcrData({
          quality: '',
          color: '',
          lotNumber: '',
          meters: null,
          confidence: { overallScore: 0, level: 'low' },
          isLikelyLabel: false,
          rawText: '',
        });
      }
      
      setShowOCRConfirm(true);
    } catch (error) {
      console.error('[StockTakeCapture] Process error:', error);
      toast({
        title: String(t('error')),
        description: String(t('stocktake.processingError')),
        variant: 'destructive',
      });
    }
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
      // Insert count roll record
      const { error } = await supabase
        .from('count_rolls')
        .insert({
          session_id: session.id,
          capture_sequence: captureSequence,
          photo_path: `${session.id}/${captureSequence}_${Date.now()}.jpg`,
          photo_hash_sha256: '', // Will be filled by edge function
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
        });

      if (error) throw error;

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
  if (isLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

      {/* Progress bar when uploading */}
      {isUploading && (
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <UploadProgressBar progress={progress} />
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
