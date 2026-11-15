-- Accept the two segmented SMS keys used by the deployed API.
-- Keep quotas atomic and access restricted to service_role.
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
  IF (p_key !~ '^[a-z][a-z0-9_-]{0,63}$' AND p_key NOT IN ('sms:new', 'sms:returning'))
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
