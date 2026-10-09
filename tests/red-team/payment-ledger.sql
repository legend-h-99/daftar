\set ON_ERROR_STOP on
-- Run only in a disposable database. These fixtures do not represent production.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public."Business" (id text PRIMARY KEY);
CREATE TABLE public."Invoice" (id text PRIMARY KEY, "businessId" text NOT NULL REFERENCES "Business", "paidAmount" double precision NOT NULL DEFAULT 0);
INSERT INTO "Business" VALUES ('a'), ('b');
INSERT INTO "Invoice" VALUES ('legacy','a',20);
\ir ../../supabase/migrations/20261007090000_invoice_payment_ledger.sql
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM "InvoicePayment" WHERE "invoiceId"='legacy' AND "occurredAt" IS NULL AND amount=20) THEN RAISE EXCEPTION 'legacy date fabricated'; END IF;
END $$;
INSERT INTO "Invoice" VALUES ('new','a',30);
UPDATE "Invoice" SET "paidAmount"=40 WHERE id='new';
UPDATE "Invoice" SET "paidAmount"=40 WHERE id='new';
UPDATE "Invoice" SET "paidAmount"=35 WHERE id='new';
DO $$ BEGIN
 IF (SELECT count(*) FROM "InvoicePayment" WHERE "invoiceId"='new') <> 3 THEN RAISE EXCEPTION 'duplicate or missing payment'; END IF;
 IF (SELECT sum(amount) FROM "InvoicePayment" WHERE "invoiceId"='new') <> 35 THEN RAISE EXCEPTION 'ledger mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM "InvoicePayment" WHERE "invoiceId"='new' AND "occurredAt" IS NULL) THEN RAISE EXCEPTION 'new collection undated'; END IF;
 BEGIN
  UPDATE "Invoice" SET "businessId"='b' WHERE id='new';
  RAISE EXCEPTION 'tenant move succeeded';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='tenant move succeeded' THEN RAISE; END IF;
 END;
 BEGIN
  DELETE FROM "Invoice" WHERE id='new';
  RAISE EXCEPTION 'financial history deleted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF has_table_privilege('anon', 'public."InvoicePayment"', 'SELECT') OR has_table_privilege('authenticated', 'public."InvoicePayment"', 'SELECT') THEN RAISE EXCEPTION 'client has ledger access'; END IF;
 IF has_table_privilege('service_role', 'public."InvoicePayment"', 'UPDATE') THEN RAISE EXCEPTION 'service can rewrite ledger'; END IF;
END $$;
BEGIN;
UPDATE "Invoice" SET "paidAmount"=45 WHERE id='new';
ROLLBACK;
DO $$ BEGIN
 IF (SELECT sum(amount) FROM "InvoicePayment" WHERE "invoiceId"='new') <> 35 THEN RAISE EXCEPTION 'ledger escaped transaction'; END IF;
END $$;
SELECT 'payment ledger checks passed' AS result;
