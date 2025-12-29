-- Add RLS policies to login_attempts table
-- This table is used for rate limiting and should only be accessible via security definer functions

-- Policy: Allow the check_login_rate_limit and record_login_attempt functions to access this table
-- These functions use SECURITY DEFINER so they bypass RLS when called
-- Direct access should be restricted

-- Allow authenticated admins to view login attempts for monitoring
CREATE POLICY "Admins can view login attempts"
ON public.login_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

-- Allow service role (edge functions) full access via security definer functions
-- The record_login_attempt function already uses SECURITY DEFINER
-- Direct inserts/updates/deletes from client should be blocked

-- No INSERT policy for regular users - insertions happen via security definer function
-- No UPDATE policy - records are immutable
-- No DELETE policy for regular users - cleanup happens via security definer function

-- Allow cleanup function to delete old records (already uses SECURITY DEFINER)
-- This is handled by the record_login_attempt function which deletes old records