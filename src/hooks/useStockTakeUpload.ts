import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImageCompression, PreprocessingOptions } from './useImageCompression';
import { useClientOCR, type ClientOCRResult } from './useClientOCR';
import { preprocessForOCR, OCRPreprocessingOptions } from '@/utils/ocrPreprocessing';

interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'ocr' | 'complete' | 'error' | 'timeout';
  percent: number;
  message: string;
  ocrProgress?: number; // 0-100 for OCR stage
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
}

// Default preprocessing settings (enabled by default)
const DEFAULT_PREPROCESSING: PreprocessingOptions = {
  enabled: true,
  grayscale: true,
  contrast: true,
  contrastLevel: 20,
  sharpen: true,
  sharpenLevel: 30,
};

export const useStockTakeUpload = () => {
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'compressing',
    percent: 0,
    message: '',
    ocrProgress: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [ocrTimedOut, setOcrTimedOut] = useState(false);
  const [preprocessingSettings, setPreprocessingSettings] = useState<PreprocessingOptions>(DEFAULT_PREPROCESSING);
  const { compressImage, compressFromDataUrl, generateThumbnails, generateThumbnailsFromDataUrl } = useImageCompression();
  const { runOCR, progress: ocrProgress, progressMessage: ocrMessage, terminateWorker, abortOCR } = useClientOCR();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch preprocessing settings from database
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('email_settings')
          .select('setting_value')
          .eq('setting_key', 'stocktake_settings')
          .maybeSingle();

        if (data && !error && data.setting_value) {
          const settings = data.setting_value as any;
          setPreprocessingSettings({
            enabled: settings.preprocessing_enabled ?? true,
            grayscale: settings.preprocessing_grayscale ?? true,
            contrast: settings.preprocessing_contrast ?? true,
            contrastLevel: settings.preprocessing_contrast_level ?? 20,
            sharpen: settings.preprocessing_sharpen ?? true,
            sharpenLevel: settings.preprocessing_sharpen_level ?? 30,
          });
        }
      } catch (err) {
        console.warn('[useStockTakeUpload] Failed to fetch preprocessing settings:', err);
      }
    };

    fetchSettings();
  }, []);

  // Update progress with OCR progress
  useEffect(() => {
    if (progress.stage === 'ocr') {
      setProgress(prev => ({
        ...prev,
        ocrProgress,
        message: ocrMessage || 'OCR işleniyor...',
      }));
    }
  }, [ocrProgress, ocrMessage, progress.stage]);

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
        photo_hash_sha256: '', // Will be calculated later if needed
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

  // Convert ClientOCRResult to OCRResult format
  const convertOCRResult = (clientResult: ClientOCRResult): OCRResult => {
    if (!clientResult.success) {
      return {
        success: false,
        error: clientResult.error,
        timedOut: clientResult.timedOut,
      };
    }

    return {
      success: true,
      ocr: clientResult.ocr,
      extracted: clientResult.extracted,
      confidence: clientResult.confidence,
      validation: clientResult.validation,
    };
  };

  // Main function: compress, upload thumbnails, create roll, run client-side OCR
  const uploadAndProcessImage = useCallback(async (
    imageSource: File | Blob | string,
    sessionId: string,
    captureSequence: number,
    userId: string,
    runClientOCR: boolean = true
  ): Promise<UploadAndOCRResult> => {
    setIsUploading(true);
    setOcrTimedOut(false);
    
    try {
      // Stage 1: Generate all thumbnail sizes with preprocessing for OCR
      setProgress({
        stage: 'compressing',
        percent: 10,
        message: preprocessingSettings.enabled 
          ? 'Görüntü ön işleme ve sıkıştırma...' 
          : 'Fotoğraf sıkıştırılıyor...',
        ocrProgress: 0,
      });

      let thumbnails;
      let originalSize = 0;
      let imageDataUrlForOCR: string;
      
      console.log('[useStockTakeUpload] ========== Phase 2: Image Passing ==========');
      console.log('[useStockTakeUpload] imageSource type:', typeof imageSource);
      console.log('[useStockTakeUpload] imageSource is Blob?', imageSource instanceof Blob);
      console.log('[useStockTakeUpload] imageSource is File?', imageSource instanceof File);
      
      if (typeof imageSource === 'string') {
        // Already a data URL - use it directly for OCR (no conversion!)
        console.log('[useStockTakeUpload] ✅ Received data URL directly, length:', imageSource.length);
        console.log('[useStockTakeUpload] Data URL prefix:', imageSource.substring(0, 50));
        
        // Store original data URL for OCR - NO CONVERSION
        imageDataUrlForOCR = imageSource;
        
        // Get size estimate for logging
        const response = await fetch(imageSource);
        const blob = await response.blob();
        originalSize = blob.size;
        console.log('[useStockTakeUpload] Original blob size:', blob.size);
        
        // Generate thumbnails for storage (separate from OCR image)
        thumbnails = await generateThumbnailsFromDataUrl(imageSource);
      } else {
        // Blob/File - convert to data URL for OCR
        originalSize = imageSource.size;
        console.log('[useStockTakeUpload] Received Blob/File, converting to data URL. Size:', originalSize);
        
        // Convert Blob to data URL for OCR
        imageDataUrlForOCR = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            console.log('[useStockTakeUpload] ✅ Blob converted to data URL, length:', result.length);
            resolve(result);
          };
          reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
          reader.readAsDataURL(imageSource);
        });
        
        thumbnails = await generateThumbnails(imageSource);
      }
      
      // Log final OCR image data
      console.log('[useStockTakeUpload] imageDataUrlForOCR ready:');
      console.log('[useStockTakeUpload] - Type:', typeof imageDataUrlForOCR);
      console.log('[useStockTakeUpload] - Length:', imageDataUrlForOCR.length);
      console.log('[useStockTakeUpload] - Prefix:', imageDataUrlForOCR.substring(0, 50));
      console.log('[useStockTakeUpload] - Is valid data URL?', imageDataUrlForOCR.startsWith('data:image/'));

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
        ocrProgress: 0,
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

      // Stage 3: Create roll record
      const { rollId, error: rollError } = await createRollRecord(
        sessionId,
        captureSequence,
        storagePaths.original,
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

      // Stage 4: Run client-side OCR
      if (runClientOCR) {
        setProgress({
          stage: 'ocr',
          percent: 50,
          message: 'Görüntü ön işleme yapılıyor...',
          ocrProgress: 0,
        });

        // Apply preprocessing for OCR
        const ocrPreprocessOptions: OCRPreprocessingOptions = {
          enabled: preprocessingSettings.enabled,
          grayscale: preprocessingSettings.grayscale,
          contrast: preprocessingSettings.contrast,
          contrastLevel: preprocessingSettings.contrastLevel,
          sharpen: preprocessingSettings.sharpen,
          sharpenLevel: preprocessingSettings.sharpenLevel,
          binarize: false, // Keep off by default
          noiseReduction: true,
          invertDetection: true,
        };

        console.log('[useStockTakeUpload] ========== OCR PREPROCESSING START ==========');
        console.log('[useStockTakeUpload] Preprocessing options:', ocrPreprocessOptions);
        console.log('[useStockTakeUpload] Input image length:', imageDataUrlForOCR.length);
        console.log('[useStockTakeUpload] Input image prefix:', imageDataUrlForOCR.substring(0, 50));
        
        const preprocessedImageUrl = await preprocessForOCR(imageDataUrlForOCR, ocrPreprocessOptions);
        
        console.log('[useStockTakeUpload] ========== OCR PREPROCESSING RESULT ==========');
        console.log('[useStockTakeUpload] Preprocessed image length:', preprocessedImageUrl?.length || 0);
        console.log('[useStockTakeUpload] Preprocessed image prefix:', preprocessedImageUrl?.substring(0, 50));
        
        if (!preprocessedImageUrl || preprocessedImageUrl.length < 100) {
          console.error('[useStockTakeUpload] ❌ Preprocessing returned invalid image!');
          // Fall back to original image
          console.log('[useStockTakeUpload] Falling back to original image for OCR');
        }
        
        const imageForOCR = (preprocessedImageUrl && preprocessedImageUrl.length > 100) 
          ? preprocessedImageUrl 
          : imageDataUrlForOCR;
        
        setProgress({
          stage: 'ocr',
          percent: 55,
          message: 'OCR başlatılıyor...',
          ocrProgress: 0,
        });

        console.log('[useStockTakeUpload] ========== STARTING OCR ==========');
        console.log('[useStockTakeUpload] Image for OCR length:', imageForOCR.length);
        const clientOCRResult = await runOCR(imageForOCR);
        const ocrResult = convertOCRResult(clientOCRResult);

        console.log('[useStockTakeUpload] Client OCR result:', {
          success: ocrResult.success,
          quality: ocrResult.extracted?.quality,
          color: ocrResult.extracted?.color,
          lotNumber: ocrResult.extracted?.lotNumber,
          meters: ocrResult.extracted?.meters,
          confidence: ocrResult.confidence?.level,
        });

        // Update roll record with OCR results
        if (ocrResult.success && ocrResult.extracted) {
          await supabase
            .from('count_rolls')
            .update({
              ocr_status: 'completed',
              ocr_quality: ocrResult.extracted.quality,
              ocr_color: ocrResult.extracted.color,
              ocr_lot_number: ocrResult.extracted.lotNumber,
              ocr_meters: ocrResult.extracted.meters,
              ocr_confidence_score: ocrResult.confidence?.overallScore,
              ocr_confidence_level: ocrResult.confidence?.level,
              ocr_raw_text: ocrResult.ocr?.rawText?.substring(0, 1000), // Limit text size
              ocr_processed_at: new Date().toISOString(),
              is_not_label_warning: ocrResult.validation?.isLikelyLabel === false,
            })
            .eq('id', rollId);
        } else {
          await supabase
            .from('count_rolls')
            .update({
              ocr_status: ocrResult.timedOut ? 'timeout' : 'failed',
            })
            .eq('id', rollId);
        }

        if (ocrResult.timedOut) {
          setOcrTimedOut(true);
          setProgress({
            stage: 'timeout',
            percent: 70,
            message: 'OCR zaman aşımı. Manuel giriş yapabilirsiniz.',
          });
        } else {
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
        };
      } else {
        // Skip OCR - return success immediately
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
    compressImage,
    compressFromDataUrl,
    preprocessingSettings,
    runOCR,
  ]);

  // Reset progress state
  const resetProgress = useCallback(() => {
    setProgress({
      stage: 'compressing',
      percent: 0,
      message: '',
      ocrProgress: 0,
    });
    setOcrTimedOut(false);
    abortOCR();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [abortOCR]);

  // Skip OCR and proceed with manual entry
  const skipOCR = useCallback(() => {
    setOcrTimedOut(false);
    abortOCR();
    setProgress({
      stage: 'complete',
      percent: 100,
      message: 'Manuel giriş için hazır',
    });
  }, [abortOCR]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, [terminateWorker]);

  return {
    uploadAndProcessImage,
    progress,
    isUploading,
    ocrTimedOut,
    resetProgress,
    skipOCR,
  };
};
