-- Session 1.1 Security Fix: Revoke overly permissive table privileges
-- Addresses: anon role has full access, which bypasses defense-in-depth

-- Revoke ALL privileges from anon (they should have zero access)
REVOKE ALL PRIVILEGES ON TABLE public.integration_inbox FROM anon;

-- Revoke write privileges from authenticated (keep SELECT for admin RLS policy)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER 
ON TABLE public.integration_inbox 
FROM authenticated;

-- Verify RLS remains enabled (defensive check)
ALTER TABLE public.integration_inbox ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.integration_inbox FORCE ROW LEVEL SECURITY;