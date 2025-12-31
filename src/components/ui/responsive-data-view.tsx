import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDataCard, MobileDataCardProps } from '@/components/ui/mobile-data-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  id: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

interface ResponsiveDataViewProps<T extends { id?: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  mobileCard: (item: T, index: number) => Omit<MobileDataCardProps, 'className'>;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  keyExtractor?: (item: T, index: number) => string;
}

export function ResponsiveDataView<T extends { id?: string }>({
  data,
  columns,
  mobileCard,
  emptyTitle,
  emptyDescription,
  onRowClick,
  isLoading,
  keyExtractor = (item, index) => item.id || String(index),
}: ResponsiveDataViewProps<T>) {
  const isMobile = useIsMobile();

  if (isLoading) {
    if (isMobile) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border rounded-lg">
              <Skeleton className="h-5 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0 && emptyTitle) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full p-4 mb-4 bg-muted/30">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">{emptyTitle}</h3>
        {emptyDescription && (
          <p className="text-sm text-muted-foreground max-w-sm">{emptyDescription}</p>
        )}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map((item, index) => {
          const cardProps = mobileCard(item, index);
          return (
            <MobileDataCard
              key={keyExtractor(item, index)}
              {...cardProps}
              className={cn(onRowClick && 'cursor-pointer active:scale-[0.98] transition-transform')}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow
              key={keyExtractor(item, index)}
              className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.id} className={col.className}>
                  {col.cell(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
