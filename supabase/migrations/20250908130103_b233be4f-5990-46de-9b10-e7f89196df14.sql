-- Create order queue table for pending approvals
CREATE TABLE public.order_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS on order queue
ALTER TABLE public.order_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for order queue
CREATE POLICY "All authenticated users can view order_queue" 
ON public.order_queue 
FOR SELECT 
USING (true);

CREATE POLICY "Accounting, senior managers and admins can create order_queue entries" 
ON public.order_queue 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Accounting, senior managers and admins can update order_queue" 
ON public.order_queue 
FOR UPDATE 
USING (has_role(auth.uid(), 'accounting'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Only admins can delete order_queue entries" 
ON public.order_queue 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_order_queue_updated_at
BEFORE UPDATE ON public.order_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();