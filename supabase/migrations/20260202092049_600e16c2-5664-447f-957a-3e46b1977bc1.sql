-- Session 1.1: Integration Inbox Table + RLS
-- Purpose: Create inbound event logging table for CRM→WMS webhook events

-- Create status enum for integration inbox
CREATE TYPE public.integration_inbox_status AS ENUM (
  'pending',      -- Received, awaiting processing
  'processing',   -- Currently being processed
  'processed',    -- Successfully processed
  'failed',       -- Processing failed (can be retried)
  'rejected',     -- Validation failed (will not be retried)
  'skipped'       -- Duplicate or out-of-order (idempotency)
);

-- Create the integration_inbox table
CREATE TABLE public.integration_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_system TEXT NOT NULL CHECK (source_system IN ('crm', 'wms')),
  
  -- Payload storage
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,  -- SHA-256 hash for drift detection
  
  -- Processing status
  status public.integration_inbox_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  error_code TEXT,
  
  -- Audit fields
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- HMAC verification tracking
  hmac_verified BOOLEAN NOT NULL DEFAULT false,
  received_signature TEXT,
  received_timestamp BIGINT,
  
  -- Contract validation tracking
  schema_valid BOOLEAN,
  validation_errors JSONB
);

-- Add unique constraint on idempotency_key for duplicate detection
ALTER TABLE public.integration_inbox 
ADD CONSTRAINT integration_inbox_idempotency_key_unique UNIQUE (idempotency_key);

-- Create indexes for common query patterns
CREATE INDEX idx_integration_inbox_status ON public.integration_inbox (status);
CREATE INDEX idx_integration_inbox_event_type ON public.integration_inbox (event_type);
CREATE INDEX idx_integration_inbox_received_at ON public.integration_inbox (received_at DESC);
CREATE INDEX idx_integration_inbox_retry ON public.integration_inbox (next_retry_at) 
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_integration_inbox_source ON public.integration_inbox (source_system);

-- Composite index for processing queries
CREATE INDEX idx_integration_inbox_status_retry ON public.integration_inbox (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

-- Enable RLS
ALTER TABLE public.integration_inbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Admin can read all rows
CREATE POLICY "Admins can read integration_inbox"
ON public.integration_inbox
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

-- 2. No authenticated users can INSERT/UPDATE/DELETE directly
-- Service role (edge functions) will bypass RLS
-- This is intentional - only edge functions should write to this table

-- Revoke all direct access from authenticated users
REVOKE ALL ON public.integration_inbox FROM authenticated;

-- Grant only SELECT to authenticated (RLS will filter)
GRANT SELECT ON public.integration_inbox TO authenticated;

-- Add updated_at trigger
CREATE TRIGGER update_integration_inbox_updated_at
  BEFORE UPDATE ON public.integration_inbox
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.integration_inbox IS 
'Inbound event queue for CRM→WMS integration webhooks. 
Only service role can write; authenticated users can only read if admin.
Session 1.1 of WMS Implementation Plan v1.0.23';

COMMENT ON COLUMN public.integration_inbox.idempotency_key IS 
'5-segment key format: <source>:<entity>:<entity_id>:<action>:v1';

COMMENT ON COLUMN public.integration_inbox.payload_hash IS 
'SHA-256 hash of payload for drift detection on retries';

COMMENT ON COLUMN public.integration_inbox.hmac_verified IS 
'True if X-WMS-Signature header validated successfully';

COMMENT ON COLUMN public.integration_inbox.schema_valid IS 
'True if payload passed contract schema validation';