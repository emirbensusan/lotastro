-- Drop the existing function first to change its return type
DROP FUNCTION IF EXISTS public.get_inventory_pivot_summary();

-- Create function to normalize quality codes
CREATE OR REPLACE FUNCTION public.normalize_quality(quality_input text)
RETURNS text AS $$
BEGIN
  -- Return empty string if input is null or empty
  IF quality_input IS NULL OR TRIM(quality_input) = '' THEN
    RETURN '';
  END IF;
  
  -- Convert to uppercase first
  quality_input := UPPER(TRIM(quality_input));
  
  -- If quality contains spaces, return as-is (separate quality like "P200 SS")
  IF POSITION(' ' IN quality_input) > 0 THEN
    RETURN quality_input;
  END IF;
  
  -- Handle complex patterns like "P508X/P08.123" → "P508X/P08"
  IF POSITION('/' IN quality_input) > 0 THEN
    -- Split by '/' and normalize each part, then rejoin
    DECLARE
      parts text[];
      normalized_parts text[];
      part text;
    BEGIN
      parts := string_to_array(quality_input, '/');
      
      FOREACH part IN ARRAY parts LOOP
        -- Remove decimal suffix from each part
        IF POSITION('.' IN part) > 0 THEN
          part := SUBSTRING(part FROM 1 FOR POSITION('.' IN part) - 1);
        END IF;
        normalized_parts := array_append(normalized_parts, part);
      END LOOP;
      
      RETURN array_to_string(normalized_parts, '/');
    END;
  END IF;
  
  -- For simple patterns, remove decimal suffix (e.g., "P200.056" → "P200")
  IF POSITION('.' IN quality_input) > 0 THEN
    RETURN SUBSTRING(quality_input FROM 1 FOR POSITION('.' IN quality_input) - 1);
  END IF;
  
  -- Return as-is if no special patterns found
  RETURN quality_input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create the updated inventory pivot summary function with normalized quality
CREATE OR REPLACE FUNCTION public.get_inventory_pivot_summary()
RETURNS TABLE(
  quality text, 
  normalized_quality text,
  color text, 
  total_meters numeric, 
  total_rolls bigint, 
  lot_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    MIN(lots.quality) as quality, -- Use MIN to get one representative quality per group
    public.normalize_quality(lots.quality) as normalized_quality,
    lots.color,
    SUM(lots.meters) as total_meters,
    SUM(lots.roll_count) as total_rolls,
    COUNT(*) as lot_count
  FROM lots 
  WHERE status = 'in_stock'
  GROUP BY public.normalize_quality(lots.quality), lots.color
  ORDER BY SUM(lots.meters) DESC;
$function$