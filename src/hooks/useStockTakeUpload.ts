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
  thumbPath?: string;
  mediumPath?: string;
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
  const { compressImage, compressFromDataUrl, generateThumbnails, generateThumbnailsFromDataUrl } = useImageCompression();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate storage paths for all sizes
  const generateStoragePaths = useCallback((
    sessionId: string,
    captureSequence: number
  ): { original: string; medium: string; thumb: string } => {
    const timestamp = Date.now();
    const basePath = `${sessionId}/${captureSequence}_${timestamp}`;
    return {
      original: `${basePath}_original.jpg`,
      medium: `${basePath}_medium.jpg`,
      thumb: `${basePath}_thumb.jpg`,
    };
  }, []);

  // Upload image to storage with cache headers
  const uploadToStorage = useCallback(async (
    blob: Blob,
    storagePath: string
  ): Promise<{ path: string; error: Error | null }> => {
    const { data, error } = await supabase.storage
      .from('stock-take-photos')
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '31536000', // 1 year cache for thumbnails
      });

    if (error) {
      console.error('[useStockTakeUpload] Storage upload error:', error);
      return { path: '', error };
    }

    return { path: data.path, error: null };
  }, []);
  
  // Upload all thumbnail sizes in parallel
  const uploadAllSizes = useCallback(async (
    thumbnails: { thumb: Blob; medium: Blob; original: Blob },
    paths: { original: string; medium: string; thumb: string }
  ): Promise<{ success: boolean; paths: typeof paths; error?: string }> => {
    try {
      const uploads = await Promise.all([
        uploadToStorage(thumbnails.original, paths.original),
        uploadToStorage(thumbnails.medium, paths.medium),
        uploadToStorage(thumbnails.thumb, paths.thumb),
      ]);
      
      const failed = uploads.find(u => u.error);
      if (failed) {
        return { success: false, paths, error: failed.error?.message };
      }
      
      return { success: true, paths };
    } catch (err) {
      console.error('[useStockTakeUpload] Upload all sizes error:', err);
      return { success: false, paths, error: (err as Error).message };
    }
  }, [uploadToStorage]);

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

  // Main function: compress, upload thumbnails, create roll, queue OCR
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
      // Stage 1: Generate all thumbnail sizes
      setProgress({
        stage: 'compressing',
        percent: 10,
        message: 'Fotoğraf sıkıştırılıyor...',
      });

      let thumbnails;
      let originalSize = 0;
      
      if (typeof imageSource === 'string') {
        // Data URL - get size estimate
        const response = await fetch(imageSource);
        const blob = await response.blob();
        originalSize = blob.size;
        thumbnails = await generateThumbnailsFromDataUrl(imageSource);
      } else {
        originalSize = imageSource.size;
        thumbnails = await generateThumbnails(imageSource);
      }

      const totalSize = thumbnails.original.size + thumbnails.medium.size + thumbnails.thumb.size;
      console.log('[useStockTakeUpload] Thumbnails generated:', {
        originalSize,
        thumbSize: thumbnails.thumb.size,
        mediumSize: thumbnails.medium.size,
        compressedOriginalSize: thumbnails.original.size,
        totalSize,
      });

      setProgress({
        stage: 'uploading',
        percent: 30,
        message: 'Fotoğraflar yükleniyor...',
      });

      // Stage 2: Upload all sizes to storage
      const storagePaths = generateStoragePaths(sessionId, captureSequence);
      const uploadResult = await uploadAllSizes(thumbnails, storagePaths);

      if (!uploadResult.success) {
        setProgress({
          stage: 'error',
          percent: 0,
          message: 'Yükleme başarısız',
        });
        return {
          upload: {
            success: false,
            error: uploadResult.error,
            originalSize,
            compressedSize: totalSize,
          },
          ocr: null,
        };
      }

      console.log('[useStockTakeUpload] All sizes uploaded:', storagePaths);

      // Stage 3: Create roll record (use original path for OCR)
      const { rollId, error: rollError } = await createRollRecord(
        sessionId,
        captureSequence,
        storagePaths.original, // Primary path is original for OCR processing
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
            storagePath: storagePaths.original,
            thumbPath: storagePaths.thumb,
            mediumPath: storagePaths.medium,
            originalSize,
            compressedSize: thumbnails.original.size,
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

        // Create OCR job (uses original image path for best OCR quality)
        const { jobId, error: jobError } = await createOCRJob(rollId, storagePaths.original);
        
        if (jobError || !jobId) {
          console.warn('[useStockTakeUpload] Failed to create OCR job, proceeding without OCR');
          // Return without OCR - user will need to enter manually
          setProgress({
            stage: 'complete',
            percent: 100,
            message: 'Tamamlandı - OCR kuyruk hatası',
          });

          return {
            upload: {
              success: true,
              storagePath: storagePaths.original,
              thumbPath: storagePaths.thumb,
              mediumPath: storagePaths.medium,
              originalSize,
              compressedSize: thumbnails.original.size,
            },
            ocr: { success: false, error: 'OCR job creation failed' },
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
            storagePath: storagePaths.original,
            thumbPath: storagePaths.thumb,
            mediumPath: storagePaths.medium,
            originalSize,
            compressedSize: thumbnails.original.size,
          },
          ocr: ocrResult,
          rollId,
          ocrJobId: jobId,
        };

      } else {
        // Sync OCR path (legacy) - not recommended, just return success
        setProgress({
          stage: 'complete',
          percent: 100,
          message: 'Tamamlandı',
        });

        return {
          upload: {
            success: true,
            storagePath: storagePaths.original,
            thumbPath: storagePaths.thumb,
            mediumPath: storagePaths.medium,
            originalSize,
            compressedSize: thumbnails.original.size,
          },
          ocr: null,
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
    generateThumbnails,
    generateThumbnailsFromDataUrl,
    generateStoragePaths,
    uploadAllSizes, 
    createRollRecord,
    createOCRJob,
    triggerOCRWorker,
    pollOCRResult,
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
