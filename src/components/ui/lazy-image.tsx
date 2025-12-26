import React, { useState, useRef, useEffect, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
  placeholderClassName?: string;
  threshold?: number;
  rootMargin?: string;
  onLoadSuccess?: () => void;
  onLoadError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className,
  fallback,
  placeholderClassName,
  threshold = 0.1,
  rootMargin = '50px',
  onLoadSuccess,
  onLoadError,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoadSuccess?.();
  };

  const handleError = () => {
    setHasError(true);
    onLoadError?.();
  };

  const DefaultFallback = (
    <div className={cn(
      "flex items-center justify-center bg-muted text-muted-foreground",
      className
    )}>
      <ImageOff className="h-6 w-6" />
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      {/* Placeholder skeleton */}
      {!isLoaded && !hasError && (
        <Skeleton 
          className={cn(
            "absolute inset-0",
            placeholderClassName
          )} 
        />
      )}

      {/* Error fallback */}
      {hasError && (fallback || DefaultFallback)}

      {/* Actual image - only load when in view */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
    </div>
  );
}

// Wrapper for background images with lazy loading
interface LazyBackgroundProps {
  src: string;
  className?: string;
  children?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export function LazyBackground({
  src,
  className,
  children,
  threshold = 0.1,
  rootMargin = '50px',
}: LazyBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [isInView, src]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "transition-opacity duration-300",
        isLoaded ? "opacity-100" : "opacity-0",
        className
      )}
      style={isLoaded ? { backgroundImage: `url(${src})` } : undefined}
    >
      {children}
    </div>
  );
}

export default LazyImage;
