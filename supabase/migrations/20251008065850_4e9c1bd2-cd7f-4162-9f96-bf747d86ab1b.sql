-- Allow authenticated users to update their own invitation status
CREATE POLICY "Users can update their own invitation status"
ON user_invitations
FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'email' = email)
WITH CHECK (auth.jwt() ->> 'email' = email);