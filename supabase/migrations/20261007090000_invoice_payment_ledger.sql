-- Apply before PAYMENT_LEDGER_ENABLED=true. Legacy balances deliberately have
-- no collection date: assigning invoice dates would fabricate cash history.
BEGIN;
LOCK TABLE public."Invoice" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public."InvoicePayment" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" text NOT NULL REFERENCES public."Business"(id) ON DELETE RESTRICT,
  "invoiceId" text NOT NULL REFERENCES public."Invoice"(id) ON DELETE RESTRICT,
  amount double precision NOT NULL CHECK (amount <> 0 AND amount > '-Infinity'::float8 AND amount < 'Infinity'::float8),
  "occurredAt" timestamptz,
  "recordedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL CHECK (source IN ('LEGACY_UNDATED', 'PAYMENT', 'REVERSAL'))
);
CREATE INDEX "InvoicePayment_business_date_idx" ON public."InvoicePayment" ("businessId", "occurredAt");
ALTER TABLE public."InvoicePayment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."InvoicePayment" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public."InvoicePayment" TO service_role;
INSERT INTO public."InvoicePayment" ("businessId", "invoiceId", amount, source)
SELECT "businessId", id, "paidAmount", 'LEGACY_UNDATED' FROM public."Invoice" WHERE "paidAmount" > 0;
CREATE FUNCTION public.record_invoice_collection() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE delta double precision;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."businessId" IS DISTINCT FROM OLD."businessId" THEN
      RAISE EXCEPTION 'Invoice business cannot change';
    END IF;
    delta := COALESCE(NEW."paidAmount", 0) - COALESCE(OLD."paidAmount", 0);
  ELSE
    delta := COALESCE(NEW."paidAmount", 0);
  END IF;
  IF delta <> 0 THEN
    INSERT INTO public."InvoicePayment" ("businessId", "invoiceId", amount, "occurredAt", source)
    VALUES (NEW."businessId", NEW.id, delta, clock_timestamp(), CASE WHEN delta > 0 THEN 'PAYMENT' ELSE 'REVERSAL' END);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_invoice_collection() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER invoice_collection_ledger AFTER INSERT OR UPDATE OF "paidAmount", "businessId"
ON public."Invoice" FOR EACH ROW EXECUTE FUNCTION public.record_invoice_collection();
COMMIT;
