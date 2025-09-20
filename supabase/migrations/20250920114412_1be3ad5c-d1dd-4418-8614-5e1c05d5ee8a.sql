-- Update the normalize_quality function to preserve SS values
CREATE OR REPLACE FUNCTION public.normalize_quality(quality_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Handle complex patterns like "P508X/P08.123" or "P508X/P08.SS123"
  IF POSITION('/' IN quality_input) > 0 THEN
    -- Split by '/' and normalize each part, then rejoin
    DECLARE
      parts text[];
      normalized_parts text[];
      part text;
    BEGIN
      parts := string_to_array(quality_input, '/');
      
      FOREACH part IN ARRAY parts LOOP
        -- Check if part contains SS after decimal - if so, preserve it
        IF POSITION('.' IN part) > 0 AND POSITION('SS' IN SUBSTRING(part FROM POSITION('.' IN part))) > 0 THEN
          -- Preserve the full part if it contains SS after decimal
          normalized_parts := array_append(normalized_parts, part);
        ELSIF POSITION('.' IN part) > 0 THEN
          -- Remove decimal suffix from parts that don't contain SS
          part := SUBSTRING(part FROM 1 FOR POSITION('.' IN part) - 1);
          normalized_parts := array_append(normalized_parts, part);
        ELSE
          -- No decimal, keep as-is
          normalized_parts := array_append(normalized_parts, part);
        END IF;
      END LOOP;
      
      RETURN array_to_string(normalized_parts, '/');
    END;
  END IF;
  
  -- For simple patterns, check if decimal part contains SS
  IF POSITION('.' IN quality_input) > 0 THEN
    -- Check if the part after decimal contains SS
    IF POSITION('SS' IN SUBSTRING(quality_input FROM POSITION('.' IN quality_input))) > 0 THEN
      -- Preserve the full quality if it contains SS after decimal
      RETURN quality_input;
    ELSE
      -- Remove decimal suffix if it doesn't contain SS (e.g., "P200.056" → "P200")
      RETURN SUBSTRING(quality_input FROM 1 FOR POSITION('.' IN quality_input) - 1);
    END IF;
  END IF;
  
  -- Return as-is if no special patterns found
  RETURN quality_input;
END;
$$;