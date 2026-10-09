\set ON_ERROR_STOP on
-- Disposable database only; synthetic accounting fixtures.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE "Invoice" (id text primary key, "businessId" text, "createdAt" timestamp, total float8, "paidAmount" float8, status text, number int, "customerId" text, "dueDate" date);
CREATE TABLE "Customer" (id text, name text);
CREATE TABLE "Purchase" ("businessId" text, total float8, date date);
CREATE TABLE "Expense" ("businessId" text, amount float8, date date);
CREATE TABLE "Material" (id text, name text, unit text, "unitPrice" float8, "businessId" text, "stockQty" float8, "reorderLevel" float8);
CREATE TABLE "StockMovement" ("businessId" text, type text, "createdAt" timestamp, "costAmount" float8, qty float8, "materialId" text);
CREATE TABLE "Product" (id text, "overheadCost" float8);
CREATE TABLE "InvoiceItem" ("invoiceId" text, "productId" text);
CREATE TABLE "RecipeItem" ("productId" text, "materialId" text, "unitPrice" float8);
\ir ../../supabase/migrations/20261009180000_report_sales_and_quality.sql
INSERT INTO "Invoice" SELECT 'i'||n,'a','2026-10-05',1,0,'UNPAID',n,null,null FROM generate_series(1,1201) n;
INSERT INTO "Invoice" VALUES ('other','b','2026-10-05',9999,9999,'PAID',1,null,null), ('boundary','a','2026-09-30 21:00',9,0,'UNPAID',1202,null,null);
INSERT INTO "Expense" VALUES ('a',2,'2026-10-01'),('a',999,'2026-09-30'),('b',999,'2026-10-01');
INSERT INTO "Purchase" VALUES ('a',100,'2026-10-01');
INSERT INTO "Material" VALUES ('m','raw','g',10,'a',0,1);
INSERT INTO "StockMovement" VALUES ('a','SALE','2026-10-05',4,-1,'m'),('a','SALE','2026-10-05',null,-0.1,'m');
INSERT INTO "InvoiceItem" VALUES ('i1',null);
DO $$ DECLARE r jsonb; BEGIN
 r:=dashboard_summary('a','2026-09-30 21:00','2026-10-31 21:00','2026-10-01','2026-11-01');
 IF (r->>'totalSales')::float8<>1210 OR (r->>'costOfGoodsSold')::float8<>5 OR (r->>'operatingExpenses')::float8<>2 OR (r->>'totalPurchases')::float8<>100 OR (r->>'unpaidInvoicesCount')::int<>1202 THEN RAISE EXCEPTION 'wrong totals, row cap, timezone or tenant scope: %',r; END IF;
 IF NOT (r->>'costEstimated')::boolean OR (r->>'missingCostItems')::int<>1 THEN RAISE EXCEPTION 'quality warnings missing'; END IF;
 UPDATE "Invoice" SET "paidAmount"=1,status='PAID' WHERE id='i1';
 r:=dashboard_summary('a','2026-09-30 21:00','2026-10-31 21:00','2026-10-01','2026-11-01');
 IF (r->>'totalSales')::float8<>1210 THEN RAISE EXCEPTION 'later collection changed sales'; END IF;
 IF has_function_privilege('anon','public.dashboard_summary(text,timestamp,timestamp,date,date)','EXECUTE') OR has_function_privilege('authenticated','public.dashboard_summary(text,timestamp,timestamp,date,date)','EXECUTE') THEN RAISE EXCEPTION 'public aggregate access'; END IF;
END $$;
