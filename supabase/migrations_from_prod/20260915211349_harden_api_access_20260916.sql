-- Application data is accessed only by the trusted Edge Function's service role.
-- RLS remains enabled for defense in depth; direct browser roles have no table grants.
REVOKE ALL ON TABLE
  public."Business", public."User", public."OtpCode", public."Material",
  public."Product", public."RecipeItem", public."Customer", public."Invoice",
  public."InvoiceItem", public."Expense", public."Supplier", public."Purchase",
  public."PurchaseItem", public."StockMovement", public."TokenBlacklist",
  public."EmailVerification"
FROM anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Existing User policies let any member change another member's credential fields.
DROP POLICY IF EXISTS "User_delete_same_business" ON public."User";
DROP POLICY IF EXISTS "User_insert_self_same_business" ON public."User";
DROP POLICY IF EXISTS "User_update_same_business" ON public."User";
DROP POLICY IF EXISTS "User_select_same_business" ON public."User";
CREATE POLICY "User_select_self" ON public."User"
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid())::text);

-- Limit future SQL-created objects in the exposed schema, too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Rate limits are atomic across Edge Function instances and contain SHA-256 keys,
-- not raw email addresses or IP addresses.
CREATE TABLE IF NOT EXISTS public."AuthRateLimit" (
  "key" text PRIMARY KEY,
  "windowStart" timestamptz NOT NULL,
  "count" integer NOT NULL
);
ALTER TABLE public."AuthRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AuthRateLimit" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_auth_rate_limit(
  p_key text, p_limit integer, p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
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
