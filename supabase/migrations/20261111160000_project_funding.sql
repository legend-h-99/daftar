BEGIN;
CREATE TABLE public."FundingEntry" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" text NOT NULL REFERENCES public."Business"(id) ON DELETE RESTRICT,
  "requestId" uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('OWNER_CONTRIBUTION','LOAN','OWNER_WITHDRAWAL','LOAN_REPAYMENT')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  date date NOT NULL,
  note text CHECK (length(note) <= 2000),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("businessId", "requestId")
);
CREATE INDEX "FundingEntry_business_date_idx" ON public."FundingEntry" ("businessId", date);
ALTER TABLE public."FundingEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."FundingEntry" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public."FundingEntry" TO service_role;
-- Entries are append-only; corrections use an opposite movement, preserving the audit trail.
-- Include financing in the user's full data export without altering existing export fields.
ALTER FUNCTION public.export_business_data(text) RENAME TO export_business_data_without_funding;
REVOKE ALL ON FUNCTION public.export_business_data_without_funding(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.export_business_data(p_business_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.export_business_data_without_funding(p_business_id) || jsonb_build_object(
 'FundingEntry', (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.date,f.id),'[]'::jsonb)
 FROM public."FundingEntry" f WHERE f."businessId"=p_business_id));
$$;
REVOKE ALL ON FUNCTION public.export_business_data(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.export_business_data(text) TO service_role;
COMMIT;
