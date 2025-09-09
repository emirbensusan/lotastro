-- Create a table for individual rolls
CREATE TABLE public.rolls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  meters NUMERIC NOT NULL CHECK (meters > 0),
  position INTEGER NOT NULL CHECK (position > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.rolls ENABLE ROW LEVEL SECURITY;

-- Create policies for rolls table
CREATE POLICY "All authenticated users can view rolls" 
ON public.rolls 
FOR SELECT 
USING (true);

CREATE POLICY "Warehouse staff, senior managers and admins can create rolls" 
ON public.rolls 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'warehouse_staff'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Accounting, senior managers and admins can update rolls" 
ON public.rolls 
FOR UPDATE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can delete rolls" 
ON public.rolls 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_rolls_updated_at
BEFORE UPDATE ON public.rolls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_rolls_lot_id ON public.rolls(lot_id);
CREATE INDEX idx_rolls_position ON public.rolls(lot_id, position);