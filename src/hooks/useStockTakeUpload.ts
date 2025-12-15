import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImageCompression } from './useImageCompression';

interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'queued' | 'processing' | 'complete' | 'error' | 'timeout';
  percent: number;
  message: string;
}

interface UploadResult {
  success: boolean;
  storagePath?: string;
  publicUrl?: string;
  compressedSize?: number;
  originalSize?: number;
  error?: string;
}

interface OCRResult {
  success: boolean;
  ocr?: {
    rawText: string;
    tesseractConfidence: number;
    processingTimeMs: number;
  };
  extracted?: {
    quality: string | null;
    qualityConfidence: number;
    color: string | null;
    colorConfidence: number;
    lotNumber: string | null;
    lotNumberConfidence: number;
    meters: number | null;
    metersConfidence: number;
  };
  confidence?: {
    overallScore: number;
    level: 'high' | 'medium' | 'low';
  };
  hashes?: {
    sha256: string;
    perceptual: string;
  };
  validation?: {
    isLikelyLabel: boolean;
    fieldsExtracted: number;
    totalFields: number;
  };
  error?: string;
  timedOut?: boolean;
}

interface UploadAndOCRResult {
  upload: UploadResult;
  ocr: OCRResult | null;
  rollId?: string;
  ocrJobId?: string;
}

// OCR timeout in milliseconds (5 seconds before showing manual entry option)
const OCR_TIMEOUT_MS = 5000;
// Max wait time for OCR polling (15 seconds total)
const OCR_MAX_WAIT_MS = 15000;
// Polling interval
const OCR_POLL_INTERVAL_MS = 1000;

export const useStockTakeUpload = () => {
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'compressing',
    percent: 0,
    message: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [ocrTimedOut, setOcrTimedOut] = useState(false);
  const { compressImage, compressFromDataUrl } = useImageCompression();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate storage path following convention: {session_id}/{sequence}_{timestamp}.jpg
  const generateStoragePath = useCallback((
    sessionId: string,
    captureSequence: number
  ): string => {
    const timestamp = Date.now();
    return `${sessionId}/${captureSequence}_${timestamp}.jpg`;
  }, []);

  // Upload image to storage
  const uploadToStorage = useCallback(async (
    blob: Blob,
    storagePath: string
  ): Promise<{ path: string; error: Error | null }> => {
    const { data, error } = await supabase.storage
      .from('stock-take-photos')
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('[useStockTakeUpload] Storage upload error:', error);
      return { path: '', error };
    }

    return { path: data.path, error: null };
  }, []);

  // Create roll record in database (before OCR)
  const createRollRecord = useCallback(async (
    sessionId: string,
    captureSequence: number,
    storagePath: string,
    userId: string
  ): Promise<{ rollId: string | null; error: Error | null }> => {
    const { data, error } = await supabase
      .from('count_rolls')
      .insert({
        session_id: sessionId,
        capture_sequence: captureSequence,
        photo_path: storagePath,
        photo_hash_sha256: '', // Will be updated by OCR worker
        counter_quality: '', // Will be updated after confirmation
        counter_color: '',
        counter_lot_number: '',
        counter_meters: 0,
        captured_by: userId,
        status: 'pending_review',
        ocr_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[useStockTakeUpload] Create roll error:', error);
      return { rollId: null, error };
    }

    return { rollId: data.id, error: null };
  }, []);

  // Create OCR job in queue
  const createOCRJob = useCallback(async (
    rollId: string,
    imagePath: string
  ): Promise<{ jobId: string | null; error: Error | null }> => {
    const { data, error } = await supabase
      .from('ocr_jobs')
      .insert({
        roll_id: rollId,
        image_path: imagePath,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[useStockTakeUpload] Create OCR job error:', error);
      return { jobId: null, error };
    }

    return { jobId: data.id, error: null };
  }, []);

  // Poll for OCR completion
  const pollOCRResult = useCallback(async (
    jobId: string,
    timeoutMs: number = OCR_MAX_WAIT_MS
  ): Promise<OCRResult> => {
    const startTime = Date.now();
    let showedTimeoutWarning = false;

    while (Date.now() - startTime < timeoutMs) {
      // Check if we should show timeout warning
      if (!showedTimeoutWarning && Date.now() - startTime >= OCR_TIMEOUT_MS) {
        showedTimeoutWarning = true;
        setOcrTimedOut(true);
        setProgress({
          stage: 'timeout',
          percent: 70,
          message: 'OCR yavaş çalışıyor. Manuel giriş yapabilirsiniz.',
        });
      }

      // Poll job status
      const { data: job, error } = await supabase
        .from('ocr_jobs')
        .select('status, ocr_result, error_message')
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('[useStockTakeUpload] Poll error:', error);
        await new Promise(resolve => setTimeout(resolve, OCR_POLL_INTERVAL_MS));
        continue;
      }

      if (job.status === 'completed' && job.ocr_result) {
        setOcrTimedOut(false);
        return job.ocr_result as unknown as OCRResult;
      }

      if (job.status === 'failed') {
        setOcrTimedOut(false);
        return { 
          success: false, 
          error: job.error_message || 'OCR processing failed' 
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, OCR_POLL_INTERVAL_MS));
    }

    // Timeout - return partial result allowing manual entry
    return {
      success: false,
      error: 'OCR timeout - please enter data manually',
      timedOut: true,
    };
  }, []);

  // Trigger OCR worker (fire and forget for async processing)
  const triggerOCRWorker = useCallback(async () => {
    try {
      // Fire and forget - don't await
      supabase.functions.invoke('process-ocr-queue', {
        body: { batch: 1 },
      }).catch(err => {
        console.warn('[useStockTakeUpload] OCR worker trigger failed:', err);
      });
    } catch (err) {
      console.warn('[useStockTakeUpload] OCR worker trigger error:', err);
    }
  }, []);

  // Run synchronous OCR (fallback for immediate results)
  const runSyncOCR = useCallback(async (
    imageBase64: string
  ): Promise<OCRResult> => {
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

      const { data, error } = await supabase.functions.invoke('stock-take-ocr', {
        body: { imageBase64 },
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('[useStockTakeUpload] Sync OCR error:', error);
        return { success: false, error: error.message };
      }

      return data as OCRResult;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'OCR timeout', timedOut: true };
      }
      console.error('[useStockTakeUpload] Sync OCR exception:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Main function: compress, upload, create roll, queue OCR
  const uploadAndProcessImage = useCallback(async (
    imageSource: File | Blob | string,
    sessionId: string,
    captureSequence: number,
    userId: string,
    useAsyncOCR: boolean = true
  ): Promise<UploadAndOCRResult> => {
    setIsUploading(true);
    setOcrTimedOut(false);
    
    try {
      // Stage 1: Compress image
      setProgress({
        stage: 'compressing',
        percent: 10,
        message: 'Fotoğraf sıkıştırılıyor...',
      });

      let compressionResult;
      if (typeof imageSource === 'string') {
        compressionResult = await compressFromDataUrl(imageSource);
      } else {
        compressionResult = await compressImage(imageSource);
      }

      console.log('[useStockTakeUpload] Compression complete:', {
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        ratio: compressionResult.compressionRatio.toFixed(2),
        dimensions: `${compressionResult.width}x${compressionResult.height}`,
      });

      setProgress({
        stage: 'uploading',
        percent: 30,
        message: 'Fotoğraf yükleniyor...',
      });

      // Stage 2: Upload to storage
      const storagePath = generateStoragePath(sessionId, captureSequence);
      const { path, error: uploadError } = await uploadToStorage(
        compressionResult.blob,
        storagePath
      );

      if (uploadError) {
        setProgress({
          stage: 'error',
          percent: 0,
          message: 'Yükleme başarısız',
        });
        return {
          upload: {
            success: false,
            error: uploadError.message,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
          },
          ocr: null,
        };
      }

      console.log('[useStockTakeUpload] Upload complete:', path);

      // Stage 3: Create roll record
      const { rollId, error: rollError } = await createRollRecord(
        sessionId,
        captureSequence,
        path,
        userId
      );

      if (rollError || !rollId) {
        setProgress({
          stage: 'error',
          percent: 0,
          message: 'Kayıt oluşturulamadı',
        });
        return {
          upload: {
            success: true,
            storagePath: path,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
          },
          ocr: { success: false, error: 'Failed to create roll record' },
        };
      }

      console.log('[useStockTakeUpload] Roll created:', rollId);

      if (useAsyncOCR) {
        // Async OCR path: create job and poll
        setProgress({
          stage: 'queued',
          percent: 50,
          message: 'OCR kuyruğa eklendi...',
        });

        // Create OCR job
        const { jobId, error: jobError } = await createOCRJob(rollId, path);
        
        if (jobError || !jobId) {
          console.warn('[useStockTakeUpload] Failed to create OCR job, falling back to sync');
          // Fallback to sync OCR
          setProgress({
            stage: 'processing',
            percent: 60,
            message: 'OCR işleniyor...',
          });
          const ocrResult = await runSyncOCR(compressionResult.base64);
          
          setProgress({
            stage: 'complete',
            percent: 100,
            message: 'Tamamlandı',
          });

          return {
            upload: {
              success: true,
              storagePath: path,
              originalSize: compressionResult.originalSize,
              compressedSize: compressionResult.compressedSize,
            },
            ocr: ocrResult,
            rollId,
          };
        }

        console.log('[useStockTakeUpload] OCR job created:', jobId);

        // Trigger OCR worker
        triggerOCRWorker();

        setProgress({
          stage: 'processing',
          percent: 60,
          message: 'OCR işleniyor...',
        });

        // Poll for OCR result
        const ocrResult = await pollOCRResult(jobId);

        if (!ocrResult.timedOut) {
          setProgress({
            stage: 'complete',
            percent: 100,
            message: 'Tamamlandı',
          });
        }

        return {
          upload: {
            success: true,
            storagePath: path,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
          },
          ocr: ocrResult,
          rollId,
          ocrJobId: jobId,
        };

      } else {
        // Sync OCR path (legacy)
        setProgress({
          stage: 'processing',
          percent: 60,
          message: 'OCR işleniyor...',
        });

        const ocrResult = await runSyncOCR(compressionResult.base64);

        setProgress({
          stage: 'complete',
          percent: 100,
          message: 'Tamamlandı',
        });

        return {
          upload: {
            success: true,
            storagePath: path,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
          },
          ocr: ocrResult,
          rollId,
        };
      }

    } catch (err) {
      console.error('[useStockTakeUpload] Error:', err);
      setProgress({
        stage: 'error',
        percent: 0,
        message: (err as Error).message,
      });
      return {
        upload: {
          success: false,
          error: (err as Error).message,
        },
        ocr: null,
      };
    } finally {
      setIsUploading(false);
    }
  }, [
    compressImage, 
    compressFromDataUrl, 
    generateStoragePath, 
    uploadToStorage, 
    createRollRecord,
    createOCRJob,
    triggerOCRWorker,
    pollOCRResult,
    runSyncOCR,
  ]);

  // Reset progress state
  const resetProgress = useCallback(() => {
    setProgress({
      stage: 'compressing',
      percent: 0,
      message: '',
    });
    setOcrTimedOut(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Skip OCR and proceed with manual entry
  const skipOCR = useCallback(() => {
    setOcrTimedOut(false);
    setProgress({
      stage: 'complete',
      percent: 100,
      message: 'Manuel giriş için hazır',
    });
  }, []);

  return {
    uploadAndProcessImage,
    progress,
    isUploading,
    ocrTimedOut,
    resetProgress,
    skipOCR,
  };
};
