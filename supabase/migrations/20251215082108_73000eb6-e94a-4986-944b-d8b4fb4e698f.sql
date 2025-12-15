-- Create OCR job queue table for async processing
CREATE TABLE public.ocr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id UUID REFERENCES public.count_rolls(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  ocr_result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_ocr_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create indexes for efficient job queue processing
CREATE INDEX idx_ocr_jobs_status ON public.ocr_jobs(status);
CREATE INDEX idx_ocr_jobs_pending ON public.ocr_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_ocr_jobs_roll_id ON public.ocr_jobs(roll_id);

-- Enable RLS
ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for ocr_jobs
CREATE POLICY "Users can view OCR jobs for their own sessions"
ON public.ocr_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.count_rolls cr
    JOIN public.count_sessions cs ON cr.session_id = cs.id
    WHERE cr.id = ocr_jobs.roll_id AND cs.started_by = auth.uid()
  )
);

CREATE POLICY "Admins and senior managers can view all OCR jobs"
ON public.ocr_jobs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'senior_manager'::user_role));

CREATE POLICY "Users can insert OCR jobs for their own rolls"
ON public.ocr_jobs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.count_rolls cr
    JOIN public.count_sessions cs ON cr.session_id = cs.id
    WHERE cr.id = ocr_jobs.roll_id AND cs.started_by = auth.uid()
  )
);

CREATE POLICY "System can update OCR jobs"
ON public.ocr_jobs
FOR UPDATE
USING (true);

-- Add ocr_status column to count_rolls to track async OCR state
ALTER TABLE public.count_rolls 
ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'pending'
CONSTRAINT valid_ocr_status CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

-- Create index for OCR status queries
CREATE INDEX idx_count_rolls_ocr_status ON public.count_rolls(ocr_status);