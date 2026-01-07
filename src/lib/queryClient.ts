import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

// Query key factories for consistent cache management
export const queryKeys = {
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    insights: () => [...queryKeys.dashboard.all, 'insights'] as const,
  },
  // Inventory
  inventory: {
    all: ['inventory'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.inventory.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.inventory.all, 'detail', id] as const,
    lots: (quality: string, color: string) => [...queryKeys.inventory.all, 'lots', quality, color] as const,
  },
  // Catalog
  catalog: {
    all: ['catalog'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.catalog.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.catalog.all, 'detail', id] as const,
    search: (query: string) => [...queryKeys.catalog.all, 'search', query] as const,
  },
  // Orders
  orders: {
    all: ['orders'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.orders.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.orders.all, 'detail', id] as const,
  },
  // Reservations
  reservations: {
    all: ['reservations'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.reservations.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.reservations.all, 'detail', id] as const,
  },
  // Manufacturing Orders
  manufacturingOrders: {
    all: ['manufacturing-orders'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.manufacturingOrders.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.manufacturingOrders.all, 'detail', id] as const,
  },
  // Incoming Stock
  incomingStock: {
    all: ['incoming-stock'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.incomingStock.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.incomingStock.all, 'detail', id] as const,
  },
  // Audit Logs
  auditLogs: {
    all: ['audit-logs'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.auditLogs.all, 'list', filters] as const,
    recent: (limit: number) => [...queryKeys.auditLogs.all, 'recent', limit] as const,
  },
  // Suppliers
  suppliers: {
    all: ['suppliers'] as const,
    list: () => [...queryKeys.suppliers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.suppliers.all, 'detail', id] as const,
  },
  // Reports
  reports: {
    all: ['reports'] as const,
    list: () => [...queryKeys.reports.all, 'list'] as const,
    config: (id: string) => [...queryKeys.reports.all, 'config', id] as const,
  },
  // Forecast
  forecast: {
    all: ['forecast'] as const,
    results: (filters?: Record<string, unknown>) => [...queryKeys.forecast.all, 'results', filters] as const,
    settings: () => [...queryKeys.forecast.all, 'settings'] as const,
  },
  // Users/Profiles
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    profile: (id: string) => [...queryKeys.users.all, 'profile', id] as const,
  },
  // Permissions
  permissions: {
    all: ['permissions'] as const,
    byRole: (role: string) => [...queryKeys.permissions.all, 'role', role] as const,
  },
};

// Stale time configurations for different data types
export const staleTime = {
  // Data that changes frequently
  realtime: 0,
  // Dashboard stats - refresh every 5 minutes
  dashboard: 5 * 60 * 1000,
  // Inventory data - refresh every 5 minutes
  inventory: 5 * 60 * 1000,
  // Catalog items - refresh every 10 minutes (less volatile)
  catalog: 10 * 60 * 1000,
  // Static data like suppliers - refresh every 30 minutes
  static: 30 * 60 * 1000,
  // User preferences - refresh every hour
  preferences: 60 * 60 * 1000,
};

// Create optimized query client
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only show error toast if the query has previously succeeded
        // This prevents showing errors on initial load failures
        if (query.state.data !== undefined) {
          const message = error instanceof Error ? error.message : 'An error occurred';
          toast.error(`Error: ${message}`);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'An error occurred';
        toast.error(`Error: ${message}`);
      },
    }),
    defaultOptions: {
      queries: {
        // Default stale time - 5 minutes
        staleTime: staleTime.inventory,
        // Keep unused data in cache for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Don't refetch on window focus for enterprise apps
        refetchOnWindowFocus: false,
        // Retry configuration
        retry: (failureCount, error) => {
          const message = error instanceof Error ? error.message.toLowerCase() : '';
          // Don't retry on auth/forbidden/not-found errors
          if (message.includes('401') || message.includes('403') || message.includes('404')) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}

// Singleton query client instance for use across the app
export const queryClient = createQueryClient();
