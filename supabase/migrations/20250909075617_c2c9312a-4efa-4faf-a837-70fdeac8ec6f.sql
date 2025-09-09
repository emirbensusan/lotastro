-- Create function to get inventory statistics summary
CREATE OR REPLACE FUNCTION public.get_inventory_stats_summary()
 RETURNS TABLE(total_lots bigint, total_rolls bigint, total_meters numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT 
    COUNT(*) as total_lots,
    SUM(roll_count) as total_rolls,
    SUM(meters) as total_meters
  FROM lots 
  WHERE status = 'in_stock';
$function$