-- Create an optimized function to get lots by normalized quality
CREATE OR REPLACE FUNCTION public.get_lots_by_normalized_quality(target_normalized_quality text)
RETURNS TABLE(quality text, color text, meters numeric, roll_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    lots.quality,
    lots.color,
    lots.meters,
    lots.roll_count
  FROM lots 
  WHERE lots.status = 'in_stock'
    AND normalize_quality(lots.quality) = target_normalized_quality;
$$;