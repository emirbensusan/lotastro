-- Phase 1A: Populate color_codes from color_labels and add missing mappings
-- Phase 5A: Add new columns to po_draft_lines for intent tracking

-- First, populate color_code from numeric patterns in color_label
UPDATE quality_colors 
SET color_code = (
  CASE 
    -- Extract E### codes (e.g., E123, E224)
    WHEN color_label ~ '^E\d{3,4}' THEN SUBSTRING(color_label FROM '^E\d{3,4}')
    -- Extract numeric codes at start (e.g., 130414, 40046)
    WHEN color_label ~ '^\d{4,6}' THEN SUBSTRING(color_label FROM '^\d{4,6}')
    -- Extract numeric codes after space (e.g., "SPRING GREEN 130414")
    WHEN color_label ~ '\s+\d{4,6}$' THEN SUBSTRING(color_label FROM '\d{4,6}$')
    ELSE NULL
  END
)
WHERE color_code IS NULL;

-- Add missing E### color codes commonly used in orders
INSERT INTO quality_colors (quality_code, color_label, color_code) VALUES
  ('P200', 'E123', 'E123'),
  ('P200', 'E224', 'E224'),
  ('P200', 'E202', 'E202'),
  ('P200', 'E216', 'E216'),
  ('P200', 'E213', 'E213'),
  ('P200', 'E118', 'E118'),
  ('P200', 'E234', 'E234'),
  ('P200', 'E152', 'E152'),
  ('P200', 'E221', 'E221'),
  ('P200', 'E235', 'E235'),
  ('P200', 'E220', 'E220'),
  ('P200', 'E905', 'E905'),
  ('P200', 'E903', 'E903'),
  ('P200', 'E219', 'E219'),
  ('P200', 'E218', 'E218'),
  ('P200', 'E232', 'E232'),
  ('P200', 'E233', 'E233'),
  ('P200', 'E525', 'E525'),
  ('P910', 'E903', 'E903')
ON CONFLICT (quality_code, color_label) DO NOTHING;

-- Add Phase 5A: New columns to po_draft_lines for enhanced extraction
ALTER TABLE po_draft_lines 
ADD COLUMN IF NOT EXISTS intent_type TEXT,
ADD COLUMN IF NOT EXISTS quantity_unit TEXT DEFAULT 'MT',
ADD COLUMN IF NOT EXISTS is_firm_order BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_option_or_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS reference_numbers TEXT,
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS resolution_source TEXT,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS price_value NUMERIC,
ADD COLUMN IF NOT EXISTS price_currency TEXT;

-- Add enum constraint for intent_type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_draft_lines_intent_type_check') THEN
    ALTER TABLE po_draft_lines 
    ADD CONSTRAINT po_draft_lines_intent_type_check 
    CHECK (intent_type IS NULL OR intent_type IN (
      'order', 'sample_request', 'stock_inquiry', 'reservation', 
      'price_request', 'update', 'shipping', 'approval', 'noise'
    ));
  END IF;
END $$;

-- Add enum constraint for quantity_unit
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_draft_lines_quantity_unit_check') THEN
    ALTER TABLE po_draft_lines 
    ADD CONSTRAINT po_draft_lines_quantity_unit_check 
    CHECK (quantity_unit IS NULL OR quantity_unit IN ('MT', 'KG', 'TOP', 'A4', 'PIECE'));
  END IF;
END $$;

-- Add index on intent_type for filtering
CREATE INDEX IF NOT EXISTS idx_po_draft_lines_intent_type ON po_draft_lines(intent_type);

-- Add index on confidence_score for quality monitoring
CREATE INDEX IF NOT EXISTS idx_po_draft_lines_confidence ON po_draft_lines(confidence_score);