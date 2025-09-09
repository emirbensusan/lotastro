-- Create a comprehensive dashboard stats function that returns aggregated data directly
-- Fixed the EXTRACT syntax for PostgreSQL
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
  total_in_stock_lots bigint,
  total_out_of_stock_lots bigint,
  total_rolls bigint, 
  total_meters numeric,
  oldest_lot_days integer,
  pending_orders bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH lot_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'in_stock') as in_stock_lots,
      COUNT(*) FILTER (WHERE status = 'out_of_stock') as out_of_stock_lots,
      SUM(roll_count) FILTER (WHERE status = 'in_stock') as total_rolls,
      SUM(meters) FILTER (WHERE status = 'in_stock') as total_meters,
      COALESCE((CURRENT_DATE - MIN(entry_date)), 0)::integer as oldest_lot_days
    FROM lots
  ),
  order_stats AS (
    SELECT COUNT(*) as pending_orders
    FROM orders 
    WHERE fulfilled_at IS NULL
  )
  SELECT 
    lot_stats.in_stock_lots,
    lot_stats.out_of_stock_lots,
    lot_stats.total_rolls,
    lot_stats.total_meters,
    lot_stats.oldest_lot_days,
    order_stats.pending_orders
  FROM lot_stats, order_stats;
$function$