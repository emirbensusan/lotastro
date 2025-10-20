-- Migration 1: Enums & Core Tables

-- 1. Create enums
CREATE TYPE reservation_status AS ENUM ('active', 'released', 'converted', 'canceled');
CREATE TYPE cancel_reason_type AS ENUM ('no_payment', 'customer_canceled', 'incorrect_entry', 'other');
CREATE TYPE convert_reason_type AS ENUM ('payment_confirmation', 'manager_confirmation');

-- 2. Create incoming_stock table
CREATE TABLE public.incoming_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  expected_meters NUMERIC(10,2) NOT NULL CHECK (expected_meters > 0),
  received_meters NUMERIC(10,2) NOT NULL DEFAULT 0,
  reserved_meters NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT,
  invoice_date DATE,
  expected_arrival_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_inbound' CHECK (status IN ('pending_inbound', 'partially_received', 'fully_received')),
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incoming_stock_supplier ON public.incoming_stock(supplier_id);
CREATE INDEX idx_incoming_stock_quality ON public.incoming_stock(quality);
CREATE INDEX idx_incoming_stock_color ON public.incoming_stock(color);
CREATE INDEX idx_incoming_stock_status ON public.incoming_stock(status);

-- 3. Create goods_in_receipts table
CREATE TABLE public.goods_in_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_stock_id UUID REFERENCES public.incoming_stock(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  defect_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goods_in_receipts_incoming ON public.goods_in_receipts(incoming_stock_id);
CREATE INDEX idx_goods_in_receipts_received_at ON public.goods_in_receipts(received_at);

-- 4. Create goods_in_rows table
CREATE TABLE public.goods_in_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.goods_in_receipts(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE RESTRICT,
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  meters NUMERIC(10,2) NOT NULL CHECK (meters > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goods_in_rows_receipt ON public.goods_in_rows(receipt_id);
CREATE INDEX idx_goods_in_rows_lot ON public.goods_in_rows(lot_id);

-- 5. Enable RLS
ALTER TABLE public.incoming_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_in_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_in_rows ENABLE ROW LEVEL SECURITY;

-- 6. Create update trigger
CREATE TRIGGER update_incoming_stock_updated_at
  BEFORE UPDATE ON public.incoming_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();