-- Drop existing functions to allow return type changes
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_inventory_pivot_summary();

-- Recreate get_dashboard_stats() with incoming stock and reservation metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
  total_in_stock_lots bigint,
  total_out_of_stock_lots bigint,
  total_rolls bigint,
  total_meters numeric,
  oldest_lot_days integer,
  pending_orders bigint,
  total_incoming_meters numeric,
  total_reserved_meters numeric,
  active_reservations_count bigint
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
  ),
  incoming_stats AS (
    SELECT 
      COALESCE(SUM(expected_meters - received_meters), 0) as total_incoming_meters
    FROM incoming_stock
    WHERE status IN ('pending_inbound', 'partially_received')
  ),
  reservation_stats AS (
    SELECT 
      COUNT(*) as active_reservations,
      (
        SELECT COALESCE(SUM(reserved_meters), 0)
        FROM lots
        WHERE status = 'in_stock'
      ) + (
        SELECT COALESCE(SUM(reserved_meters), 0)
        FROM incoming_stock
        WHERE status IN ('pending_inbound', 'partially_received')
      ) as total_reserved_meters
    FROM reservations
    WHERE status = 'active'
  )
  SELECT 
    lot_stats.in_stock_lots,
    lot_stats.out_of_stock_lots,
    lot_stats.total_rolls,
    lot_stats.total_meters,
    lot_stats.oldest_lot_days,
    order_stats.pending_orders,
    incoming_stats.total_incoming_meters,
    reservation_stats.total_reserved_meters,
    reservation_stats.active_reservations as active_reservations_count
  FROM lot_stats, order_stats, incoming_stats, reservation_stats;
$function$;

-- Recreate get_inventory_pivot_summary() with incoming stock and reservation details
CREATE OR REPLACE FUNCTION public.get_inventory_pivot_summary()
RETURNS TABLE(
  quality text,
  normalized_quality text,
  color text,
  total_meters numeric,
  total_rolls bigint,
  lot_count bigint,
  incoming_meters numeric,
  physical_reserved_meters numeric,
  incoming_reserved_meters numeric,
  total_reserved_meters numeric,
  available_meters numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH inventory_base AS (
    SELECT 
      MIN(lots.quality) as quality,
      public.normalize_quality(lots.quality) as normalized_quality,
      lots.color,
      COALESCE(SUM((
        SELECT SUM(r.meters)
        FROM rolls r
        WHERE r.lot_id = lots.id AND r.status = 'available'
      )), 0) as total_meters,
      COALESCE(SUM((
        SELECT COUNT(*)
        FROM rolls r
        WHERE r.lot_id = lots.id AND r.status = 'available'
      )), 0) as total_rolls,
      COUNT(*) as lot_count
    FROM lots 
    WHERE status = 'in_stock'
    GROUP BY public.normalize_quality(lots.quality), lots.color
  ),
  incoming_agg AS (
    SELECT
      public.normalize_quality(quality) as normalized_quality,
      color,
      COALESCE(SUM(expected_meters - received_meters), 0) as incoming_meters
    FROM incoming_stock
    WHERE status IN ('pending_inbound', 'partially_received')
    GROUP BY public.normalize_quality(quality), color
  ),
  physical_reservations AS (
    SELECT
      public.normalize_quality(rl.quality) as normalized_quality,
      rl.color,
      COALESCE(SUM(rl.reserved_meters), 0) as physical_reserved
    FROM reservation_lines rl
    JOIN reservations r ON rl.reservation_id = r.id
    WHERE rl.scope = 'INVENTORY' AND r.status = 'active'
    GROUP BY public.normalize_quality(rl.quality), rl.color
  ),
  incoming_reservations AS (
    SELECT
      public.normalize_quality(rl.quality) as normalized_quality,
      rl.color,
      COALESCE(SUM(rl.reserved_meters), 0) as incoming_reserved
    FROM reservation_lines rl
    JOIN reservations r ON rl.reservation_id = r.id
    WHERE rl.scope = 'INCOMING' AND r.status = 'active'
    GROUP BY public.normalize_quality(rl.quality), rl.color
  )
  SELECT 
    COALESCE(inv.quality, (SELECT MIN(quality) FROM incoming_stock WHERE public.normalize_quality(quality) = COALESCE(inc.normalized_quality, phys_res.normalized_quality, inc_res.normalized_quality)), '') as quality,
    COALESCE(inv.normalized_quality, inc.normalized_quality, phys_res.normalized_quality, inc_res.normalized_quality) as normalized_quality,
    COALESCE(inv.color, inc.color, phys_res.color, inc_res.color) as color,
    COALESCE(inv.total_meters, 0) as total_meters,
    COALESCE(inv.total_rolls, 0) as total_rolls,
    COALESCE(inv.lot_count, 0) as lot_count,
    COALESCE(inc.incoming_meters, 0) as incoming_meters,
    COALESCE(phys_res.physical_reserved, 0) as physical_reserved_meters,
    COALESCE(inc_res.incoming_reserved, 0) as incoming_reserved_meters,
    COALESCE(phys_res.physical_reserved, 0) + COALESCE(inc_res.incoming_reserved, 0) as total_reserved_meters,
    COALESCE(inv.total_meters, 0) + COALESCE(inc.incoming_meters, 0) - 
      (COALESCE(phys_res.physical_reserved, 0) + COALESCE(inc_res.incoming_reserved, 0)) as available_meters
  FROM inventory_base inv
  FULL OUTER JOIN incoming_agg inc 
    ON inv.normalized_quality = inc.normalized_quality 
    AND inv.color = inc.color
  FULL OUTER JOIN physical_reservations phys_res 
    ON COALESCE(inv.normalized_quality, inc.normalized_quality) = phys_res.normalized_quality 
    AND COALESCE(inv.color, inc.color) = phys_res.color
  FULL OUTER JOIN incoming_reservations inc_res 
    ON COALESCE(inv.normalized_quality, inc.normalized_quality, phys_res.normalized_quality) = inc_res.normalized_quality 
    AND COALESCE(inv.color, inc.color, phys_res.color) = inc_res.color
  ORDER BY available_meters DESC;
$function$;