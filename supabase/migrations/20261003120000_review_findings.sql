-- Fixes from the 2026-10-03 multi-agent review of the day's releases.
-- Additive and backward compatible: the currently deployed API keeps working
-- after this migration (same function signatures, new columns are nullable/defaulted).

-- ── Invoice idempotency fingerprint and stable item order ────────────────────
alter table "Invoice" add column if not exists "idempotencyHash" text;
alter table "InvoiceItem" add column if not exists position integer not null default 0;

create or replace function public.create_invoice_with_inventory(
  p_business_id text, p_customer_id text, p_status text, p_due_date date,
  p_notes text, p_items jsonb, p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_invoice_id text := gen_random_uuid()::text;
  v_number integer;
  v_status "InvoiceStatus";
  v_vat_enabled boolean;
  v_item jsonb;
  v_position integer;
  v_item_id text;
  v_product_id text;
  v_name text;
  v_price double precision;
  v_quantity double precision;
  v_line_total double precision;
  v_subtotal double precision := 0;
  v_vat double precision := 0;
  v_total double precision;
  v_items jsonb := '[]'::jsonb;
  v_item_result jsonb;
  v_stock record;
  v_balance double precision;
  v_existing "Invoice"%rowtype;
  -- jsonb normalises key order, so the same request always hashes the same.
  v_hash text := md5(jsonb_build_array(p_customer_id, coalesce(nullif(p_status,''),'UNPAID'), p_due_date, p_notes, p_items)::text);
begin
  if p_business_id is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid invoice';
  end if;
  -- NO KEY UPDATE still serialises invoice numbering per business, but unlike
  -- FOR UPDATE it does not block inserts that reference the business row.
  perform 1 from "Business" where id=p_business_id for no key update;
  if not found then raise exception 'Business not found'; end if;

  if p_idempotency_key is not null then
    select * into v_existing from "Invoice"
      where "businessId"=p_business_id and "idempotencyKey"=p_idempotency_key;
    if found then
      if v_existing."idempotencyHash" is not null and v_existing."idempotencyHash" <> v_hash then
        raise exception 'Idempotency key reused';
      end if;
      return jsonb_build_object('id',v_existing.id,'businessId',v_existing."businessId",'customerId',v_existing."customerId",
        'number',v_existing.number,'status',v_existing.status,'subtotal',v_existing.subtotal,'vatAmount',v_existing."vatAmount",
        'total',v_existing.total,'paidAmount',v_existing."paidAmount",'dueDate',v_existing."dueDate",'notes',v_existing.notes,
        'items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'productId',"productId",'name',name,
          'unitPrice',"unitPrice",'quantity',quantity,'lineTotal',"lineTotal") order by position, id),'[]'::jsonb)
          from "InvoiceItem" where "invoiceId"=v_existing.id),
        'customer',case when v_existing."customerId" is null then null else
          (select jsonb_build_object('id',id,'name',name,'phone',phone) from "Customer" where id=v_existing."customerId") end,
        'replayed',true);
    end if;
  end if;

  select "vatEnabled" into v_vat_enabled from "Business" where id=p_business_id;
  if p_customer_id is not null and not exists (select 1 from "Customer" where id=p_customer_id and "businessId"=p_business_id) then
    raise exception 'Customer not found';
  end if;
  v_status := coalesce(nullif(p_status,''),'UNPAID')::"InvoiceStatus";

  select coalesce(max(number),0)+1 into v_number from "Invoice" where "businessId"=p_business_id;
  for v_item, v_position in select value, ordinality::integer from jsonb_array_elements(p_items) with ordinality
  loop
    if jsonb_typeof(v_item)<>'object' or nullif(trim(v_item->>'name'),'') is null
       or coalesce((v_item->>'quantity')::double precision,0)<=0
       or coalesce((v_item->>'unitPrice')::double precision,-1)<0 then
      raise exception 'Invalid invoice item';
    end if;
    v_product_id:=nullif(v_item->>'productId','');
    if v_product_id is not null and not exists(select 1 from "Product" where id=v_product_id and "businessId"=p_business_id) then
      raise exception 'Product not found';
    end if;
    v_name:=trim(v_item->>'name');
    v_price:=(v_item->>'unitPrice')::double precision;
    v_quantity:=(v_item->>'quantity')::double precision;
    v_line_total:=v_price*v_quantity;
    v_subtotal:=v_subtotal+v_line_total;
    v_item_id:=gen_random_uuid()::text;
    v_item_result:=jsonb_build_object('id',v_item_id,'productId',v_product_id,'name',v_name,
      'unitPrice',v_price,'quantity',v_quantity,'lineTotal',v_line_total,'position',v_position);
    v_items:=v_items||jsonb_build_array(v_item_result);
  end loop;
  v_subtotal:=round(v_subtotal::numeric,2)::double precision;
  if v_vat_enabled then v_vat:=round((v_subtotal*0.15)::numeric,2)::double precision; end if;
  v_total:=v_subtotal+v_vat;

  insert into "Invoice" (id,"businessId","customerId",number,status,"dueDate",subtotal,"vatAmount",total,"paidAmount",notes,"idempotencyKey","idempotencyHash")
    values (v_invoice_id,p_business_id,p_customer_id,v_number,v_status,p_due_date,v_subtotal,v_vat,v_total,
      case when v_status='PAID' then v_total else 0 end,p_notes,p_idempotency_key,
      case when p_idempotency_key is null then null else v_hash end);
  insert into "InvoiceItem" (id,"invoiceId","productId",name,"unitPrice",quantity,"lineTotal",position)
    select item->>'id',v_invoice_id,item->>'productId',item->>'name',
      (item->>'unitPrice')::double precision,(item->>'quantity')::double precision,(item->>'lineTotal')::double precision,
      (item->>'position')::integer
    from jsonb_array_elements(v_items) as item;

  for v_stock in
    select r."materialId" as material_id, sum(r."quantityUsed"*(line.item->>'quantity')::double precision) as qty,
      max(m."unitPrice") as unit_price, max(m.name) as material_name
    from jsonb_array_elements(p_items) as line(item)
    join "RecipeItem" r on r."productId"=line.item->>'productId' and r."materialId" is not null
    join "Product" p on p.id=r."productId" and p."businessId"=p_business_id
    join "Material" m on m.id=r."materialId" and m."businessId"=p_business_id
    group by r."materialId"
  loop
    -- The 1e-9 tolerance absorbs floating-point residue (0.1 * 3 > 0.3).
    update "Material" set "stockQty"=greatest("stockQty"-v_stock.qty, 0),"updatedAt"=now()
      where id=v_stock.material_id and "businessId"=p_business_id and "stockQty" + 1e-9 >= v_stock.qty
      returning "stockQty" into v_balance;
    if not found then
      raise exception 'Insufficient stock: %', v_stock.material_name;
    end if;
    insert into "StockMovement" (id,"businessId","materialId",type,qty,"balanceAfter","costAmount","refType","refId")
      values (gen_random_uuid()::text,p_business_id,v_stock.material_id,'SALE',-v_stock.qty,v_balance,
        v_stock.qty*v_stock.unit_price,'INVOICE',v_invoice_id);
  end loop;

  return jsonb_build_object('id',v_invoice_id,'businessId',p_business_id,'customerId',p_customer_id,
    'number',v_number,'status',v_status,'subtotal',v_subtotal,'vatAmount',v_vat,'total',v_total,
    'paidAmount',case when v_status='PAID' then v_total else 0 end,'dueDate',p_due_date,'notes',p_notes,
    'items',(select jsonb_agg(item - 'position') from jsonb_array_elements(v_items) as item),
    'customer',case when p_customer_id is null then null else
      (select jsonb_build_object('id',id,'name',name,'phone',phone) from "Customer" where id=p_customer_id) end);
end;
$$;

revoke all on function public.create_invoice_with_inventory(text,text,text,date,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_invoice_with_inventory(text,text,text,date,text,jsonb,text) to service_role;

-- ── Deleting an invoice returns its stock and removes its cost of goods ──────
create or replace function public.delete_invoice_with_inventory(p_business_id text, p_invoice_id text)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_number integer;
  v_sale record;
  v_balance double precision;
begin
  select number into v_number from "Invoice"
    where id=p_invoice_id and "businessId"=p_business_id for update;
  if not found then return false; end if;

  for v_sale in
    select "materialId" as material_id, sum(-qty) as qty from "StockMovement"
      where "businessId"=p_business_id and type='SALE' and "refType"='INVOICE' and "refId"=p_invoice_id
      group by "materialId"
  loop
    update "Material" set "stockQty"="stockQty"+v_sale.qty, "updatedAt"=now()
      where id=v_sale.material_id and "businessId"=p_business_id
      returning "stockQty" into v_balance;
    if found then
      insert into "StockMovement" (id,"businessId","materialId",type,qty,"balanceAfter",note)
        values (gen_random_uuid()::text,p_business_id,v_sale.material_id,'ADJUSTMENT',v_sale.qty,v_balance,
          'حذف الفاتورة #' || v_number);
    end if;
  end loop;

  -- The sale movements are the cost of goods sold; a deleted sale has none.
  delete from "StockMovement"
    where "businessId"=p_business_id and type='SALE' and "refType"='INVOICE' and "refId"=p_invoice_id;
  delete from "Invoice" where id=p_invoice_id and "businessId"=p_business_id;
  return true;
end;
$$;

revoke all on function public.delete_invoice_with_inventory(text,text) from public,anon,authenticated;
grant execute on function public.delete_invoice_with_inventory(text,text) to service_role;

-- ── Manual stock count, atomically ───────────────────────────────────────────
create or replace function public.adjust_material_stock(
  p_business_id text, p_material_id text, p_new_qty double precision, p_note text
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_old double precision;
  v_material "Material"%rowtype;
begin
  if p_new_qty is null or p_new_qty < 0 then raise exception 'Invalid stock adjustment'; end if;
  select "stockQty" into v_old from "Material"
    where id=p_material_id and "businessId"=p_business_id for update;
  if not found then raise exception 'Material not found'; end if;
  update "Material" set "stockQty"=p_new_qty, "updatedAt"=now()
    where id=p_material_id and "businessId"=p_business_id
    returning * into v_material;
  insert into "StockMovement" (id,"businessId","materialId",type,qty,"balanceAfter",note)
    values (gen_random_uuid()::text,p_business_id,p_material_id,'ADJUSTMENT',p_new_qty-coalesce(v_old,0),p_new_qty,p_note);
  return to_jsonb(v_material);
end;
$$;

revoke all on function public.adjust_material_stock(text,text,double precision,text) from public,anon,authenticated;
grant execute on function public.adjust_material_stock(text,text,double precision,text) to service_role;

-- ── Report totals computed in SQL (no 1000-row API cap) ──────────────────────
-- Timestamps are naive UTC. Invoices and stock movements are filtered by when
-- they happened (p_start/p_end); expenses and purchases by their business date.
create or replace function public.dashboard_summary(
  p_business_id text, p_start timestamp default null, p_end timestamp default null,
  p_start_date date default null, p_end_date date default null
) returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  with inv as (
    select * from "Invoice" where "businessId"=p_business_id
      and (p_start is null or "createdAt">=p_start) and (p_end is null or "createdAt"<p_end)
  ), unpaid as (
    select * from inv where status in ('UNPAID','PARTIAL')
  )
  select jsonb_build_object(
    'totalSales', (select coalesce(sum(coalesce("paidAmount",0)),0) from inv where status in ('PAID','PARTIAL')),
    'totalPurchases', (select coalesce(sum(coalesce(total,0)),0) from "Purchase" where "businessId"=p_business_id
      and (p_start_date is null or date>=p_start_date) and (p_end_date is null or date<p_end_date)),
    'operatingExpenses', (select coalesce(sum(amount),0) from "Expense" where "businessId"=p_business_id
      and (p_start_date is null or date>=p_start_date) and (p_end_date is null or date<p_end_date)),
    -- Historical movement cost; only legacy movements fall back to the current price.
    'costOfGoodsSold', (select coalesce(sum(coalesce(s."costAmount", abs(s.qty)*coalesce(m."unitPrice",0))),0)
      from "StockMovement" s left join "Material" m on m.id=s."materialId"
      where s."businessId"=p_business_id and s.type='SALE'
        and (p_start is null or s."createdAt">=p_start) and (p_end is null or s."createdAt"<p_end)),
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
      where p."businessId"=p_business_id group by 1) by_supplier),
    'byMonth', (select coalesce(jsonb_agg(jsonb_build_object('month',month,'count',cnt,'total',tot) order by month),'[]'::jsonb) from (
      select to_char(date,'YYYY-MM') as month, count(*) as cnt, coalesce(sum(total),0) as tot
      from "Purchase" where "businessId"=p_business_id group by 1) by_month)
  );
$$;

revoke all on function public.purchases_summary(text) from public,anon,authenticated;
grant execute on function public.purchases_summary(text) to service_role;

-- ── Rate-limit rows and expired revocations clean themselves up ──────────────
create or replace function public.consume_auth_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  current_count integer;
BEGIN
  IF p_key !~ '^[a-f0-9]{64}$' OR p_limit < 1 OR p_limit > 100
    OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RETURN false;
  END IF;

  -- No pg_cron on this project: roughly one call in 500 prunes rows whose
  -- window (at most an hour) or token lifetime has already ended.
  IF random() < 0.002 THEN
    DELETE FROM public."AuthRateLimit" WHERE "windowStart" < now() - interval '1 hour';
    DELETE FROM public."TokenBlacklist" WHERE "expiresAt" < (now() AT TIME ZONE 'utc');
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
$function$;

-- ── Indexes for the per-business, newest-first lists ─────────────────────────
create index if not exists "Invoice_businessId_createdAt_idx" on "Invoice" ("businessId", "createdAt");
create index if not exists "Purchase_businessId_createdAt_idx" on "Purchase" ("businessId", "createdAt");
create index if not exists "StockMovement_refId_idx" on "StockMovement" ("refId") where "refId" is not null;
create index if not exists "InvoiceItem_invoiceId_position_idx" on "InvoiceItem" ("invoiceId", position);
