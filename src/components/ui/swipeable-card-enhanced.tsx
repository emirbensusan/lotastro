import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, Check, MoreHorizontal, Edit } from 'lucide-react';

interface SwipeAction {
  icon: ReactNode;
  label: string;
  color: string;
  onAction: () => void;
}

interface SwipeableCardEnhancedProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

export function SwipeableCardEnhanced({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
  className,
  disabled = false,
}: SwipeableCardEnhancedProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeActionIndex, setActiveActionIndex] = useState<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const actionWidth = threshold;
  const maxLeftSwipe = leftActions.length * actionWidth;
  const maxRightSwipe = rightActions.length * actionWidth;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
      return;
    }

    // Only handle horizontal swipes
    if (!isHorizontalSwipe.current) return;

    // Prevent default to stop page scrolling during swipe
    e.preventDefault();

    // Calculate new position with resistance
    let newTranslate = diffX;
    const resistance = 0.4;

    // Swiping left (reveals right actions)
    if (diffX < 0 && rightActions.length > 0) {
      if (Math.abs(diffX) > maxRightSwipe) {
        newTranslate = -maxRightSwipe - (Math.abs(diffX) - maxRightSwipe) * resistance;
      }
      // Calculate which action is active
      const actionIndex = Math.min(
        Math.floor(Math.abs(newTranslate) / actionWidth),
        rightActions.length - 1
      );
      setActiveActionIndex(actionIndex);
    } 
    // Swiping right (reveals left actions)
    else if (diffX > 0 && leftActions.length > 0) {
      if (diffX > maxLeftSwipe) {
        newTranslate = maxLeftSwipe + (diffX - maxLeftSwipe) * resistance;
      }
      const actionIndex = Math.min(
        Math.floor(newTranslate / actionWidth),
        leftActions.length - 1
      );
      setActiveActionIndex(actionIndex);
    } else {
      newTranslate = 0;
    }

    setTranslateX(newTranslate);
  }, [isDragging, disabled, leftActions.length, rightActions.length, maxLeftSwipe, maxRightSwipe, actionWidth]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    setIsDragging(false);
    isHorizontalSwipe.current = null;

    // Trigger action if threshold met
    if (Math.abs(translateX) >= threshold) {
      if (translateX < 0 && rightActions.length > 0) {
        const actionIndex = Math.min(
          Math.floor(Math.abs(translateX) / actionWidth),
          rightActions.length - 1
        );
        rightActions[actionIndex]?.onAction();
      } else if (translateX > 0 && leftActions.length > 0) {
        const actionIndex = Math.min(
          Math.floor(translateX / actionWidth),
          leftActions.length - 1
        );
        leftActions[actionIndex]?.onAction();
      }
    }

    // Reset position
    setTranslateX(0);
    setActiveActionIndex(null);
  }, [disabled, translateX, threshold, leftActions, rightActions, actionWidth]);

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null;

    const isRevealed = side === 'left' ? translateX > 20 : translateX < -20;

    return (
      <div
        className={cn(
          "absolute inset-y-0 flex items-stretch transition-opacity",
          side === 'left' ? 'left-0' : 'right-0',
          isRevealed ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          width: Math.abs(side === 'left' ? Math.max(translateX, 0) : Math.min(translateX, 0)),
        }}
      >
        {actions.map((action, index) => {
          const isActive = activeActionIndex === index && (
            (side === 'left' && translateX > 0) || 
            (side === 'right' && translateX < 0)
          );
          
          return (
            <div
              key={index}
              className={cn(
                "flex items-center justify-center flex-1 transition-all",
                action.color,
                isActive && "scale-110"
              )}
            >
              {action.icon}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("relative overflow-hidden rounded-lg touch-pan-y", className)}>
      {/* Left actions (revealed when swiping right) */}
      {renderActions(leftActions, 'left')}

      {/* Right actions (revealed when swiping left) */}
      {renderActions(rightActions, 'right')}

      {/* Card content */}
      <div
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

// Pre-configured common swipe actions
export const commonSwipeActions = {
  delete: (onDelete: () => void): SwipeAction => ({
    icon: <Trash2 className="h-5 w-5 text-white" />,
    label: 'Delete',
    color: 'bg-destructive',
    onAction: onDelete,
  }),
  complete: (onComplete: () => void): SwipeAction => ({
    icon: <Check className="h-5 w-5 text-white" />,
    label: 'Complete',
    color: 'bg-green-500',
    onAction: onComplete,
  }),
  edit: (onEdit: () => void): SwipeAction => ({
    icon: <Edit className="h-5 w-5 text-white" />,
    label: 'Edit',
    color: 'bg-primary',
    onAction: onEdit,
  }),
  more: (onMore: () => void): SwipeAction => ({
    icon: <MoreHorizontal className="h-5 w-5 text-white" />,
    label: 'More',
    color: 'bg-secondary',
    onAction: onMore,
  }),
};

export default SwipeableCardEnhanced;
