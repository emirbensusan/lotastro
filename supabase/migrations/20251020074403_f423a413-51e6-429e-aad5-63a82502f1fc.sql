-- Migration 3: Database Functions

-- 1. Get inventory with reservations
CREATE OR REPLACE FUNCTION public.get_inventory_with_reservations()
RETURNS TABLE(
  quality TEXT,
  color TEXT,
  instock_meters NUMERIC,
  incoming_meters NUMERIC,
  physical_reserved_meters NUMERIC,
  incoming_reserved_meters NUMERIC,
  total_reserved_meters NUMERIC,
  available_meters NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(inv.quality, inc.quality, res_phys.quality, res_inc.quality) as quality,
    COALESCE(inv.color, inc.color, res_phys.color, res_inc.color) as color,
    COALESCE(inv.total_meters, 0) as instock_meters,
    COALESCE(inc.total_meters, 0) as incoming_meters,
    COALESCE(res_phys.reserved, 0) as physical_reserved_meters,
    COALESCE(res_inc.reserved, 0) as incoming_reserved_meters,
    COALESCE(res_phys.reserved, 0) + COALESCE(res_inc.reserved, 0) as total_reserved_meters,
    COALESCE(inv.total_meters, 0) + COALESCE(inc.total_meters, 0) - COALESCE(res_phys.reserved, 0) - COALESCE(res_inc.reserved, 0) as available_meters
  FROM (
    SELECT quality, color, SUM(meters) as total_meters
    FROM lots
    WHERE status = 'in_stock'
    GROUP BY quality, color
  ) inv
  FULL OUTER JOIN (
    SELECT quality, color, SUM(expected_meters - received_meters) as total_meters
    FROM incoming_stock
    WHERE status IN ('pending_inbound', 'partially_received')
    GROUP BY quality, color
  ) inc USING (quality, color)
  FULL OUTER JOIN (
    SELECT rl.quality, rl.color, SUM(rl.reserved_meters) as reserved
    FROM reservation_lines rl
    JOIN reservations r ON rl.reservation_id = r.id
    WHERE rl.scope = 'INVENTORY' AND r.status = 'active'
    GROUP BY rl.quality, rl.color
  ) res_phys USING (quality, color)
  FULL OUTER JOIN (
    SELECT rl.quality, rl.color, SUM(rl.reserved_meters) as reserved
    FROM reservation_lines rl
    JOIN reservations r ON rl.reservation_id = r.id
    WHERE rl.scope = 'INCOMING' AND r.status = 'active'
    GROUP BY rl.quality, rl.color
  ) res_inc USING (quality, color)
  ORDER BY available_meters DESC;
$$;

-- 2. Get incoming stock summary
CREATE OR REPLACE FUNCTION public.get_incoming_stock_summary()
RETURNS TABLE(
  incoming_stock_id UUID,
  quality TEXT,
  color TEXT,
  expected_meters NUMERIC,
  received_meters NUMERIC,
  reserved_meters NUMERIC,
  open_meters NUMERIC,
  supplier_name TEXT,
  invoice_number TEXT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id as incoming_stock_id,
    i.quality,
    i.color,
    i.expected_meters,
    i.received_meters,
    i.reserved_meters,
    i.expected_meters - i.received_meters as open_meters,
    s.name as supplier_name,
    i.invoice_number,
    i.status
  FROM incoming_stock i
  JOIN suppliers s ON i.supplier_id = s.id
  ORDER BY i.created_at DESC;
$$;

-- 3. Get reservations summary
CREATE OR REPLACE FUNCTION public.get_reservations_summary()
RETURNS TABLE(
  reservation_id UUID,
  reservation_number TEXT,
  customer_name TEXT,
  total_reserved_meters NUMERIC,
  reserved_date DATE,
  status reservation_status,
  created_by_name TEXT,
  lines_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id as reservation_id,
    r.reservation_number,
    r.customer_name,
    COALESCE(SUM(rl.reserved_meters), 0) as total_reserved_meters,
    r.reserved_date,
    r.status,
    p.full_name as created_by_name,
    COUNT(DISTINCT rl.id) as lines_count
  FROM reservations r
  LEFT JOIN reservation_lines rl ON r.id = rl.reservation_id
  LEFT JOIN profiles p ON r.created_by = p.user_id
  GROUP BY r.id, r.reservation_number, r.customer_name, r.reserved_date, r.status, p.full_name
  ORDER BY r.created_at DESC;
$$;

-- 4. Get incoming reserved stock summary
CREATE OR REPLACE FUNCTION public.get_incoming_reserved_stock_summary()
RETURNS TABLE(
  incoming_stock_id UUID,
  quality TEXT,
  color TEXT,
  expected_meters NUMERIC,
  reserved_meters NUMERIC,
  customer_name TEXT,
  reservation_number TEXT,
  supplier_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id as incoming_stock_id,
    i.quality,
    i.color,
    i.expected_meters,
    rl.reserved_meters,
    r.customer_name,
    r.reservation_number,
    s.name as supplier_name
  FROM incoming_stock i
  JOIN reservation_lines rl ON i.id = rl.incoming_stock_id
  JOIN reservations r ON rl.reservation_id = r.id
  JOIN suppliers s ON i.supplier_id = s.id
  WHERE r.status = 'active' AND rl.scope = 'INCOMING'
  ORDER BY i.created_at DESC;
$$;