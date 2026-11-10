-- Roll forward after the migrations present in production on 2026-11-02.
-- No existing monetary column types are changed and no legacy collection date is invented.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "voidedAt" timestamptz;
ALTER TABLE public."Purchase" ADD COLUMN IF NOT EXISTS "voidedAt" timestamptz;
ALTER TABLE public."Purchase" ADD COLUMN IF NOT EXISTS "inventoryBefore" jsonb;
ALTER TABLE public."Purchase" ADD COLUMN IF NOT EXISTS "inventoryAfter" jsonb;
CREATE TABLE public."OperationRequest" (
  "businessId" text NOT NULL REFERENCES public."Business"(id),
  kind text NOT NULL CHECK (kind='PURCHASE'),
  key text NOT NULL CHECK (key ~ '^[A-Za-z0-9_-]{8,100}$'),
  fingerprint text NOT NULL, response jsonb NOT NULL,
  PRIMARY KEY ("businessId",kind,key)
);
ALTER TABLE public."OperationRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."OperationRequest" FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public."OperationRequest" TO service_role;

-- Keep the existing atomic purchase implementation private; the public wrapper
-- adds replay protection and a before-image for safe reversal.
ALTER FUNCTION public.create_purchase_with_inventory(text,text,text,date,text,text,jsonb) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.create_purchase_with_inventory(text,text,text,date,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.create_purchase_with_inventory(
 p_business_id text,p_supplier_id text,p_supplier_name text,p_date date,
 p_source text,p_notes text,p_items jsonb,p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; before_image jsonb; previous "OperationRequest"%rowtype;
 fingerprint text:=md5(jsonb_build_array(p_supplier_id,p_supplier_name,p_date,p_source,p_notes,p_items)::text);
BEGIN
 IF p_idempotency_key IS NOT NULL AND p_idempotency_key !~ '^[A-Za-z0-9_-]{8,100}$' THEN RAISE EXCEPTION 'Invalid idempotency key'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid purchase'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE
   NOT (coalesce((i->>'quantity')::float8,0)>0 AND (i->>'quantity')::float8<=100000000)
   OR NOT (coalesce((i->>'unitPrice')::float8,-1)>=0 AND (i->>'unitPrice')::float8<=100000000)) THEN RAISE EXCEPTION 'Invalid purchase item'; END IF;
 PERFORM 1 FROM "Business" WHERE id=p_business_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
 IF p_idempotency_key IS NOT NULL THEN
  SELECT * INTO previous FROM "OperationRequest" WHERE "businessId"=p_business_id AND kind='PURCHASE' AND key=p_idempotency_key;
  IF FOUND THEN
   IF previous.fingerprint<>fingerprint THEN RAISE EXCEPTION 'Idempotency key reused'; END IF;
   RETURN previous.response||jsonb_build_object('replayed',true);
  END IF;
 END IF;
 PERFORM 1 FROM "Material" m WHERE "businessId"=p_business_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE m.id=i->>'materialId' OR (m.name=i->>'name' AND m.unit::text=i->>'unit')) ORDER BY id FOR UPDATE;
 SELECT coalesce(jsonb_object_agg(id,to_jsonb(m)),'{}') INTO before_image FROM "Material" m WHERE "businessId"=p_business_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE m.id=i->>'materialId' OR (m.name=i->>'name' AND m.unit::text=i->>'unit'));
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i JOIN "Material" m ON m.id=i->>'materialId' AND m."businessId"=p_business_id WHERE m.unit::text IS DISTINCT FROM i->>'unit') THEN RAISE EXCEPTION 'Invalid purchase unit'; END IF;
 result:=private.create_purchase_with_inventory(p_business_id,p_supplier_id,p_supplier_name,p_date,p_source,p_notes,p_items);
 -- Retain only materials affected by this purchase, not a copy of the whole inventory.
 UPDATE "Purchase" SET "inventoryBefore"=(SELECT jsonb_object_agg(i->>'materialId',coalesce(before_image->(i->>'materialId'),'null'::jsonb)) FROM jsonb_array_elements(result->'items') i) WHERE id=result->>'id';
 UPDATE "Purchase" SET "inventoryAfter"=(SELECT jsonb_object_agg(m.id,jsonb_build_object('purchasePrice',m."purchasePrice",'purchaseQty',m."purchaseQty",'unitPrice',m."unitPrice")) FROM "Material" m WHERE m."businessId"=p_business_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') i WHERE i->>'materialId'=m.id)) WHERE id=result->>'id';
 IF p_idempotency_key IS NOT NULL THEN
  INSERT INTO "OperationRequest" VALUES(p_business_id,'PURCHASE',p_idempotency_key,fingerprint,result);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_purchase_with_inventory(text,text,text,date,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_with_inventory(text,text,text,date,text,text,jsonb,text) TO service_role;

CREATE FUNCTION public.void_purchase_with_inventory(p_business_id text,p_purchase_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE purchase "Purchase"%rowtype; movement record; previous jsonb; balance float8;
BEGIN
 PERFORM 1 FROM "Business" WHERE id=p_business_id FOR NO KEY UPDATE;
 SELECT * INTO purchase FROM "Purchase" WHERE id=p_purchase_id AND "businessId"=p_business_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF purchase."voidedAt" IS NOT NULL THEN RETURN true; END IF;
 IF purchase."inventoryBefore" IS NULL OR purchase."inventoryAfter" IS NULL THEN RAISE EXCEPTION 'Legacy purchase requires reviewed correction'; END IF;
 FOR movement IN SELECT "materialId",sum(qty) qty,min("createdAt") first_at FROM "StockMovement" WHERE "businessId"=p_business_id AND "refType"='PURCHASE' AND "refId"=p_purchase_id AND type='PURCHASE' GROUP BY "materialId" ORDER BY "materialId" LOOP
  PERFORM 1 FROM "Material" WHERE id=movement."materialId" AND "businessId"=p_business_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM "Material" m WHERE m.id=movement."materialId" AND (jsonb_build_object('purchasePrice',m."purchasePrice",'purchaseQty',m."purchaseQty",'unitPrice',m."unitPrice") IS DISTINCT FROM purchase."inventoryAfter"->m.id)) THEN RAISE EXCEPTION 'Material price changed after purchase'; END IF;
  IF EXISTS(SELECT 1 FROM "StockMovement" WHERE "businessId"=p_business_id AND "materialId"=movement."materialId" AND "createdAt">=movement.first_at AND "refId" IS DISTINCT FROM p_purchase_id) THEN RAISE EXCEPTION 'Later stock movement prevents reversal'; END IF;
  UPDATE "Material" SET "stockQty"=greatest(0,"stockQty"-movement.qty),"updatedAt"=now() WHERE id=movement."materialId" AND "businessId"=p_business_id AND "stockQty"+1e-9>=movement.qty RETURNING "stockQty" INTO balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
  previous:=purchase."inventoryBefore"->movement."materialId";
  IF previous IS NOT NULL AND previous<>'null'::jsonb THEN
   UPDATE "Material" SET "purchasePrice"=(previous->>'purchasePrice')::float8,"purchaseQty"=(previous->>'purchaseQty')::float8,"unitPrice"=(previous->>'unitPrice')::float8 WHERE id=movement."materialId" AND "businessId"=p_business_id;
  END IF;
  INSERT INTO "StockMovement"(id,"businessId","materialId",type,qty,"balanceAfter",note,"refType","refId") VALUES(gen_random_uuid()::text,p_business_id,movement."materialId",'ADJUSTMENT',-movement.qty,balance,'عكس الشراء #'||purchase.number,'PURCHASE',p_purchase_id);
 END LOOP;
 UPDATE "Purchase" SET "voidedAt"=clock_timestamp() WHERE id=p_purchase_id AND "businessId"=p_business_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.void_purchase_with_inventory(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.void_purchase_with_inventory(text,text) TO service_role;

CREATE FUNCTION public.onboard_business(p_user_id text,p_name text,p_city text,p_vat_enabled boolean,p_vat_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE account "User"%rowtype; business "Business"%rowtype;
BEGIN
 IF nullif(btrim(p_name),'') IS NULL OR length(p_name)>100 OR
  (p_vat_number IS NOT NULL AND p_vat_number<>'' AND p_vat_number !~ '^3[0-9]{13}3$') OR
  (p_vat_enabled AND coalesce(p_vat_number,'')='') THEN RAISE EXCEPTION 'Invalid business'; END IF;
 SELECT * INTO account FROM "User" WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR account."businessId" IS NOT NULL THEN RAISE EXCEPTION 'Business already set up or user missing'; END IF;
 INSERT INTO "Business"(id,name,"ownerPhone",city,"vatEnabled","vatNumber","updatedAt") VALUES(gen_random_uuid()::text,btrim(p_name),account.phone,p_city,coalesce(p_vat_enabled,false),p_vat_number,now()) RETURNING * INTO business;
 UPDATE "User" SET "businessId"=business.id WHERE id=p_user_id;
 RETURN to_jsonb(business);
END $$;
REVOKE ALL ON FUNCTION public.onboard_business(text,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_business(text,text,text,boolean,text) TO service_role;

CREATE FUNCTION public.update_material_details(p_business_id text,p_material_id text,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE material "Material"%rowtype;
BEGIN
 IF jsonb_typeof(p_body) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_body) k WHERE k NOT IN ('name','purchasePrice','vatRate','reorderLevel')) THEN RAISE EXCEPTION 'Invalid material update'; END IF;
 SELECT * INTO material FROM "Material" WHERE id=p_material_id AND "businessId"=p_business_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Material not found'; END IF;
 IF p_body?'name' THEN material.name:=nullif(btrim(p_body->>'name'),''); END IF;
 IF p_body?'purchasePrice' THEN material."purchasePrice":=(p_body->>'purchasePrice')::float8; END IF;
 IF p_body?'vatRate' THEN material."vatRate":=(p_body->>'vatRate')::float8; END IF;
 IF p_body?'reorderLevel' THEN material."reorderLevel":=(p_body->>'reorderLevel')::float8; END IF;
 IF material.name IS NULL OR material."purchasePrice" IS NULL OR NOT(material."purchasePrice">=0 AND material."purchasePrice"<=100000000) OR material."purchaseQty"<=0 OR NOT(material."vatRate">=0 AND material."vatRate"<=100) OR (material."reorderLevel" IS NOT NULL AND NOT(material."reorderLevel">=0 AND material."reorderLevel"<=100000000)) THEN RAISE EXCEPTION 'Invalid material update'; END IF;
 UPDATE "Material" SET name=material.name,"purchasePrice"=material."purchasePrice","unitPrice"=material."purchasePrice"/material."purchaseQty","vatRate"=material."vatRate","reorderLevel"=material."reorderLevel","updatedAt"=now() WHERE id=p_material_id AND "businessId"=p_business_id RETURNING * INTO material;
 RETURN to_jsonb(material);
END $$;
REVOKE ALL ON FUNCTION public.update_material_details(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_material_details(text,text,jsonb) TO service_role;

LOCK TABLE public."Invoice" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public."InvoicePayment" (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" text NOT NULL REFERENCES public."Business"(id) ON DELETE RESTRICT,
  "invoiceId" text NOT NULL REFERENCES public."Invoice"(id) ON DELETE RESTRICT,
  amount double precision NOT NULL CHECK (amount <> 0 AND amount > '-Infinity'::float8 AND amount < 'Infinity'::float8),
  "occurredAt" timestamptz,
  "recordedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL CHECK (source IN ('LEGACY_UNDATED', 'PAYMENT', 'REVERSAL'))
);
CREATE INDEX IF NOT EXISTS "InvoicePayment_business_date_idx" ON public."InvoicePayment" ("businessId", "occurredAt");
ALTER TABLE public."InvoicePayment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."InvoicePayment" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public."InvoicePayment" TO service_role;
INSERT INTO public."InvoicePayment" ("businessId", "invoiceId", amount, source)
SELECT "businessId", id, "paidAmount", 'LEGACY_UNDATED' FROM public."Invoice" i WHERE "paidAmount" > 0 AND NOT EXISTS(SELECT 1 FROM public."InvoicePayment" p WHERE p."invoiceId"=i.id);
CREATE OR REPLACE FUNCTION public.record_invoice_collection() RETURNS trigger
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
DROP TRIGGER IF EXISTS invoice_collection_ledger ON public."Invoice";
CREATE TRIGGER invoice_collection_ledger AFTER INSERT OR UPDATE OF "paidAmount", "businessId"
ON public."Invoice" FOR EACH ROW EXECUTE FUNCTION public.record_invoice_collection();


CREATE FUNCTION public.set_invoice_payment(p_business_id text,p_invoice_id text,p_status text,p_paid_amount float8,p_expected_paid_amount float8 DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invoice "Invoice"%rowtype; paid float8;
BEGIN
 SELECT * INTO invoice FROM "Invoice" WHERE id=p_invoice_id AND "businessId"=p_business_id FOR UPDATE;
 IF NOT FOUND OR invoice."voidedAt" IS NOT NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF p_expected_paid_amount IS NOT NULL AND invoice."paidAmount" IS DISTINCT FROM p_expected_paid_amount THEN RAISE EXCEPTION 'Invoice changed'; END IF;
 paid:=CASE p_status WHEN 'PAID' THEN invoice.total WHEN 'UNPAID' THEN 0 WHEN 'PARTIAL' THEN p_paid_amount ELSE NULL END;
 IF paid IS NULL OR NOT(paid>=0 AND paid<='10000000000000000'::float8) OR (p_status='PARTIAL' AND NOT(paid>0 AND paid<invoice.total)) THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 UPDATE "Invoice" SET status=p_status::"InvoiceStatus","paidAmount"=paid WHERE id=p_invoice_id AND "businessId"=p_business_id;
 RETURN (SELECT to_jsonb(i)||jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(item) ORDER BY position,id) FROM "InvoiceItem" item WHERE "invoiceId"=i.id),'[]'::jsonb),'customer',(SELECT to_jsonb(c) FROM "Customer" c WHERE c.id=i."customerId")) FROM "Invoice" i WHERE i.id=p_invoice_id);
END $$;
REVOKE ALL ON FUNCTION public.set_invoice_payment(text,text,text,float8,float8) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_invoice_payment(text,text,text,float8,float8) TO service_role;

-- Preserve the invoice and its payment journal. Repeated cancellation is a no-op.
CREATE OR REPLACE FUNCTION public.delete_invoice_with_inventory(p_business_id text,p_invoice_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE invoice "Invoice"%rowtype; movement record; balance float8;
BEGIN
 PERFORM 1 FROM "Business" WHERE id=p_business_id FOR NO KEY UPDATE;
 SELECT * INTO invoice FROM "Invoice" WHERE id=p_invoice_id AND "businessId"=p_business_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF invoice."voidedAt" IS NOT NULL THEN RETURN true; END IF;
 FOR movement IN SELECT "materialId",sum(-qty) qty FROM "StockMovement" WHERE "businessId"=p_business_id AND type='SALE' AND "refType"='INVOICE' AND "refId"=p_invoice_id GROUP BY "materialId" ORDER BY "materialId" LOOP
  UPDATE "Material" SET "stockQty"="stockQty"+movement.qty,"updatedAt"=now() WHERE id=movement."materialId" AND "businessId"=p_business_id RETURNING "stockQty" INTO balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material not found'; END IF;
  INSERT INTO "StockMovement"(id,"businessId","materialId",type,qty,"balanceAfter",note,"refType","refId") VALUES(gen_random_uuid()::text,p_business_id,movement."materialId",'ADJUSTMENT',movement.qty,balance,'إلغاء الفاتورة #'||invoice.number,'INVOICE',p_invoice_id);
 END LOOP;
 UPDATE "Invoice" SET "voidedAt"=clock_timestamp(),"paidAmount"=0,status='UNPAID' WHERE id=p_invoice_id AND "businessId"=p_business_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.delete_invoice_with_inventory(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_invoice_with_inventory(text,text) TO service_role;

-- Keep production SQL aggregates while separating sales from collections.
create or replace function public.dashboard_summary(
  p_business_id text, p_start timestamp default null, p_end timestamp default null,
  p_start_date date default null, p_end_date date default null
) returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  with inv as (
    select * from "Invoice" where "businessId"=p_business_id and "voidedAt" is null
      and (p_start is null or "createdAt">=p_start) and (p_end is null or "createdAt"<p_end)
  ), unpaid as (
    select * from inv where status in ('UNPAID','PARTIAL')
  )
  select jsonb_build_object(
    'totalSales', (select coalesce(sum(subtotal),0) from inv),
    'outputVat', (select coalesce(sum("vatAmount"),0) from inv),
    'grossSales', (select coalesce(sum(total),0) from inv),
    'totalPurchases', (select coalesce(sum(coalesce(total,0)),0) from "Purchase" where "businessId"=p_business_id and "voidedAt" is null
      and (p_start_date is null or date>=p_start_date) and (p_end_date is null or date<p_end_date)),
    'operatingExpenses', (select coalesce(sum(amount),0) from "Expense" where "businessId"=p_business_id
      and (p_start_date is null or date>=p_start_date) and (p_end_date is null or date<p_end_date)),
    -- Historical movement cost; only legacy movements fall back to the current price.
    'costOfGoodsSold', (select coalesce(sum(coalesce(s."costAmount", abs(s.qty)*coalesce(m."unitPrice",0))),0)
      from "StockMovement" s left join "Material" m on m.id=s."materialId"
      where s."businessId"=p_business_id and s.type='SALE' and not exists(select 1 from "Invoice" cancelled where cancelled.id=s."refId" and cancelled."voidedAt" is not null)
        and (p_start is null or s."createdAt">=p_start) and (p_end is null or s."createdAt"<p_end)),
    'costEstimated', exists(select 1 from "StockMovement" where "businessId"=p_business_id and type='SALE' and not exists(select 1 from "Invoice" cancelled where cancelled.id="StockMovement"."refId" and cancelled."voidedAt" is not null) and "costAmount" is null and (p_start is null or "createdAt">=p_start) and (p_end is null or "createdAt"<p_end)),
    'missingCostItems', (select count(*) from "InvoiceItem" i join inv on inv.id=i."invoiceId" left join "Product" p on p.id=i."productId" where p.id is null or p."overheadCost">0 or not exists(select 1 from "RecipeItem" r where r."productId"=p.id) or exists(select 1 from "RecipeItem" r where r."productId"=p.id and (r."materialId" is null or r."unitPrice"<=0))),
    'invoiceCount', (select count(*) from inv),
    'paidInvoicesCount', (select count(*) from inv where status='PAID'),
    'unpaidInvoicesCount', (select count(*) from unpaid),
    'unpaidInvoicesTotal', (select coalesce(sum(total-coalesce("paidAmount",0)),0) from unpaid),
    'unpaidInvoices', (select coalesce(jsonb_agg(row order by row->>'createdAt' desc),'[]'::jsonb) from (
      select jsonb_build_object('id',u.id,'number',u.number,'customerName',c.name,'total',u.total,
        'paidAmount',coalesce(u."paidAmount",0),'dueDate',u."dueDate",'status',u.status,'createdAt',u."createdAt") as row
      from unpaid u left join "Customer" c on c.id=u."customerId"
      order by u."createdAt" desc limit 5) recent),
    'lowStock', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,
        'stockQty',"stockQty",'reorderLevel',"reorderLevel") order by name),'[]'::jsonb)
      from "Material" where "businessId"=p_business_id and "reorderLevel">0 and "stockQty"<="reorderLevel")
  );
$$;

revoke all on function public.dashboard_summary(text,timestamp,timestamp,date,date) from public,anon,authenticated;
grant execute on function public.dashboard_summary(text,timestamp,timestamp,date,date) to service_role;

create or replace function public.purchases_summary(p_business_id text)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'bySupplier', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'count',cnt,'total',tot) order by tot desc),'[]'::jsonb) from (
      select coalesce(s.name,'غير محدد') as name, count(*) as cnt, coalesce(sum(p.total),0) as tot
      from "Purchase" p left join "Supplier" s on s.id=p."supplierId"
      where p."businessId"=p_business_id and p."voidedAt" is null group by 1) by_supplier),
    'byMonth', (select coalesce(jsonb_agg(jsonb_build_object('month',month,'count',cnt,'total',tot) order by month),'[]'::jsonb) from (
      select to_char(date,'YYYY-MM') as month, count(*) as cnt, coalesce(sum(total),0) as tot
      from "Purchase" where "businessId"=p_business_id and "voidedAt" is null group by 1) by_month)
  );
$$;

revoke all on function public.purchases_summary(text) from public,anon,authenticated;
grant execute on function public.purchases_summary(text) to service_role;

-- NOT VALID avoids rewriting or silently correcting historical rows. New writes
-- are checked immediately; validation is an explicit release preflight.
ALTER TABLE "Material" ADD CONSTRAINT material_financial_values CHECK (
 "stockQty">=0 AND "stockQty"<'Infinity'::float8 AND
 "purchasePrice">=0 AND "purchasePrice"<'Infinity'::float8 AND
 "purchaseQty">0 AND "purchaseQty"<'Infinity'::float8 AND
 "unitPrice">=0 AND "unitPrice"<'Infinity'::float8
) NOT VALID;
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_financial_values CHECK (subtotal>=0 AND subtotal<'Infinity'::float8 AND "vatAmount">=0 AND "vatAmount"<'Infinity'::float8 AND total>=0 AND total<'Infinity'::float8 AND "paidAmount">=0 AND "paidAmount"<=total) NOT VALID;
ALTER TABLE "Product" ADD CONSTRAINT product_financial_values CHECK ("rawCost">=0 AND "rawCost"<'Infinity'::float8 AND "packagingCost">=0 AND "packagingCost"<'Infinity'::float8 AND "overheadCost">=0 AND "overheadCost"<'Infinity'::float8 AND "totalCost">=0 AND "totalCost"<'Infinity'::float8 AND "sellingPrice">=0 AND "sellingPrice"<'Infinity'::float8 AND "profitMargin">=0 AND "profitMargin"<100) NOT VALID;
ALTER TABLE "StockMovement" ADD CONSTRAINT stock_movement_financial_values CHECK (qty>'-Infinity'::float8 AND qty<'Infinity'::float8 AND "balanceAfter">=0 AND "balanceAfter"<'Infinity'::float8 AND ("costAmount" IS NULL OR ("costAmount">=0 AND "costAmount"<'Infinity'::float8))) NOT VALID;
COMMIT;
