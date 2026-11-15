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
