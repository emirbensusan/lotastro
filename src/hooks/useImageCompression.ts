import { useCallback } from 'react';

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
}

interface PreprocessingOptions {
  enabled?: boolean;
  grayscale?: boolean;
  contrast?: boolean;
  contrastLevel?: number; // 0-100
  sharpen?: boolean;
  sharpenLevel?: number; // 0-100
}

interface CompressionResult {
  blob: Blob;
  base64: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
  format: 'jpeg',
};

const DEFAULT_PREPROCESSING: PreprocessingOptions = {
  enabled: true,
  grayscale: true,
  contrast: true,
  contrastLevel: 20,
  sharpen: true,
  sharpenLevel: 30,
};

// Generate multiple sizes for thumbnails
interface ThumbnailSizes {
  thumb: Blob;      // 150px - for grids
  medium: Blob;     // 800px - for review dialogs  
  original: Blob;   // Full compressed - for evidence
}

/**
 * Apply grayscale filter to image data
 */
const applyGrayscale = (imageData: ImageData): void => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Use luminosity method for better grayscale
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;     // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alpha unchanged
  }
};

/**
 * Apply contrast enhancement to image data
 * @param level - Contrast level (0-100), higher = more contrast
 */
const applyContrast = (imageData: ImageData, level: number): void => {
  const data = imageData.data;
  // Convert level (0-100) to contrast factor (0.8 to 1.5)
  const factor = 1 + (level / 100);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
  }
};

/**
 * Apply sharpening using unsharp mask technique
 * @param level - Sharpen level (0-100)
 */
const applySharpen = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  level: number
): void => {
  const amount = level / 100; // 0 to 1
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const originalData = new Uint8ClampedArray(data);
  
  // Simple 3x3 sharpening kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += originalData[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        // Blend original with sharpened based on amount
        data[idx] = Math.min(255, Math.max(0, 
          originalData[idx] * (1 - amount) + sum * amount
        ));
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
};

/**
 * Apply all preprocessing steps to canvas
 */
const applyPreprocessing = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: PreprocessingOptions
): void => {
  if (!options.enabled) return;
  
  // Get image data for pixel manipulation
  let imageData = ctx.getImageData(0, 0, width, height);
  
  // Apply grayscale first (if enabled)
  if (options.grayscale) {
    applyGrayscale(imageData);
    ctx.putImageData(imageData, 0, 0);
  }
  
  // Apply contrast enhancement
  if (options.contrast && options.contrastLevel) {
    imageData = ctx.getImageData(0, 0, width, height);
    applyContrast(imageData, options.contrastLevel);
    ctx.putImageData(imageData, 0, 0);
  }
  
  // Apply sharpening last (operates on canvas directly)
  if (options.sharpen && options.sharpenLevel) {
    applySharpen(ctx, width, height, options.sharpenLevel);
  }
};

const createResizedBlob = (
  img: HTMLImageElement, 
  maxWidth: number, 
  maxHeight: number, 
  quality: number,
  format: 'jpeg' | 'webp',
  preprocessing?: PreprocessingOptions
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    let { width, height } = img;
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    
    // Apply preprocessing if provided (only for OCR-destined images, not thumbnails)
    if (preprocessing) {
      applyPreprocessing(ctx, width, height, preprocessing);
    }
    
    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
};

export const useImageCompression = () => {
  // Generate all thumbnail sizes at once
  const generateThumbnails = useCallback(async (
    file: File | Blob,
    options: CompressionOptions = {}
  ): Promise<ThumbnailSizes> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = async () => {
        URL.revokeObjectURL(url);
        
        try {
          const [thumb, medium, original] = await Promise.all([
            createResizedBlob(img, 150, 150, 0.7, opts.format!),
            createResizedBlob(img, 800, 800, 0.8, opts.format!),
            createResizedBlob(img, opts.maxWidth!, opts.maxHeight!, opts.quality!, opts.format!),
          ]);
          
          resolve({ thumb, medium, original });
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }, []);
  
  const compressImage = useCallback(async (
    file: File | Blob,
    options: CompressionOptions = {},
    preprocessing: PreprocessingOptions = DEFAULT_PREPROCESSING
  ): Promise<CompressionResult> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const originalSize = file.size;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        const maxWidth = opts.maxWidth!;
        const maxHeight = opts.maxHeight!;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Apply preprocessing for OCR
        applyPreprocessing(ctx, width, height, preprocessing);

        // Convert to blob
        const mimeType = opts.format === 'webp' ? 'image/webp' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              resolve({
                blob,
                base64,
                width,
                height,
                originalSize,
                compressedSize: blob.size,
                compressionRatio: originalSize / blob.size,
              });
            };
            reader.onerror = () => reject(new Error('Failed to read compressed image'));
            reader.readAsDataURL(blob);
          },
          mimeType,
          opts.quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }, []);

  const compressFromDataUrl = useCallback(async (
    dataUrl: string,
    options: CompressionOptions = {},
    preprocessing: PreprocessingOptions = DEFAULT_PREPROCESSING
  ): Promise<CompressionResult> => {
    // Convert data URL to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return compressImage(blob, options, preprocessing);
  }, [compressImage]);

  // Generate thumbnails from data URL
  const generateThumbnailsFromDataUrl = useCallback(async (
    dataUrl: string,
    options: CompressionOptions = {}
  ): Promise<ThumbnailSizes> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return generateThumbnails(blob, options);
  }, [generateThumbnails]);

  return { 
    compressImage, 
    compressFromDataUrl, 
    generateThumbnails, 
    generateThumbnailsFromDataUrl,
    DEFAULT_PREPROCESSING,
  };
};

export type { PreprocessingOptions, CompressionOptions, CompressionResult, ThumbnailSizes };
