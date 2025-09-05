-- Create lot_queue table for pending lots awaiting completion
CREATE TABLE public.lot_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_number TEXT NOT NULL,
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  meters NUMERIC NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_location TEXT NOT NULL,
  qr_code_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_completion',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.lot_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for lot_queue
CREATE POLICY "All authenticated users can view lot_queue" 
ON public.lot_queue 
FOR SELECT 
USING (true);

CREATE POLICY "Warehouse staff can create lot_queue entries" 
ON public.lot_queue 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'warehouse_staff'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Accounting and admins can update lot_queue" 
ON public.lot_queue 
FOR UPDATE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Accounting and admins can delete lot_queue" 
ON public.lot_queue 
FOR DELETE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lot_queue_updated_at
BEFORE UPDATE ON public.lot_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();