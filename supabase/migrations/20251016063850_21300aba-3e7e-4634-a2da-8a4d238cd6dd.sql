-- Phase 0A: Enhance user_invitations table for better tracking
ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_error text,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS invite_link text;

-- Add unique constraint on token (prevent duplicate tokens)
CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_token_key ON public.user_invitations(token);

-- Add index on email for faster lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS user_invitations_email_lower_idx ON public.user_invitations(LOWER(email));

-- Ensure profiles.email has unique constraint (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key ON public.profiles(LOWER(email));

-- Add deleted_at for soft deletion tracking (optional, keeps audit trail)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;