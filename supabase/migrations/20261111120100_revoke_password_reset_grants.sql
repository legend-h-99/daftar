-- PasswordReset was the only auth table missing from the anon/authenticated revoke. RLS already denies
-- client access, so this is defense in depth. Idempotent: safe to re-run.
REVOKE ALL ON TABLE public."PasswordReset" FROM anon, authenticated;
