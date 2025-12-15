import { useCallback } from 'react';

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
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

// Generate multiple sizes for thumbnails
interface ThumbnailSizes {
  thumb: Blob;      // 150px - for grids
  medium: Blob;     // 800px - for review dialogs  
  original: Blob;   // Full compressed - for evidence
}

const createResizedBlob = (
  img: HTMLImageElement, 
  maxWidth: number, 
  maxHeight: number, 
  quality: number,
  format: 'jpeg' | 'webp'
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
    options: CompressionOptions = {}
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
    options: CompressionOptions = {}
  ): Promise<CompressionResult> => {
    // Convert data URL to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return compressImage(blob, options);
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

  return { compressImage, compressFromDataUrl, generateThumbnails, generateThumbnailsFromDataUrl };
};
