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

export const useImageCompression = () => {
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

  return { compressImage, compressFromDataUrl };
};
