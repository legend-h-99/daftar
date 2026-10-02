-- The browser talks only to the API Edge Function. That function uses the
-- server-only service_role key and enforces the application's signed JWT and
-- business scope. Enable RLS so anon/authenticated clients cannot access
-- application tables directly if the public Supabase URL/key are discovered.
-- service_role intentionally retains access for the API and trusted migrations.
-- Keep this migration self-contained for preview branches created from hosted
-- history before newer Prisma-only auth migrations were recorded there.
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passwordHash" text;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON public."User" ("email");

CREATE TABLE IF NOT EXISTS public."EmailVerification" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expiresAt" timestamp(3) NOT NULL,
  "consumed" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EmailVerification_token_consumed_expiresAt_idx"
  ON public."EmailVerification" ("token", "consumed", "expiresAt");
CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx"
  ON public."EmailVerification" ("userId");

CREATE TABLE IF NOT EXISTS public."PasswordReset" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expiresAt" timestamp(3) NOT NULL,
  "consumed" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PasswordReset_token_consumed_expiresAt_idx"
  ON public."PasswordReset" ("token", "consumed", "expiresAt");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx"
  ON public."PasswordReset" ("userId");

CREATE TABLE IF NOT EXISTS public."AuthRateLimit" (
  "key" text PRIMARY KEY,
  "windowStart" timestamptz NOT NULL,
  "count" integer NOT NULL
);
ALTER TABLE public."AuthRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."AuthRateLimit" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public."AuthRateLimit" TO service_role;

CREATE OR REPLACE FUNCTION public.consume_auth_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  current_count integer;
BEGIN
  IF p_key !~ '^[a-f0-9]{64}$' OR p_limit < 1 OR p_limit > 100
    OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RETURN false;
  END IF;

  INSERT INTO public."AuthRateLimit" ("key", "windowStart", "count")
  VALUES (p_key, now(), 1)
  ON CONFLICT ("key") DO UPDATE SET
    "windowStart" = CASE
      WHEN public."AuthRateLimit"."windowStart" <= now() - make_interval(secs => p_window_seconds)
        THEN now()
      ELSE public."AuthRateLimit"."windowStart"
    END,
    "count" = CASE
      WHEN public."AuthRateLimit"."windowStart" <= now() - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE public."AuthRateLimit"."count" + 1
    END
  RETURNING "count" INTO current_count;

  RETURN current_count <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_auth_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_rate_limit(text, integer, integer)
  TO service_role;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Business',
    'User',
    'EmailVerification',
    'PasswordReset',
    'OtpCode',
    'Material',
    'Supplier',
    'Purchase',
    'PurchaseItem',
    'StockMovement',
    'Product',
    'RecipeItem',
    'Customer',
    'Invoice',
    'InvoiceItem',
    'Expense',
    'TokenBlacklist',
    'AuthRateLimit'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;
