import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, staleTime } from '@/lib/queryClient';

export interface DashboardStats {
  totalLots: number;
  totalRolls: number;
  totalMeters: number;
  inStockLots: number;
  outOfStockLots: number;
  pendingOrders: number;
  oldestLotDays: number;
  incomingMeters: number;
  reservedMeters: number;
  activeReservations: number;
  pendingReceipts: number;
  metersInProduction: number;
  inStockQualityColorPairs: number;
  outOfStockQualityColorPairs: number;
  activeCatalogItems: number;
}

const defaultStats: DashboardStats = {
  totalLots: 0,
  totalRolls: 0,
  totalMeters: 0,
  inStockLots: 0,
  outOfStockLots: 0,
  pendingOrders: 0,
  oldestLotDays: 0,
  incomingMeters: 0,
  reservedMeters: 0,
  activeReservations: 0,
  pendingReceipts: 0,
  metersInProduction: 0,
  inStockQualityColorPairs: 0,
  outOfStockQualityColorPairs: 0,
  activeCatalogItems: 0,
};

/**
 * Fetch dashboard stats from the database
 * Uses parallel queries for efficiency
 */
async function fetchDashboardStats(): Promise<DashboardStats> {
  const startTime = performance.now();

  // Run all queries in parallel for maximum efficiency
  const [
    rpcResult,
    pendingReceiptResult,
    moResult,
    inStockPairsResult,
    outOfStockPairsResult,
    catalogResult,
  ] = await Promise.all([
    // Main RPC call for aggregated stats
    supabase.rpc('get_dashboard_stats').single(),
    
    // Count pending receipts
    supabase
      .from('incoming_stock')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending_inbound', 'partially_received']),
    
    // Get meters in production
    supabase
      .from('manufacturing_orders')
      .select('ordered_amount')
      .not('status', 'in', '("SHIPPED","CANCELLED")'),
    
    // Count in-stock quality-color pairs
    supabase
      .from('lots')
      .select('quality, color')
      .eq('status', 'in_stock'),
    
    // Count out-of-stock quality-color pairs
    supabase
      .from('lots')
      .select('quality, color')
      .eq('status', 'out_of_stock'),
    
    // Count active catalog items
    supabase
      .from('catalog_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
  ]);

  if (rpcResult.error) {
    throw rpcResult.error;
  }

  const data = rpcResult.data;
  const metersInProduction = moResult.data?.reduce(
    (sum, mo) => sum + Number(mo.ordered_amount || 0), 
    0
  ) || 0;
  
  const inStockQualityColorPairs = new Set(
    inStockPairsResult.data?.map(l => `${l.quality}|${l.color}`)
  ).size;
  
  const outOfStockQualityColorPairs = new Set(
    outOfStockPairsResult.data?.map(l => `${l.quality}|${l.color}`)
  ).size;

  const stats: DashboardStats = {
    totalLots: Number(data?.total_in_stock_lots || 0),
    totalRolls: Number(data?.total_rolls || 0),
    totalMeters: Number(data?.total_meters || 0),
    inStockLots: Number(data?.total_in_stock_lots || 0),
    outOfStockLots: Number(data?.total_out_of_stock_lots || 0),
    pendingOrders: Number(data?.pending_orders || 0),
    oldestLotDays: Number(data?.oldest_lot_days || 0),
    incomingMeters: Number(data?.total_incoming_meters || 0),
    reservedMeters: Number(data?.total_reserved_meters || 0),
    activeReservations: Number(data?.active_reservations_count || 0),
    pendingReceipts: pendingReceiptResult.count || 0,
    metersInProduction,
    inStockQualityColorPairs,
    outOfStockQualityColorPairs,
    activeCatalogItems: catalogResult.count || 0,
  };

  const elapsed = performance.now() - startTime;
  console.info(`[DashboardStats] Fetched in ${elapsed.toFixed(0)}ms`, stats);

  return stats;
}

interface UseDashboardStatsOptions {
  /** Enable auto-refresh interval (in ms). Set to 0 to disable. Default: 60000 (1 min) */
  refetchInterval?: number;
  /** Enable the query. Default: true */
  enabled?: boolean;
}

/**
 * Hook to fetch dashboard stats with React Query caching
 * 
 * Features:
 * - Stale-while-revalidate: Shows cached data immediately while fetching fresh data
 * - Auto-refresh: Refreshes every 60 seconds by default
 * - Deduplication: Multiple components using this hook share the same query
 * - Cache persistence: Data survives navigation between pages
 */
export function useDashboardStats(options: UseDashboardStatsOptions = {}) {
  const { 
    refetchInterval = 60000, // 1 minute default
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: fetchDashboardStats,
    staleTime: staleTime.dashboard, // 5 minutes - show cached data without refetch
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    placeholderData: defaultStats, // Show zeros while loading (no skeleton flash)
    enabled,
  });

  // Manual refresh function with haptic feedback support
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  }, [queryClient]);

  return {
    stats: query.data ?? defaultStats,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refresh,
    // For components that need to know if we have real data
    hasData: query.data !== undefined && !query.isLoading,
  };
}

export default useDashboardStats;
