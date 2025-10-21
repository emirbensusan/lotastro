-- Fix: Restrict user_invitations SELECT policy to authenticated users only
-- This prevents unauthenticated users from having any policy applied to them,
-- eliminating unnecessary attack surface while maintaining functionality

DROP POLICY IF EXISTS "Users can view own invitation or admins can view all" ON user_invitations;

CREATE POLICY "Authenticated users can view own invitation or admins view all"
ON user_invitations
FOR SELECT
TO authenticated  -- Explicitly restrict to authenticated users only
USING (
  (auth.jwt()->>'email') = email OR has_role(auth.uid(), 'admin'::user_role)
);