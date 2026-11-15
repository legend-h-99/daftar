-- Compliance gaps (PDPL readiness, 2026-11-15).
--
-- 1. One-time links are stored as SHA-256 digests from now on (edge function). Links created
--    before this migration hold the raw token, which the new code can no longer match, so they
--    are consumed here. Users with a pending link request a new one.
UPDATE public."PasswordReset"     SET consumed = true WHERE consumed = false;
UPDATE public."EmailVerification" SET consumed = true WHERE consumed = false;

-- 2. Deletion requests raised from the app. Recorded for manual review only; nothing is deleted.
--    No foreign key to "User", so the request survives the account it asks to remove.
CREATE TABLE IF NOT EXISTS public."AccountDeletionRequest" (
  id text PRIMARY KEY,
  "userId" text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
  "requestedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "resolvedAt" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccountDeletionRequest_one_pending_idx"
  ON public."AccountDeletionRequest" ("userId") WHERE status = 'PENDING';
ALTER TABLE public."AccountDeletionRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."AccountDeletionRequest" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public."AccountDeletionRequest" TO service_role;

-- 3. The account holder's own profile, included in the data export. Business records keep using
--    export_business_data. Password hashes, token versions and provider identifiers are left out.
CREATE OR REPLACE FUNCTION public.export_user_profile(p_user_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'phone', u.phone,
        'email', u.email,
        'emailVerified', u."emailVerified",
        'signInWithGoogle', u."googleId" IS NOT NULL,
        'createdAt', u."createdAt")
       FROM public."User" u WHERE u.id = p_user_id),
    'null'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.export_user_profile(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_user_profile(text) TO service_role;

-- 4. Retention for the helper tables. Each delete keeps only rows that can still matter:
--    links for 7 days after they expire, rate-limit windows for a day, and revoked tokens until the
--    token itself has expired (an expired token is rejected by its own `exp` claim anyway).
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'daftar-retention-auth-helpers') then
    perform cron.unschedule('daftar-retention-auth-helpers');
  end if;
end $$;

select cron.schedule(
  'daftar-retention-auth-helpers',
  '30 3 * * *',
  $job$
    DELETE FROM public."PasswordReset"     WHERE "expiresAt" < now() - interval '7 days';
    DELETE FROM public."EmailVerification" WHERE "expiresAt" < now() - interval '7 days';
    DELETE FROM public."AuthRateLimit"     WHERE "windowStart" < now() - interval '1 day';
    DELETE FROM public."TokenBlacklist"    WHERE "expiresAt" < now();
  $job$
);
