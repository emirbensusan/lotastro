-- Create transaction_type enum
CREATE TYPE public.inventory_transaction_type AS ENUM (
  'INCOMING_RECEIPT',
  'ORDER_FULFILLMENT',
  'STOCK_ADJUSTMENT',
  'MANUAL_CORRECTION',
  'RESERVATION_ALLOCATION',
  'RESERVATION_RELEASE',
  'TRANSFER_OUT',
  'TRANSFER_IN'
);

-- Create inventory_transactions table (append-only ledger)
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  roll_id UUID REFERENCES public.rolls(id),
  transaction_type public.inventory_transaction_type NOT NULL,
  quantity_change NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'meters',
  source_type TEXT NOT NULL,
  source_id UUID,
  source_identifier TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add comments for documentation
COMMENT ON TABLE public.inventory_transactions IS 'Append-only ledger tracking all inventory movements';
COMMENT ON COLUMN public.inventory_transactions.quantity_change IS 'Positive for additions, negative for deductions';
COMMENT ON COLUMN public.inventory_transactions.source_type IS 'Entity type that triggered this transaction (order, incoming_stock, adjustment, etc.)';
COMMENT ON COLUMN public.inventory_transactions.source_id IS 'UUID of the source entity';
COMMENT ON COLUMN public.inventory_transactions.source_identifier IS 'Human-readable identifier (order number, lot number, etc.)';

-- Create indexes for common queries
CREATE INDEX idx_inventory_transactions_roll_id ON public.inventory_transactions(roll_id);
CREATE INDEX idx_inventory_transactions_created_at ON public.inventory_transactions(created_at DESC);
CREATE INDEX idx_inventory_transactions_type ON public.inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_source ON public.inventory_transactions(source_type, source_id);

-- Enable RLS
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read
CREATE POLICY "Authenticated users can view inventory transactions"
ON public.inventory_transactions
FOR SELECT
TO authenticated
USING (true);

-- Only specific roles can insert (will be enforced at app level too)
CREATE POLICY "Authenticated users can insert inventory transactions"
ON public.inventory_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);