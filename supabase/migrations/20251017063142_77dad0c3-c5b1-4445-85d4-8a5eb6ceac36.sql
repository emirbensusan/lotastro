-- Add status tracking to rolls table
ALTER TABLE rolls 
ADD COLUMN status text NOT NULL DEFAULT 'available';

-- Add comment for documentation
COMMENT ON COLUMN rolls.status IS 'Roll status: available, allocated (in order preparation), or fulfilled';

-- Create indexes for performance
CREATE INDEX idx_rolls_status ON rolls(status);
CREATE INDEX idx_rolls_lot_status ON rolls(lot_id, status);

-- Add check constraint for valid statuses
ALTER TABLE rolls 
ADD CONSTRAINT rolls_status_check 
CHECK (status IN ('available', 'allocated', 'fulfilled'));

-- Update existing rolls to correct status based on current orders
-- Mark rolls that are in fulfilled orders as 'fulfilled'
UPDATE rolls 
SET status = 'fulfilled'
WHERE id IN (
  SELECT UNNEST(string_to_array(ol.selected_roll_ids, ','))::uuid
  FROM order_lots ol
  INNER JOIN orders o ON o.id = ol.order_id
  WHERE o.fulfilled_at IS NOT NULL
  AND ol.selected_roll_ids IS NOT NULL
);

-- Mark rolls that are in pending orders as 'allocated'
UPDATE rolls 
SET status = 'allocated'
WHERE id IN (
  SELECT UNNEST(string_to_array(ol.selected_roll_ids, ','))::uuid
  FROM order_lots ol
  INNER JOIN orders o ON o.id = ol.order_id
  WHERE o.fulfilled_at IS NULL
  AND ol.selected_roll_ids IS NOT NULL
);

-- Create helper functions for roll availability
CREATE OR REPLACE FUNCTION get_available_rolls_count(p_lot_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM rolls
  WHERE lot_id = p_lot_id
    AND status = 'available';
$$;

CREATE OR REPLACE FUNCTION get_available_rolls_meters(p_lot_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(meters), 0)
  FROM rolls
  WHERE lot_id = p_lot_id
    AND status = 'available';
$$;

-- Update inventory pivot summary to use actual available rolls
CREATE OR REPLACE FUNCTION public.get_inventory_pivot_summary()
RETURNS TABLE(quality text, normalized_quality text, color text, total_meters numeric, total_rolls bigint, lot_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  ORDER BY total_meters DESC;
$function$;