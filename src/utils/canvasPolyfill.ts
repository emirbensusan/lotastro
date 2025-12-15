/**
 * iOS Safari Canvas Polyfill and Workarounds
 * 
 * iOS Safari has known issues with canvas.toBlob() and canvas.toDataURL():
 * - Can return empty/null results on large canvases
 * - Memory pressure can cause silent failures
 * - WebKit has canvas size limits (~16MP for older devices)
 * 
 * This module provides robust fallbacks and workarounds.
 */

// iOS Safari detection
export const isIOSSafari = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return isIOS && isSafari;
};

// Get iOS version
export const getIOSVersion = (): number | null => {
  if (typeof navigator === 'undefined') return null;
  
  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
};

// Check if device is iOS (any browser)
export const isIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// iOS canvas size limits (conservative estimates)
const IOS_MAX_CANVAS_AREA = 16777216; // 4096 x 4096 = ~16MP for older devices
const IOS_SAFE_CANVAS_AREA = 4194304; // 2048 x 2048 = ~4MP (very safe)

/**
 * Check if canvas dimensions are safe for iOS
 */
export const isCanvasSizeValid = (width: number, height: number): boolean => {
  const area = width * height;
  
  if (isIOS()) {
    const iosVersion = getIOSVersion();
    // Older iOS versions (< 15) have stricter limits
    const maxArea = iosVersion && iosVersion < 15 ? IOS_SAFE_CANVAS_AREA : IOS_MAX_CANVAS_AREA;
    return area <= maxArea;
  }
  
  return true;
};

/**
 * Calculate safe dimensions that maintain aspect ratio
 */
export const getSafeCanvasDimensions = (
  width: number, 
  height: number,
  maxArea: number = IOS_SAFE_CANVAS_AREA
): { width: number; height: number } => {
  const area = width * height;
  
  if (area <= maxArea) {
    return { width, height };
  }
  
  // Scale down to fit within max area while maintaining aspect ratio
  const scale = Math.sqrt(maxArea / area);
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
  };
};

/**
 * Robust toDataURL with iOS workarounds
 * Falls back to manual pixel extraction if toDataURL fails
 */
export const safeToDataURL = (
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.9
): string => {
  console.log('[safeToDataURL] Starting conversion', {
    width: canvas.width,
    height: canvas.height,
    type,
    quality,
    isIOS: isIOS(),
    isIOSSafari: isIOSSafari(),
  });

  try {
    // First attempt: standard toDataURL
    const result = canvas.toDataURL(type, quality);
    
    // Validate result
    if (!result || result === 'data:,' || result.length < 100) {
      console.warn('[safeToDataURL] toDataURL returned empty/invalid result');
      throw new Error('toDataURL returned empty result');
    }
    
    console.log('[safeToDataURL] Success, data URL length:', result.length);
    return result;
  } catch (error) {
    console.error('[safeToDataURL] Primary method failed:', error);
    
    // Fallback: Try with PNG if JPEG failed
    if (type !== 'image/png') {
      try {
        console.log('[safeToDataURL] Trying PNG fallback...');
        const pngResult = canvas.toDataURL('image/png');
        if (pngResult && pngResult !== 'data:,' && pngResult.length > 100) {
          console.log('[safeToDataURL] PNG fallback success');
          return pngResult;
        }
      } catch (pngError) {
        console.error('[safeToDataURL] PNG fallback also failed:', pngError);
      }
    }
    
    // Final fallback: Try with a smaller canvas
    try {
      console.log('[safeToDataURL] Trying reduced size fallback...');
      const safeDims = getSafeCanvasDimensions(canvas.width, canvas.height);
      
      if (safeDims.width < canvas.width) {
        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = safeDims.width;
        smallCanvas.height = safeDims.height;
        
        const ctx = smallCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, safeDims.width, safeDims.height);
          const result = smallCanvas.toDataURL(type, quality);
          
          if (result && result !== 'data:,' && result.length > 100) {
            console.log('[safeToDataURL] Reduced size fallback success');
            return result;
          }
        }
      }
    } catch (fallbackError) {
      console.error('[safeToDataURL] All fallbacks failed:', fallbackError);
    }
    
    throw new Error('Unable to convert canvas to data URL');
  }
};

/**
 * Robust toBlob with iOS workarounds
 * Uses toDataURL as fallback and converts to Blob manually
 */
export const safeToBlob = (
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.9
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    console.log('[safeToBlob] Starting conversion', {
      width: canvas.width,
      height: canvas.height,
      type,
      quality,
      isIOS: isIOS(),
    });

    // For iOS, always try toDataURL first as it's more reliable
    if (isIOS()) {
      try {
        const dataUrl = safeToDataURL(canvas, type, quality);
        const blob = dataURLToBlob(dataUrl);
        console.log('[safeToBlob] iOS: toDataURL method success');
        resolve(blob);
        return;
      } catch (error) {
        console.warn('[safeToBlob] iOS toDataURL failed, trying toBlob:', error);
      }
    }

    // Standard approach with timeout protection
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('[safeToBlob] toBlob timed out, using fallback');
        try {
          const dataUrl = safeToDataURL(canvas, type, quality);
          const blob = dataURLToBlob(dataUrl);
          resolve(blob);
        } catch (error) {
          reject(new Error('Canvas conversion timed out and fallback failed'));
        }
      }
    }, 5000);

    try {
      canvas.toBlob(
        (blob) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);

          if (!blob) {
            console.warn('[safeToBlob] toBlob returned null, using fallback');
            try {
              const dataUrl = safeToDataURL(canvas, type, quality);
              const fallbackBlob = dataURLToBlob(dataUrl);
              resolve(fallbackBlob);
            } catch (error) {
              reject(new Error('toBlob returned null and fallback failed'));
            }
            return;
          }

          console.log('[safeToBlob] toBlob success, size:', blob.size);
          resolve(blob);
        },
        type,
        quality
      );
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error('[safeToBlob] toBlob threw error:', error);
        
        // Try fallback
        try {
          const dataUrl = safeToDataURL(canvas, type, quality);
          const blob = dataURLToBlob(dataUrl);
          resolve(blob);
        } catch (fallbackError) {
          reject(new Error('toBlob failed and fallback failed'));
        }
      }
    }
  });
};

/**
 * Convert data URL to Blob
 */
export const dataURLToBlob = (dataUrl: string): Blob => {
  if (!dataUrl || !dataUrl.includes(',')) {
    throw new Error('Invalid data URL');
  }

  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
};

/**
 * Create a safe canvas from video with iOS optimizations
 */
export const captureVideoFrame = (
  video: HTMLVideoElement,
  maxWidth: number = 1600,
  maxHeight: number = 1600
): { canvas: HTMLCanvasElement; dataUrl: string } => {
  console.log('[captureVideoFrame] Starting capture', {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    maxWidth,
    maxHeight,
  });

  let width = video.videoWidth;
  let height = video.videoHeight;

  // On iOS, aggressively limit canvas size
  if (isIOS()) {
    const safeDims = getSafeCanvasDimensions(width, height, IOS_SAFE_CANVAS_AREA);
    const scale = Math.min(
      maxWidth / width,
      maxHeight / height,
      safeDims.width / width,
      safeDims.height / height
    );
    
    if (scale < 1) {
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
  } else {
    // Non-iOS: just respect max dimensions
    if (width > maxWidth || height > maxHeight) {
      const scale = Math.min(maxWidth / width, maxHeight / height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
  }

  console.log('[captureVideoFrame] Creating canvas', { width, height });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // iOS Safari workaround: fill with white first to avoid transparency issues
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Draw video frame
  ctx.drawImage(video, 0, 0, width, height);

  // Get data URL using safe method
  const dataUrl = safeToDataURL(canvas, 'image/jpeg', 0.9);

  return { canvas, dataUrl };
};
