/**
 * OCR-specific image preprocessing utility
 * Applies grayscale, contrast, sharpening, binarization, and noise reduction
 * to improve Tesseract.js OCR accuracy on fabric roll labels
 */

import { isIOS, getSafeCanvasDimensions, safeToDataURL } from './canvasPolyfill';

export interface OCRPreprocessingOptions {
  enabled?: boolean;
  grayscale?: boolean;
  contrast?: boolean;
  contrastLevel?: number; // 0-100, default 20
  sharpen?: boolean;
  sharpenLevel?: number; // 0-100, default 30
  binarize?: boolean;
  binarizeThreshold?: number; // 0-255, default 128
  noiseReduction?: boolean;
  invertDetection?: boolean; // Auto-detect and fix inverted text
}

const DEFAULT_OPTIONS: OCRPreprocessingOptions = {
  enabled: true,
  grayscale: true,
  contrast: true,
  contrastLevel: 20,
  sharpen: true,
  sharpenLevel: 30,
  binarize: false, // Off by default - can help or hurt
  binarizeThreshold: 128,
  noiseReduction: true,
  invertDetection: true,
};

/**
 * Apply grayscale conversion using luminosity method
 */
const applyGrayscale = (imageData: ImageData): void => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Luminosity method: 0.299*R + 0.587*G + 0.114*B
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;     // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alpha channel unchanged
  }
};

/**
 * Apply contrast enhancement
 * Factor: 0-100 maps to 1.0-2.0 contrast multiplier
 */
const applyContrast = (imageData: ImageData, level: number): void => {
  const data = imageData.data;
  // Map level (0-100) to contrast factor (1.0-2.0)
  const factor = 1 + (level / 100);
  const intercept = 128 * (1 - factor);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, Math.round(factor * data[i] + intercept)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(factor * data[i + 1] + intercept)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(factor * data[i + 2] + intercept)));
  }
};

/**
 * Apply sharpening using unsharp mask technique
 * Level: 0-100 maps to sharpening intensity
 */
const applySharpen = (imageData: ImageData, level: number): void => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const original = new Uint8ClampedArray(data);
  
  // Sharpening kernel intensity based on level
  const amount = level / 100;
  
  // 3x3 Laplacian kernel for edge detection
  const kernel = [
    0, -1, 0,
    -1, 5 + amount, -1,
    0, -1, 0
  ];
  const kernelSum = 1 + amount;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            val += original[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        data[idx] = Math.max(0, Math.min(255, Math.round(val / kernelSum)));
      }
    }
  }
};

/**
 * Apply global binarization (threshold)
 * Converts image to pure black and white
 */
const applyBinarization = (imageData: ImageData, threshold: number): void => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Use average of RGB for threshold comparison
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const val = avg > threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
};

/**
 * Apply median filter for noise reduction
 * Removes salt-and-pepper noise common in camera captures
 */
const applyNoiseReduction = (imageData: ImageData): void => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const original = new Uint8ClampedArray(data);

  // 3x3 median filter
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const neighbors: number[] = [];
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            neighbors.push(original[idx]);
          }
        }
        neighbors.sort((a, b) => a - b);
        const idx = (y * width + x) * 4 + c;
        data[idx] = neighbors[4]; // Median of 9 values
      }
    }
  }
};

/**
 * Detect if image is inverted (white text on dark background)
 * Returns true if image should be inverted
 */
const detectInversion = (imageData: ImageData): boolean => {
  const data = imageData.data;
  let totalBrightness = 0;
  const sampleSize = Math.min(data.length / 4, 10000); // Sample up to 10k pixels
  const step = Math.max(1, Math.floor(data.length / 4 / sampleSize));

  for (let i = 0; i < data.length; i += step * 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;
  }

  const avgBrightness = totalBrightness / (data.length / 4 / step);
  
  // If average brightness is below 100, image is likely dark (inverted text)
  return avgBrightness < 100;
};

/**
 * Invert image colors
 */
const invertImage = (imageData: ImageData): void => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
};

/**
 * Main preprocessing function
 * Takes a data URL and returns a preprocessed data URL optimized for OCR
 */
export const preprocessForOCR = async (
  imageDataUrl: string,
  options: OCRPreprocessingOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!opts.enabled) {
    console.log('[ocrPreprocessing] Preprocessing disabled, returning original');
    return imageDataUrl;
  }

  console.log('[ocrPreprocessing] Starting preprocessing with options:', opts);

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        console.log('[ocrPreprocessing] Image loaded:', img.width, 'x', img.height);
        
        // Create canvas with safe dimensions for iOS
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('[ocrPreprocessing] Failed to get canvas context');
          resolve(imageDataUrl);
          return;
        }

        // Apply iOS-safe dimensions if needed
        let { width, height } = { width: img.width, height: img.height };
        if (isIOS()) {
          const safe = getSafeCanvasDimensions(width, height);
          width = safe.width;
          height = safe.height;
          console.log('[ocrPreprocessing] iOS: Adjusted dimensions to', width, 'x', height);
        }

        canvas.width = width;
        canvas.height = height;
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get image data for manipulation
        const imageData = ctx.getImageData(0, 0, width, height);
        
        // Step 1: Auto-detect and fix inversion first (before other processing)
        if (opts.invertDetection) {
          const isInverted = detectInversion(imageData);
          if (isInverted) {
            console.log('[ocrPreprocessing] Detected inverted image, applying inversion');
            invertImage(imageData);
          }
        }
        
        // Step 2: Apply grayscale
        if (opts.grayscale) {
          console.log('[ocrPreprocessing] Applying grayscale');
          applyGrayscale(imageData);
        }
        
        // Step 3: Apply noise reduction (before contrast/sharpening for best results)
        if (opts.noiseReduction) {
          console.log('[ocrPreprocessing] Applying noise reduction');
          applyNoiseReduction(imageData);
        }
        
        // Step 4: Apply contrast enhancement
        if (opts.contrast && opts.contrastLevel && opts.contrastLevel > 0) {
          console.log('[ocrPreprocessing] Applying contrast:', opts.contrastLevel);
          applyContrast(imageData, opts.contrastLevel);
        }
        
        // Step 5: Apply sharpening
        if (opts.sharpen && opts.sharpenLevel && opts.sharpenLevel > 0) {
          console.log('[ocrPreprocessing] Applying sharpen:', opts.sharpenLevel);
          applySharpen(imageData, opts.sharpenLevel);
        }
        
        // Step 6: Apply binarization (optional, last step)
        if (opts.binarize) {
          console.log('[ocrPreprocessing] Applying binarization, threshold:', opts.binarizeThreshold);
          applyBinarization(imageData, opts.binarizeThreshold || 128);
        }
        
        // Put processed data back to canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to data URL using iOS-safe method
        const result = safeToDataURL(canvas, 'image/jpeg', 0.92);
        
        if (result && result.length > 100) {
          console.log('[ocrPreprocessing] ✅ Preprocessing complete, output length:', result.length);
          resolve(result);
        } else {
          console.warn('[ocrPreprocessing] Output too short, returning original');
          resolve(imageDataUrl);
        }
        
      } catch (err) {
        console.error('[ocrPreprocessing] Error during preprocessing:', err);
        resolve(imageDataUrl); // Return original on error
      }
    };
    
    img.onerror = (err) => {
      console.error('[ocrPreprocessing] Failed to load image:', err);
      resolve(imageDataUrl); // Return original on error
    };
    
    img.src = imageDataUrl;
  });
};
