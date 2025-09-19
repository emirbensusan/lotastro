-- Remove unique constraint on lot_number to allow duplicate lot numbers
ALTER TABLE public.lots DROP CONSTRAINT lots_lot_number_key;