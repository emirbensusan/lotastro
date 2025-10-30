-- PHASE 1A: Fix Database Foundation for AI Order Extraction

-- Step 1: Populate color_code from color_label where it's NULL
UPDATE quality_colors
SET color_code = 
  CASE
    -- Pure alphanumeric codes like E123, E224, etc.
    WHEN color_label ~ '^[A-Z]+\d{2,4}$' THEN color_label
    -- Pure numeric codes like 130414, 40046
    WHEN color_label ~ '^\d{3,6}$' THEN color_label
    -- Extract numeric code from end of label (e.g., "SPRING GREEN 130414" → "130414")
    WHEN color_label ~ '\s(\d{3,6})$' THEN (regexp_match(color_label, '\s(\d{3,6})$'))[1]
    -- Extract alphanumeric code from label (e.g., "E123 CREAM" → "E123")
    WHEN color_label ~ '^([A-Z]+\d{2,4})\s' THEN (regexp_match(color_label, '^([A-Z]+\d{2,4})\s'))[1]
    ELSE NULL
  END
WHERE color_code IS NULL;

-- Step 2: Add index on color_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_quality_colors_color_code ON quality_colors(color_code);

-- Step 3: Log the update results
DO $$
DECLARE
  updated_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM quality_colors WHERE color_code IS NOT NULL;
  SELECT COUNT(*) INTO null_count FROM quality_colors WHERE color_code IS NULL;
  
  RAISE NOTICE 'Color code population complete: % rows with codes, % still NULL', updated_count, null_count;
END $$;