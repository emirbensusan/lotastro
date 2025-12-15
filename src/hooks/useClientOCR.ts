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

const OCR_TIMEOUT_MS = 30000; // 30 seconds max for client-side OCR

export const useClientOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const abortRef = useRef(false);

  // Initialize Tesseract worker (lazy load)
  const initWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;

    console.log('[useClientOCR] Initializing Tesseract worker...');
    setProgressMessage('OCR modeli yükleniyor...');
    
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
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
    console.log('[useClientOCR] Worker initialized');
    return worker;
  }, []);

  // Run OCR on image
  const runOCR = useCallback(async (imageSource: string | Blob): Promise<ClientOCRResult> => {
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
        const worker = await initWorker();
        
        if (abortRef.current) {
          return { success: false, error: 'OCR aborted', timedOut: true };
        }

        setProgressMessage('Görüntü işleniyor...');
        setProgress(20);

        // Convert blob to data URL if needed
        let imageData = imageSource;
        if (imageSource instanceof Blob) {
          imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imageSource);
          });
        }

        if (abortRef.current) {
          return { success: false, error: 'OCR aborted', timedOut: true };
        }

        setProgressMessage('Metin tanınıyor...');
        
        // Run recognition
        const result = await worker.recognize(imageData);
        
        const processingTimeMs = Date.now() - startTime;
        console.log('[useClientOCR] Recognition complete:', {
          confidence: result.data.confidence,
          textLength: result.data.text.length,
          processingTimeMs,
        });

        if (abortRef.current) {
          return { success: false, error: 'OCR aborted', timedOut: true };
        }

        const rawText = result.data.text;
        const tesseractConfidence = result.data.confidence;

        // Extract fields
        setProgressMessage('Alanlar çıkarılıyor...');
        setProgress(90);

        const extracted = extractAllFields(rawText);
        const confidence = calculateOverallConfidence(extracted, tesseractConfidence);
        const fieldsExtracted = countExtractedFields(extracted);
        const isLabel = isValidLabel(rawText, fieldsExtracted);

        setProgress(100);
        setProgressMessage('Tamamlandı');

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
      console.error('[useClientOCR] Error:', err);
      
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
      await workerRef.current.terminate();
      workerRef.current = null;
    }
    abortRef.current = true;
  }, []);

  // Abort current OCR operation
  const abortOCR = useCallback(() => {
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
