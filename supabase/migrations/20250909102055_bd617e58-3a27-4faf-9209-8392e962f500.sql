-- Fix potential order number generation ambiguity
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  order_num TEXT;
  counter INTEGER := 1;
  base_num TEXT;
BEGIN
  -- Generate base order number with current date
  base_num := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  -- Find next available number for today
  LOOP
    order_num := base_num || LPAD(counter::TEXT, 3, '0');
    
    -- Check if this order number already exists
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = order_num) THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
  END LOOP;
  
  RETURN order_num;
END;
$$ LANGUAGE plpgsql VOLATILE;