-- Migration 2: Reservations Tables

-- 1. Generate reservation number function
CREATE OR REPLACE FUNCTION public.generate_reservation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res_num TEXT;
  counter INTEGER := 1;
  base_num TEXT;
BEGIN
  base_num := 'RES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  LOOP
    res_num := base_num || LPAD(counter::TEXT, 3, '0');
    
    IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE reservation_number = res_num) THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
  END LOOP;
  
  RETURN res_num;
END;
$$;

-- 2. Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT UNIQUE NOT NULL DEFAULT generate_reservation_number(),
  customer_name TEXT NOT NULL,
  customer_id TEXT,
  status reservation_status NOT NULL DEFAULT 'active',
  reserved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hold_until DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at TIMESTAMPTZ,
  canceled_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  cancel_reason cancel_reason_type,
  cancel_other_text TEXT,
  converted_at TIMESTAMPTZ,
  converted_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  convert_reason convert_reason_type
);

CREATE INDEX idx_reservations_customer ON public.reservations(customer_name);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservations_date ON public.reservations(reserved_date);

-- 3. Create reservation_lines table
CREATE TABLE public.reservation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('INCOMING', 'INVENTORY')),
  incoming_stock_id UUID REFERENCES public.incoming_stock(id) ON DELETE RESTRICT,
  lot_id UUID REFERENCES public.lots(id) ON DELETE RESTRICT,
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  reserved_meters NUMERIC(10,2) NOT NULL CHECK (reserved_meters > 0),
  roll_ids TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'INCOMING' AND incoming_stock_id IS NOT NULL AND lot_id IS NULL) OR
    (scope = 'INVENTORY' AND lot_id IS NOT NULL AND incoming_stock_id IS NULL)
  )
);

CREATE INDEX idx_reservation_lines_reservation ON public.reservation_lines(reservation_id);
CREATE INDEX idx_reservation_lines_incoming ON public.reservation_lines(incoming_stock_id);
CREATE INDEX idx_reservation_lines_lot ON public.reservation_lines(lot_id);
CREATE INDEX idx_reservation_lines_quality_color ON public.reservation_lines(quality, color);

-- 4. Modify lots table - add reserved_meters
ALTER TABLE public.lots ADD COLUMN reserved_meters NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 5. Enable RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_lines ENABLE ROW LEVEL SECURITY;

-- 6. Create update trigger
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();