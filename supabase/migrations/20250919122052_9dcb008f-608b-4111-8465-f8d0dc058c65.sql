-- Add columns to store individual roll data in order_lots table
ALTER TABLE public.order_lots 
ADD COLUMN selected_roll_meters TEXT,
ADD COLUMN selected_roll_ids TEXT;