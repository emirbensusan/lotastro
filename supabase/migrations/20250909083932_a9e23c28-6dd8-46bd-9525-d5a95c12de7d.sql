-- Add missing fields to lots table for production_date, warehouse_location, and notes
ALTER TABLE lots 
ADD COLUMN production_date date,
ADD COLUMN warehouse_location text,
ADD COLUMN notes text;