import React, { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  gap?: number;
  loadingPlaceholder?: ReactNode;
  emptyPlaceholder?: ReactNode;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 80,
  overscan = 5,
  className,
  gap = 8,
  loadingPlaceholder,
  emptyPlaceholder,
  onEndReached,
  endReachedThreshold = 200,
  getItemKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
    getItemKey: getItemKey 
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onEndReached) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

    if (distanceFromEnd < endReachedThreshold && !hasReachedEnd) {
      setHasReachedEnd(true);
      onEndReached();
    } else if (distanceFromEnd >= endReachedThreshold) {
      setHasReachedEnd(false);
    }
  }, [onEndReached, endReachedThreshold, hasReachedEnd]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (items.length === 0) {
    return emptyPlaceholder ? <>{emptyPlaceholder}</> : null;
  }

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-auto", className)}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: gap,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Loading skeleton for virtual list
export function VirtualListSkeleton({ 
  count = 5, 
  height = 80,
  className 
}: { 
  count?: number; 
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="w-full" style={{ height }} />
      ))}
    </div>
  );
}

export default VirtualList;
