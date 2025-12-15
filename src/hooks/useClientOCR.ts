import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import {
  extractAllFields,
  calculateOverallConfidence,
  countExtractedFields,
  isValidLabel,
  type OCRExtractedData,
  type OCRConfidence,
} from '@/utils/ocrExtraction';

export interface ClientOCRResult {
  success: boolean;
  ocr?: {
    rawText: string;
    tesseractConfidence: number;
    processingTimeMs: number;
  };
  extracted?: OCRExtractedData;
  confidence?: OCRConfidence;
  validation?: {
    isLikelyLabel: boolean;
    fieldsExtracted: number;
    totalFields: number;
  };
  error?: string;
  timedOut?: boolean;
}

// Increased to 60 seconds for slower mobile devices
const OCR_TIMEOUT_MS = 60000;

// Exact CDN versions for Tesseract.js v5
const TESSERACT_CDN = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core.wasm.js',
  langPath: 'https://tessdata.projectnaptha.com/4.0.0',
};

export const useClientOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const abortRef = useRef(false);

  // Initialize Tesseract worker with exact CDN versions
  const initWorker = useCallback(async () => {
    if (workerRef.current) {
      console.log('[useClientOCR] Reusing existing worker');
      return workerRef.current;
    }

    console.log('[useClientOCR] Initializing Tesseract worker with CDN paths:', TESSERACT_CDN);
    setProgressMessage('OCR modeli yükleniyor...');
    
    try {
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: TESSERACT_CDN.workerPath,
        langPath: TESSERACT_CDN.langPath,
        corePath: TESSERACT_CDN.corePath,
        logger: (m) => {
          console.log('[Tesseract Logger]', m.status, m.progress);
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
            setProgressMessage('Metin tanınıyor...');
          } else if (m.status === 'loading language traineddata') {
            setProgress(10);
            setProgressMessage('Dil paketi yükleniyor...');
          } else if (m.status === 'initializing api') {
            setProgress(5);
            setProgressMessage('OCR başlatılıyor...');
          }
        },
      });

      workerRef.current = worker;
      console.log('[useClientOCR] ✅ Worker initialized successfully');
      return worker;
    } catch (workerError) {
      console.error('[useClientOCR] ❌ Failed to create worker:', workerError);
      throw new Error(`Failed to initialize OCR worker: ${workerError}`);
    }
  }, []);

  // Validate image data before OCR
  const validateImageData = (imageData: string): { valid: boolean; error?: string } => {
    console.log('[useClientOCR] Validating image data...');
    console.log('[useClientOCR] - Type:', typeof imageData);
    console.log('[useClientOCR] - Length:', imageData.length);
    console.log('[useClientOCR] - Prefix (first 50 chars):', imageData.substring(0, 50));

    if (imageData.length < 1000) {
      return { valid: false, error: `Image data too short: ${imageData.length} chars (minimum 1000)` };
    }

    if (!imageData.startsWith('data:image/')) {
      return { valid: false, error: `Invalid image format. Expected data:image/... but got: ${imageData.substring(0, 30)}` };
    }

    // Check for valid base64 content after the header
    const base64Match = imageData.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    if (!base64Match) {
      return { valid: false, error: 'Image data URL does not contain valid base64 content' };
    }

    const base64Content = base64Match[1];
    if (base64Content.length < 100) {
      return { valid: false, error: `Base64 content too short: ${base64Content.length} chars` };
    }

    console.log('[useClientOCR] ✅ Image validation passed. Base64 length:', base64Content.length);
    return { valid: true };
  };

  // Run OCR on image with retry logic
  const runOCR = useCallback(async (imageSource: string | Blob): Promise<ClientOCRResult> => {
    console.log('[useClientOCR] ========== Starting OCR ==========');
    console.log('[useClientOCR] Input type:', typeof imageSource);
    console.log('[useClientOCR] Is Blob?:', imageSource instanceof Blob);
    
    if (imageSource instanceof Blob) {
      console.log('[useClientOCR] Blob size:', imageSource.size, 'type:', imageSource.type);
    }
    
    setIsProcessing(true);
    setProgress(0);
    abortRef.current = false;
    
    const startTime = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<ClientOCRResult>((_, reject) => {
        setTimeout(() => {
          abortRef.current = true;
          reject(new Error('OCR timeout'));
        }, OCR_TIMEOUT_MS);
      });

      // Create OCR promise
      const ocrPromise = (async (): Promise<ClientOCRResult> => {
        // Step 1: Initialize worker
        console.log('[useClientOCR] Step 1: Initializing worker...');
        let worker: Tesseract.Worker;
        try {
          worker = await initWorker();
        } catch (initError) {
          console.error('[useClientOCR] ❌ Worker init failed:', initError);
          return { success: false, error: `Worker initialization failed: ${initError}` };
        }
        
        if (abortRef.current) {
          return { success: false, error: 'OCR aborted during worker init', timedOut: true };
        }

        // Step 2: Convert blob to data URL if needed
        console.log('[useClientOCR] Step 2: Preparing image data...');
        setProgressMessage('Görüntü işleniyor...');
        setProgress(20);

        let imageData: string;
        if (imageSource instanceof Blob) {
          console.log('[useClientOCR] Converting Blob to data URL...');
          try {
            imageData = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                console.log('[useClientOCR] Blob conversion complete. Data URL length:', result.length);
                resolve(result);
              };
              reader.onerror = () => reject(new Error('FileReader failed'));
              reader.readAsDataURL(imageSource);
            });
          } catch (conversionError) {
            console.error('[useClientOCR] ❌ Blob conversion failed:', conversionError);
            return { success: false, error: `Image conversion failed: ${conversionError}` };
          }
        } else {
          imageData = imageSource;
        }

        // Step 3: Validate image data
        console.log('[useClientOCR] Step 3: Validating image...');
        const validation = validateImageData(imageData);
        if (!validation.valid) {
          console.error('[useClientOCR] ❌ Image validation failed:', validation.error);
          return { success: false, error: validation.error };
        }

        if (abortRef.current) {
          return { success: false, error: 'OCR aborted after validation', timedOut: true };
        }

        // Step 4: Run OCR recognition
        console.log('[useClientOCR] Step 4: Running Tesseract recognition...');
        setProgressMessage('Metin tanınıyor...');
        
        let result: Tesseract.RecognizeResult;
        try {
          result = await worker.recognize(imageData);
          console.log('[useClientOCR] ✅ Recognition complete:', {
            textLength: result.data.text.length,
            confidence: result.data.confidence,
            wordCount: result.data.words?.length || 0,
            textPreview: result.data.text.substring(0, 200),
          });
        } catch (recognizeError) {
          console.error('[useClientOCR] ❌ Recognition failed:', recognizeError);
          return { success: false, error: `Recognition failed: ${recognizeError}` };
        }

        // Step 5: Check for empty result and retry if needed
        if (!result.data.text || result.data.text.trim().length === 0) {
          console.log('[useClientOCR] ⚠️ Empty result on first attempt, retrying with different parameters...');
          
          try {
            // Try with AUTO page segmentation mode
            await worker.setParameters({
              tessedit_pageseg_mode: '3' as any, // PSM.AUTO
            });
            
            result = await worker.recognize(imageData);
            console.log('[useClientOCR] Retry result:', {
              textLength: result.data.text.length,
              confidence: result.data.confidence,
              textPreview: result.data.text.substring(0, 200),
            });
            
            // Reset parameters for next use
            await worker.setParameters({
              tessedit_pageseg_mode: '1' as any, // PSM.AUTO_OSD (default)
            });
          } catch (retryError) {
            console.error('[useClientOCR] ❌ Retry failed:', retryError);
            // Continue with empty result
          }
        }

        const processingTimeMs = Date.now() - startTime;
        console.log('[useClientOCR] Processing time:', processingTimeMs, 'ms');

        if (abortRef.current) {
          return { success: false, error: 'OCR aborted after recognition', timedOut: true };
        }

        const rawText = result.data.text;
        const tesseractConfidence = result.data.confidence;

        // Step 6: Extract fields from OCR text
        console.log('[useClientOCR] Step 5: Extracting fields from text...');
        setProgressMessage('Alanlar çıkarılıyor...');
        setProgress(90);

        const extracted = extractAllFields(rawText);
        const confidence = calculateOverallConfidence(extracted, tesseractConfidence);
        const fieldsExtracted = countExtractedFields(extracted);
        const isLabel = isValidLabel(rawText, fieldsExtracted);

        console.log('[useClientOCR] Extraction results:', {
          quality: extracted.quality,
          color: extracted.color,
          lotNumber: extracted.lotNumber,
          meters: extracted.meters,
          fieldsExtracted,
          isLabel,
          overallConfidence: confidence.overallScore,
          confidenceLevel: confidence.level,
        });

        setProgress(100);
        setProgressMessage('Tamamlandı');

        console.log('[useClientOCR] ========== OCR Complete ==========');

        return {
          success: true,
          ocr: {
            rawText,
            tesseractConfidence,
            processingTimeMs,
          },
          extracted,
          confidence,
          validation: {
            isLikelyLabel: isLabel,
            fieldsExtracted,
            totalFields: 4,
          },
        };
      })();

      // Race between OCR and timeout
      return await Promise.race([ocrPromise, timeoutPromise]);
      
    } catch (err: any) {
      console.error('[useClientOCR] ❌ Top-level error:', err);
      
      if (err.message === 'OCR timeout' || abortRef.current) {
        return {
          success: false,
          error: 'OCR zaman aşımı - lütfen manuel giriş yapın',
          timedOut: true,
        };
      }

      return {
        success: false,
        error: err.message || 'OCR işlemi başarısız',
      };
    } finally {
      setIsProcessing(false);
    }
  }, [initWorker]);

  // Terminate worker to free resources
  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      console.log('[useClientOCR] Terminating worker');
      try {
        await workerRef.current.terminate();
      } catch (e) {
        console.error('[useClientOCR] Worker termination error:', e);
      }
      workerRef.current = null;
    }
    abortRef.current = true;
  }, []);

  // Abort current OCR operation
  const abortOCR = useCallback(() => {
    console.log('[useClientOCR] Aborting OCR...');
    abortRef.current = true;
  }, []);

  return {
    runOCR,
    isProcessing,
    progress,
    progressMessage,
    terminateWorker,
    abortOCR,
  };
};
