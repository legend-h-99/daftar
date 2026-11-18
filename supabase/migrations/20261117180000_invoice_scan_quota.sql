-- Monthly quota for supplier-invoice scans, per business.
-- Reservations are atomic so concurrent scans cannot exceed the limit, and a
-- reservation is released when the vision provider fails, so a failed read
-- does not cost the owner a page.
BEGIN;

CREATE TABLE IF NOT EXISTS public."InvoiceScanUsage" (
  "businessId" text NOT NULL REFERENCES public."Business"(id) ON DELETE CASCADE,
  "period" text NOT NULL CHECK ("period" ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  "used" integer NOT NULL DEFAULT 0 CHECK ("used" >= 0),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("businessId", "period")
);

ALTER TABLE public."InvoiceScanUsage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."InvoiceScanUsage" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public."InvoiceScanUsage" TO service_role;

-- Returns the pages left after this reservation, or NULL when the quota is used up.
CREATE OR REPLACE FUNCTION public.reserve_invoice_scan(
  p_business_id text,
  p_period text,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  reserved_count integer;
BEGIN
  IF p_business_id IS NULL OR p_period !~ '^\d{4}-(0[1-9]|1[0-2])$'
    OR p_limit < 1 OR p_limit > 1000 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public."InvoiceScanUsage" ("businessId", "period", "used")
  VALUES (p_business_id, p_period, 1)
  ON CONFLICT ("businessId", "period") DO UPDATE
    SET "used" = public."InvoiceScanUsage"."used" + 1,
        "updatedAt" = now()
    WHERE public."InvoiceScanUsage"."used" < p_limit
  RETURNING "used" INTO reserved_count;

  IF reserved_count IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_limit - reserved_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_invoice_scan(
  p_business_id text,
  p_period text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public."InvoiceScanUsage"
     SET "used" = "used" - 1, "updatedAt" = now()
   WHERE "businessId" = p_business_id AND "period" = p_period AND "used" > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_invoice_scan(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_invoice_scan(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_invoice_scan(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_invoice_scan(text, text) TO service_role;

COMMIT;
