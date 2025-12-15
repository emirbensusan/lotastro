import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { RotateCcw, Check, Move } from 'lucide-react';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropToolProps {
  imageDataUrl: string;
  onConfirm: (croppedImageDataUrl: string) => void;
  onCancel: () => void;
}

const MIN_CROP_SIZE = 100;

export const ImageCropTool = ({ imageDataUrl, onConfirm, onCancel }: ImageCropToolProps) => {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialRect, setInitialRect] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

  // Initialize crop rect when image loads
  useEffect(() => {
    if (imageLoaded && imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;
      
      // Get actual displayed size
      const containerRect = container.getBoundingClientRect();
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const containerAspect = containerRect.width / containerRect.height;
      
      let displayWidth, displayHeight;
      if (imgAspect > containerAspect) {
        displayWidth = containerRect.width;
        displayHeight = containerRect.width / imgAspect;
      } else {
        displayHeight = containerRect.height;
        displayWidth = containerRect.height * imgAspect;
      }
      
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setDisplaySize({ width: displayWidth, height: displayHeight });
      
      // Default crop: center 60% of image
      const defaultWidth = displayWidth * 0.6;
      const defaultHeight = displayHeight * 0.5;
      const defaultX = (displayWidth - defaultWidth) / 2;
      const defaultY = (displayHeight - defaultHeight) / 2;
      
      setCropRect({
        x: defaultX,
        y: defaultY,
        width: defaultWidth,
        height: defaultHeight,
      });
    }
  }, [imageLoaded]);

  // Handle pointer events for dragging and resizing
  const handlePointerDown = useCallback((e: React.PointerEvent, action: 'move' | string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialRect({ ...cropRect });
    
    if (action === 'move') {
      setIsDragging(true);
    } else {
      setIsResizing(action);
    }
  }, [cropRect]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging && !isResizing) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    if (isDragging) {
      // Move the crop rect
      let newX = initialRect.x + deltaX;
      let newY = initialRect.y + deltaY;
      
      // Constrain to bounds
      newX = Math.max(0, Math.min(newX, displaySize.width - cropRect.width));
      newY = Math.max(0, Math.min(newY, displaySize.height - cropRect.height));
      
      setCropRect(prev => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      // Resize the crop rect
      let newRect = { ...initialRect };
      
      switch (isResizing) {
        case 'nw':
          newRect.x = Math.max(0, initialRect.x + deltaX);
          newRect.y = Math.max(0, initialRect.y + deltaY);
          newRect.width = Math.max(MIN_CROP_SIZE, initialRect.width - deltaX);
          newRect.height = Math.max(MIN_CROP_SIZE, initialRect.height - deltaY);
          break;
        case 'ne':
          newRect.y = Math.max(0, initialRect.y + deltaY);
          newRect.width = Math.max(MIN_CROP_SIZE, Math.min(initialRect.width + deltaX, displaySize.width - initialRect.x));
          newRect.height = Math.max(MIN_CROP_SIZE, initialRect.height - deltaY);
          break;
        case 'sw':
          newRect.x = Math.max(0, initialRect.x + deltaX);
          newRect.width = Math.max(MIN_CROP_SIZE, initialRect.width - deltaX);
          newRect.height = Math.max(MIN_CROP_SIZE, Math.min(initialRect.height + deltaY, displaySize.height - initialRect.y));
          break;
        case 'se':
          newRect.width = Math.max(MIN_CROP_SIZE, Math.min(initialRect.width + deltaX, displaySize.width - initialRect.x));
          newRect.height = Math.max(MIN_CROP_SIZE, Math.min(initialRect.height + deltaY, displaySize.height - initialRect.y));
          break;
        case 'n':
          newRect.y = Math.max(0, initialRect.y + deltaY);
          newRect.height = Math.max(MIN_CROP_SIZE, initialRect.height - deltaY);
          break;
        case 's':
          newRect.height = Math.max(MIN_CROP_SIZE, Math.min(initialRect.height + deltaY, displaySize.height - initialRect.y));
          break;
        case 'w':
          newRect.x = Math.max(0, initialRect.x + deltaX);
          newRect.width = Math.max(MIN_CROP_SIZE, initialRect.width - deltaX);
          break;
        case 'e':
          newRect.width = Math.max(MIN_CROP_SIZE, Math.min(initialRect.width + deltaX, displaySize.width - initialRect.x));
          break;
      }
      
      setCropRect(newRect);
    }
  }, [isDragging, isResizing, dragStart, initialRect, displaySize, cropRect.width, cropRect.height]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  // Reset crop to default
  const resetCrop = useCallback(() => {
    const defaultWidth = displaySize.width * 0.6;
    const defaultHeight = displaySize.height * 0.5;
    setCropRect({
      x: (displaySize.width - defaultWidth) / 2,
      y: (displaySize.height - defaultHeight) / 2,
      width: defaultWidth,
      height: defaultHeight,
    });
  }, [displaySize]);

  // Confirm and crop the image
  const confirmCrop = useCallback(async () => {
    if (!imageRef.current || !displaySize.width) return;
    
    // Calculate scale between display and actual image
    const scaleX = imageSize.width / displaySize.width;
    const scaleY = imageSize.height / displaySize.height;
    
    // Calculate actual crop coordinates
    const actualCrop = {
      x: cropRect.x * scaleX,
      y: cropRect.y * scaleY,
      width: cropRect.width * scaleX,
      height: cropRect.height * scaleY,
    };
    
    // Create canvas and crop
    const canvas = document.createElement('canvas');
    canvas.width = actualCrop.width;
    canvas.height = actualCrop.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw cropped portion
    ctx.drawImage(
      imageRef.current,
      actualCrop.x, actualCrop.y, actualCrop.width, actualCrop.height,
      0, 0, actualCrop.width, actualCrop.height
    );
    
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onConfirm(croppedDataUrl);
  }, [imageSize, displaySize, cropRect, onConfirm]);

  const handleSize = 'w-6 h-6 sm:w-5 sm:h-5';
  const handleClass = `absolute bg-white border-2 border-primary rounded-full ${handleSize} touch-none`;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col h-screen-safe">
      {/* Header */}
      <div className="bg-black/80 p-4 pt-safe flex items-center justify-between">
        <Button variant="ghost" className="text-white" onClick={onCancel}>
          {String(t('cancel'))}
        </Button>
        <h2 className="text-white text-lg font-medium flex items-center gap-2">
          <Move className="h-5 w-5" />
          {String(t('stocktake.cropImage'))}
        </h2>
        <div className="w-16" />
      </div>

      {/* Image with crop overlay */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center bg-black"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Original image */}
        <img
          ref={imageRef}
          src={imageDataUrl}
          alt="Capture"
          className="max-w-full max-h-full object-contain"
          onLoad={() => setImageLoaded(true)}
          draggable={false}
        />
        
        {/* Dark overlay outside crop area */}
        {imageLoaded && displaySize.width > 0 && (
          <div 
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{ 
              width: displaySize.width, 
              height: displaySize.height,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Top dark area */}
            <div 
              className="absolute bg-black/60" 
              style={{ 
                top: 0, 
                left: 0, 
                right: 0, 
                height: cropRect.y 
              }} 
            />
            {/* Bottom dark area */}
            <div 
              className="absolute bg-black/60" 
              style={{ 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: displaySize.height - cropRect.y - cropRect.height 
              }} 
            />
            {/* Left dark area */}
            <div 
              className="absolute bg-black/60" 
              style={{ 
                top: cropRect.y, 
                left: 0, 
                width: cropRect.x, 
                height: cropRect.height 
              }} 
            />
            {/* Right dark area */}
            <div 
              className="absolute bg-black/60" 
              style={{ 
                top: cropRect.y, 
                right: 0, 
                width: displaySize.width - cropRect.x - cropRect.width, 
                height: cropRect.height 
              }} 
            />
          </div>
        )}
        
        {/* Crop rect with handles */}
        {imageLoaded && displaySize.width > 0 && (
          <div 
            className="absolute border-2 border-white"
            style={{ 
              left: `calc(50% - ${displaySize.width/2}px + ${cropRect.x}px)`,
              top: `calc(50% - ${displaySize.height/2}px + ${cropRect.y}px)`,
              width: cropRect.width,
              height: cropRect.height,
            }}
          >
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>
            
            {/* Move handle (center) */}
            <div
              className="absolute inset-0 cursor-move touch-none"
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            />
            
            {/* Corner handles */}
            <div 
              className={`${handleClass} -left-3 -top-3 cursor-nw-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'nw')}
            />
            <div 
              className={`${handleClass} -right-3 -top-3 cursor-ne-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'ne')}
            />
            <div 
              className={`${handleClass} -left-3 -bottom-3 cursor-sw-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'sw')}
            />
            <div 
              className={`${handleClass} -right-3 -bottom-3 cursor-se-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'se')}
            />
            
            {/* Edge handles */}
            <div 
              className={`${handleClass} left-1/2 -translate-x-1/2 -top-3 cursor-n-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'n')}
            />
            <div 
              className={`${handleClass} left-1/2 -translate-x-1/2 -bottom-3 cursor-s-resize`}
              onPointerDown={(e) => handlePointerDown(e, 's')}
            />
            <div 
              className={`${handleClass} -left-3 top-1/2 -translate-y-1/2 cursor-w-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'w')}
            />
            <div 
              className={`${handleClass} -right-3 top-1/2 -translate-y-1/2 cursor-e-resize`}
              onPointerDown={(e) => handlePointerDown(e, 'e')}
            />
          </div>
        )}
      </div>

      {/* Hint text */}
      <div className="bg-black/80 px-4 py-2 text-center">
        <p className="text-white/70 text-sm">
          {String(t('stocktake.cropHint'))}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="bg-black p-6 pb-safe flex justify-center items-center gap-8">
        <Button
          variant="ghost"
          size="lg"
          className="text-white hover:bg-white/20 flex flex-col items-center gap-1 h-auto"
          onClick={resetCrop}
        >
          <RotateCcw className="h-8 w-8" />
          <span className="text-xs">{String(t('stocktake.resetCrop'))}</span>
        </Button>

        <Button
          size="lg"
          className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
          onClick={confirmCrop}
        >
          <Check className="h-8 w-8" />
        </Button>
      </div>
    </div>
  );
};
