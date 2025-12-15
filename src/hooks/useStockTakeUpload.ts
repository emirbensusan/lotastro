import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImageCompression } from './useImageCompression';

interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'processing' | 'complete' | 'error';
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
}

interface UploadAndOCRResult {
  upload: UploadResult;
  ocr: OCRResult | null;
}

export const useStockTakeUpload = () => {
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'compressing',
    percent: 0,
    message: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const { compressImage, compressFromDataUrl } = useImageCompression();

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

  // Run OCR on uploaded image
  const runOCR = useCallback(async (
    imageBase64: string
  ): Promise<OCRResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('stock-take-ocr', {
        body: { imageBase64 },
      });

      if (error) {
        console.error('[useStockTakeUpload] OCR function error:', error);
        return { success: false, error: error.message };
      }

      return data as OCRResult;
    } catch (err) {
      console.error('[useStockTakeUpload] OCR exception:', err);
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // Main function: compress, upload, and run OCR
  const uploadAndProcessImage = useCallback(async (
    imageSource: File | Blob | string, // File, Blob, or data URL
    sessionId: string,
    captureSequence: number
  ): Promise<UploadAndOCRResult> => {
    setIsUploading(true);
    
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

      setProgress({
        stage: 'processing',
        percent: 60,
        message: 'OCR işleniyor...',
      });

      // Stage 3: Run OCR
      const ocrResult = await runOCR(compressionResult.base64);

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
      };

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
  }, [compressImage, compressFromDataUrl, generateStoragePath, uploadToStorage, runOCR]);

  // Reset progress state
  const resetProgress = useCallback(() => {
    setProgress({
      stage: 'compressing',
      percent: 0,
      message: '',
    });
  }, []);

  return {
    uploadAndProcessImage,
    progress,
    isUploading,
    resetProgress,
  };
};
