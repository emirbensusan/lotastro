-- Fix the security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_prefix TEXT;
    sequence_num INTEGER;
    order_number TEXT;
    counter INTEGER DEFAULT 1;
BEGIN
    -- Generate today's prefix (YYYYMMDD)
    today_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Loop to find next available sequence number
    LOOP  
        -- Format sequence number with leading zeros (3 digits)
        sequence_num := counter;
        order_number := today_prefix || LPAD(sequence_num::TEXT, 3, '0');
        
        -- Check if this order number already exists
        IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = order_number) THEN
            RETURN order_number;
        END IF;
        
        counter := counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 999 THEN
            RAISE EXCEPTION 'Cannot generate unique order number for today - too many orders';
        END IF;
    END LOOP;
END;
$$;