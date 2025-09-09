-- Create a function to get inventory pivot data with proper aggregation
CREATE OR REPLACE FUNCTION public.get_inventory_pivot_summary()
RETURNS TABLE (
  quality text,
  color text,
  total_meters numeric,
  total_rolls bigint,
  lot_count bigint
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    quality,
    color,
    SUM(meters) as total_meters,
    SUM(roll_count) as total_rolls,
    COUNT(*) as lot_count
  FROM lots 
  WHERE status = 'in_stock'
  GROUP BY quality, color
  ORDER BY SUM(meters) DESC;
$$;