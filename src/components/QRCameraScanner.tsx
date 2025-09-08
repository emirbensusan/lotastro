import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";


interface QRCameraScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQRCodeDetected: (qrData: string) => void;
}

export default function QRCameraScanner({
  open,
  onOpenChange,
  onQRCodeDetected
}: QRCameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open && isScanning) {
      startCameraScanning();
    }
    
    return () => {
      stopScanning();
    };
  }, [open, isScanning]);

  const startCameraScanning = async () => {
    try {
      setError(null);
      await startWebCamera();
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please check permissions.');
      setIsScanning(false);
    }
  };


  const startWebCamera = async () => {
    const constraints = {
      video: {
        facingMode: 'environment', // Use back camera on mobile
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      
      // Start QR detection loop
      videoRef.current.onloadedmetadata = () => {
        scanForQRCode();
      };
    }
  };

  const scanForQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      onQRCodeDetected(code.data);
      stopScanning();
      onOpenChange(false);
      toast.success('QR Code detected successfully!');
    } else {
      // Continue scanning
      requestAnimationFrame(scanForQRCode);
    }
  };

  const processImageForQR = async (dataUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          reject(new Error('Canvas not available'));
          return;
        }

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context not available'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          onQRCodeDetected(code.data);
          onOpenChange(false);
          toast.success('QR Code detected from image!');
          resolve();
        } else {
          toast.error('No QR code found in image');
          reject(new Error('No QR code found'));
        }
      };
      img.src = dataUrl;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      try {
        await processImageForQR(dataUrl);
      } catch (err) {
        // Error already handled in processImageForQR
      }
    };
    reader.readAsDataURL(file);
  };

  const stopScanning = () => {
    setIsScanning(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleClose = () => {
    stopScanning();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isScanning ? (
            <div className="space-y-4">
              <Button
                onClick={() => setIsScanning(true)}
                className="w-full"
                size="lg"
              >
                <Camera className="w-5 h-5 mr-2" />
                Start Camera Scanning
              </Button>
              
              <div className="text-center text-muted-foreground">or</div>
              
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('qr-file-upload')?.click()}
                  className="w-full"
                  size="lg"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Image
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg animate-pulse" />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={stopScanning}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                Position QR code within the scanning area
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}