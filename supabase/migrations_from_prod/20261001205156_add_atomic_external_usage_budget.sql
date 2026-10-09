-- A server-only daily quota for paid external calls (currently email delivery).
-- Counters are reserved atomically so concurrent requests cannot exceed a cap.
CREATE TABLE IF NOT EXISTS public."ExternalUsageBudget" (
  "key" text NOT NULL,
  "usageDate" date NOT NULL,
  "used" integer NOT NULL DEFAULT 0 CHECK ("used" >= 0),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("key", "usageDate")
);

ALTER TABLE public."ExternalUsageBudget" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ExternalUsageBudget" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public."ExternalUsageBudget" TO service_role;

CREATE OR REPLACE FUNCTION public.consume_external_usage_budget(
  p_key text,
  p_daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  reserved_count integer;
BEGIN
  IF p_key !~ '^[a-z][a-z0-9_-]{0,63}$'
    OR p_daily_limit < 1 OR p_daily_limit > 10000 THEN
    RETURN false;
  END IF;

  INSERT INTO public."ExternalUsageBudget" ("key", "usageDate", "used")
  VALUES (p_key, current_date, 1)
  ON CONFLICT ("key", "usageDate") DO UPDATE
    SET "used" = public."ExternalUsageBudget"."used" + 1,
        "updatedAt" = now()
    WHERE public."ExternalUsageBudget"."used" < p_daily_limit
  RETURNING "used" INTO reserved_count;

  RETURN reserved_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_external_usage_budget(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_external_usage_budget(text, integer)
  TO service_role;
