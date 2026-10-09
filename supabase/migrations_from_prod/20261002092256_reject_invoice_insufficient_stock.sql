-- Reject a sale whose recipe materials exceed recorded stock instead of
-- letting stock go negative. The whole invoice rolls back with the error.
create or replace function public.create_invoice_with_inventory(
  p_business_id text,
  p_customer_id text,
  p_status text,
  p_due_date date,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id text := gen_random_uuid()::text;
  v_number integer;
  v_status "InvoiceStatus";
  v_vat_enabled boolean;
  v_item jsonb;
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
begin
  if p_business_id is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid invoice';
  end if;
  perform 1 from "Business" where id=p_business_id for update;
  if not found then raise exception 'Business not found'; end if;
  select "vatEnabled" into v_vat_enabled from "Business" where id=p_business_id;
  if p_customer_id is not null and not exists (select 1 from "Customer" where id=p_customer_id and "businessId"=p_business_id) then
    raise exception 'Customer not found';
  end if;
  v_status := coalesce(nullif(p_status,''),'UNPAID')::"InvoiceStatus";

  select coalesce(max(number),0)+1 into v_number from "Invoice" where "businessId"=p_business_id;
  for v_item in select value from jsonb_array_elements(p_items)
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
      'unitPrice',v_price,'quantity',v_quantity,'lineTotal',v_line_total);
    v_items:=v_items||jsonb_build_array(v_item_result);
  end loop;
  v_subtotal:=round(v_subtotal::numeric,2)::double precision;
  if v_vat_enabled then v_vat:=round((v_subtotal*0.15)::numeric,2)::double precision; end if;
  v_total:=v_subtotal+v_vat;

  insert into "Invoice" (id,"businessId","customerId",number,status,"dueDate",subtotal,"vatAmount",total,"paidAmount",notes)
    values (v_invoice_id,p_business_id,p_customer_id,v_number,v_status,p_due_date,v_subtotal,v_vat,v_total,0,p_notes);
  insert into "InvoiceItem" (id,"invoiceId","productId",name,"unitPrice",quantity,"lineTotal")
    select item->>'id',v_invoice_id,item->>'productId',item->>'name',
      (item->>'unitPrice')::double precision,(item->>'quantity')::double precision,(item->>'lineTotal')::double precision
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
    'paidAmount',0,'dueDate',p_due_date,'notes',p_notes,'items',v_items,
    'customer',case when p_customer_id is null then null else
      (select jsonb_build_object('id',id,'name',name,'phone',phone) from "Customer" where id=p_customer_id) end);
end;
$$;

revoke all on function public.create_invoice_with_inventory(text,text,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_invoice_with_inventory(text,text,text,date,text,jsonb) to service_role;