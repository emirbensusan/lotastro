import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Camera, X, Zap, ZapOff, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
}

export const CameraCapture = ({ onCapture, onCancel }: CameraCaptureProps) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('auto');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setError(null);
      setIsReady(false);

      // Request camera with constraints
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }

      // Check if flash/torch is available
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (!capabilities?.torch) {
        // Flash not available, hide flash controls
        console.log('[CameraCapture] Torch not available on this device');
      }
    } catch (err) {
      console.error('[CameraCapture] Camera error:', err);
      setError(String(t('stocktake.cameraError')));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Toggle flash
  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() as any;
    
    if (!capabilities?.torch) {
      return; // Torch not supported
    }

    const newMode = flashMode === 'off' ? 'on' : flashMode === 'on' ? 'auto' : 'off';
    setFlashMode(newMode);

    try {
      await track.applyConstraints({
        advanced: [{ torch: newMode === 'on' } as any]
      });
    } catch (err) {
      console.error('[CameraCapture] Flash toggle error:', err);
    }
  }, [flashMode]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Get image as data URL (JPEG for smaller size)
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
  }, []);

  // Confirm captured photo
  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      stopCamera();
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [onCancel]);

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Camera className="h-16 w-16 text-muted-foreground mx-auto" />
          <p className="text-lg font-medium">{error}</p>
          <p className="text-sm text-muted-foreground">{String(t('stocktake.cameraPermissionHint'))}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleCancel}>
              {String(t('cancel'))}
            </Button>
            <Button onClick={startCamera}>
              {String(t('stocktake.tryAgain'))}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera viewfinder or captured image */}
      <div className="flex-1 relative overflow-hidden">
        {capturedImage ? (
          // Show captured image for preview
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        ) : (
          // Show live camera feed
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Focus guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 border-2 border-white/50 rounded-lg relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded text-white text-xs">
                  {String(t('stocktake.alignLabel'))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={handleCancel}
          >
            <X className="h-6 w-6" />
          </Button>

          {!capturedImage && (
            <div className="flex gap-2">
              {/* Flash toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleFlash}
              >
                {flashMode === 'off' ? (
                  <ZapOff className="h-5 w-5" />
                ) : (
                  <Zap className={cn('h-5 w-5', flashMode === 'auto' && 'opacity-50')} />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {!isReady && !capturedImage && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black p-6 pb-safe">
        {capturedImage ? (
          // Preview controls
          <div className="flex justify-center items-center gap-8">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/20 flex flex-col items-center gap-1 h-auto"
              onClick={retakePhoto}
            >
              <RotateCcw className="h-8 w-8" />
              <span className="text-xs">{String(t('stocktake.retake'))}</span>
            </Button>

            <Button
              size="lg"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
              onClick={confirmPhoto}
            >
              <Check className="h-8 w-8" />
            </Button>
          </div>
        ) : (
          // Capture controls
          <div className="flex justify-center items-center gap-8">
            {/* Switch camera */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={switchCamera}
            >
              <RotateCcw className="h-6 w-6" />
            </Button>

            {/* Capture button */}
            <Button
              size="lg"
              className="h-20 w-20 rounded-full bg-white hover:bg-gray-200"
              onClick={capturePhoto}
              disabled={!isReady}
            >
              <div className="h-16 w-16 rounded-full border-4 border-black" />
            </Button>

            {/* Placeholder for symmetry */}
            <div className="w-10" />
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
