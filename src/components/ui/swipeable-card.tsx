import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  leftActionColor?: string;
  rightActionColor?: string;
  threshold?: number;
  className?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  leftActionColor = 'bg-destructive',
  rightActionColor = 'bg-primary',
  threshold = 80,
  className,
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;

    // Limit swipe distance with resistance
    const maxSwipe = threshold * 1.5;
    const resistance = 0.5;
    let newTranslate = diff;

    if (Math.abs(diff) > threshold) {
      newTranslate = threshold + (Math.abs(diff) - threshold) * resistance;
      if (diff < 0) newTranslate = -newTranslate;
    }

    // Only allow swipe if corresponding action exists
    if (diff > 0 && !onSwipeRight) return;
    if (diff < 0 && !onSwipeLeft) return;

    setTranslateX(Math.max(-maxSwipe, Math.min(maxSwipe, newTranslate)));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    if (Math.abs(translateX) >= threshold) {
      if (translateX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (translateX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setTranslateX(0);
  };

  const showLeftAction = translateX < -20 && leftAction;
  const showRightAction = translateX > 20 && rightAction;

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Left action (revealed when swiping left) */}
      {leftAction && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-opacity",
            leftActionColor,
            showLeftAction ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(Math.min(translateX, 0)) }}
        >
          {leftAction}
        </div>
      )}

      {/* Right action (revealed when swiping right) */}
      {rightAction && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-opacity",
            rightActionColor,
            showRightAction ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.max(translateX, 0) }}
        >
          {rightAction}
        </div>
      )}

      {/* Card content */}
      <div
        ref={cardRef}
        className="relative bg-card"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
