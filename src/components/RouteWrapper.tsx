import React, { Suspense, ReactNode, ComponentType } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

interface RouteWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// Default loading skeleton for page transitions
function PageLoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64 mt-6" />
    </div>
  );
}

// Wrapper that provides error boundary and suspense for routes
export function RouteWrapper({ children, fallback }: RouteWrapperProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback || <PageLoadingSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// HOC to wrap lazy-loaded pages with error handling
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: { fallback?: ReactNode }
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={options?.fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  
  return WrappedComponent;
}

export default RouteWrapper;
