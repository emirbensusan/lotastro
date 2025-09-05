-- Add invoice information fields to lots table
ALTER TABLE public.lots 
ADD COLUMN invoice_number TEXT,
ADD COLUMN invoice_date DATE;