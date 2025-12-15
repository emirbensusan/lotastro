import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface FloatingActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  size?: 'default' | 'lg';
  variant?: 'default' | 'secondary' | 'destructive';
  className?: string;
  haptic?: boolean;
}

export function FloatingActionButton({
  icon,
  onClick,
  label,
  position = 'bottom-right',
  size = 'default',
  variant = 'default',
  className,
  haptic = true,
}: FloatingActionButtonProps) {
  const { impact } = useHapticFeedback();

  const handleClick = () => {
    if (haptic) {
      impact('medium');
    }
    onClick();
  };

  const positionClasses = {
    'bottom-right': 'right-4 bottom-4',
    'bottom-left': 'left-4 bottom-4',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-4',
  };

  const sizeClasses = {
    default: 'h-14 w-14',
    lg: 'h-16 w-16',
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={cn(
        "fixed z-40 rounded-full shadow-lg",
        "pb-safe", // Respect safe area
        positionClasses[position],
        sizeClasses[size],
        // Thumb-zone optimized: slightly higher from bottom edge
        "mb-safe",
        className
      )}
      aria-label={label}
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
    </Button>
  );
}
