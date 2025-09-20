-- Create field_edit_queue table for pending field edits
CREATE TABLE public.field_edit_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.field_edit_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for field_edit_queue
CREATE POLICY "All authenticated users can view field_edit_queue" 
ON public.field_edit_queue 
FOR SELECT 
USING (true);

CREATE POLICY "All authenticated users can create field_edit_queue entries" 
ON public.field_edit_queue 
FOR INSERT 
WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Senior managers and admins can update field_edit_queue" 
ON public.field_edit_queue 
FOR UPDATE 
USING (has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Senior managers and admins can delete field_edit_queue" 
ON public.field_edit_queue 
FOR DELETE 
USING (has_role(auth.uid(), 'senior_manager'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_field_edit_queue_updated_at
BEFORE UPDATE ON public.field_edit_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();