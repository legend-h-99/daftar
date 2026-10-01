create or replace function public.save_product_with_recipe(
  p_business_id text,
  p_product_id text,
  p_name text,
  p_category text,
  p_overhead_cost double precision,
  p_profit_margin double precision,
  p_recipe_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id text := p_product_id;
  v_name text;
  v_category text;
  v_overhead double precision;
  v_margin double precision;
  v_raw double precision := 0;
  v_packaging double precision := 0;
  v_total_cost double precision;
  v_selling double precision;
  v_item jsonb;
  v_material_id text;
  v_unit "Unit";
  v_type "RecipeItemType";
  v_price double precision;
  v_quantity double precision;
  v_line_cost double precision;
  v_items jsonb := '[]'::jsonb;
  v_item_result jsonb;
begin
  if p_business_id is null or nullif(trim(p_name), '') is null then
    raise exception 'Invalid product';
  end if;
  if p_recipe_items is not null and
     (jsonb_typeof(p_recipe_items) <> 'array' or jsonb_array_length(p_recipe_items) > 100) then
    raise exception 'Invalid recipe';
  end if;
  perform 1 from "Business" where id = p_business_id for update;
  if not found then raise exception 'Business not found'; end if;

  if v_product_id is not null then
    select name, category, "overheadCost", "profitMargin"
      into v_name, v_category, v_overhead, v_margin
      from "Product" where id = v_product_id and "businessId" = p_business_id for update;
    if not found then raise exception 'Product not found'; end if;
  end if;
  v_name := coalesce(nullif(trim(p_name), ''), v_name);
  v_category := coalesce(p_category, v_category);
  v_overhead := coalesce(p_overhead_cost, v_overhead, 0);
  v_margin := coalesce(p_profit_margin, v_margin, 30);
  if v_overhead < 0 or v_margin < 0 or v_margin >= 100 then raise exception 'Invalid product costs'; end if;

  if p_recipe_items is null and v_product_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'materialId', "materialId", 'name', name, 'unit', unit,
      'unitPrice', "unitPrice", 'quantityUsed', "quantityUsed", 'type', type
    ) order by "createdAt"), '[]'::jsonb)
    into p_recipe_items from "RecipeItem" where "productId" = v_product_id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_recipe_items, '[]'::jsonb))
  loop
    if jsonb_typeof(v_item) <> 'object' or nullif(trim(v_item->>'name'), '') is null
       or coalesce((v_item->>'quantityUsed')::double precision, 0) < 0 then
      raise exception 'Invalid recipe item';
    end if;
    v_unit := (v_item->>'unit')::"Unit";
    v_type := coalesce(nullif(v_item->>'type', ''), 'RAW')::"RecipeItemType";
    v_quantity := (v_item->>'quantityUsed')::double precision;
    v_material_id := nullif(v_item->>'materialId', '');
    if v_material_id is not null then
      select id, "unitPrice" into v_material_id, v_price
        from "Material" where id = v_material_id and "businessId" = p_business_id;
      if v_material_id is null then raise exception 'Material not found'; end if;
    else
      v_price := coalesce((v_item->>'unitPrice')::double precision, 0);
    end if;
    if v_price < 0 then raise exception 'Invalid recipe item'; end if;
    v_line_cost := v_price * v_quantity;
    if v_type = 'RAW' then v_raw := v_raw + v_line_cost;
    else v_packaging := v_packaging + v_line_cost; end if;
    v_item_result := jsonb_build_object(
      'id', gen_random_uuid()::text, 'materialId', v_material_id,
      'name', trim(v_item->>'name'), 'unit', v_unit, 'unitPrice', v_price,
      'quantityUsed', v_quantity, 'lineCost', v_line_cost, 'type', v_type
    );
    v_items := v_items || jsonb_build_array(v_item_result);
  end loop;

  v_raw := round(v_raw::numeric, 2)::double precision;
  v_packaging := round(v_packaging::numeric, 2)::double precision;
  v_total_cost := round((v_raw + v_packaging + v_overhead)::numeric, 2)::double precision;
  v_selling := round((v_total_cost / (1 - v_margin / 100))::numeric, 2)::double precision;

  if v_product_id is null then
    v_product_id := gen_random_uuid()::text;
    insert into "Product" (id,"businessId",name,category,"rawCost","packagingCost","overheadCost","totalCost","profitMargin","sellingPrice")
    values (v_product_id,p_business_id,v_name,v_category,v_raw,v_packaging,v_overhead,v_total_cost,v_margin,v_selling);
  else
    delete from "RecipeItem" where "productId" = v_product_id;
    update "Product" set name=v_name,category=v_category,"rawCost"=v_raw,"packagingCost"=v_packaging,
      "overheadCost"=v_overhead,"totalCost"=v_total_cost,"profitMargin"=v_margin,
      "sellingPrice"=v_selling,"updatedAt"=now()
    where id=v_product_id and "businessId"=p_business_id;
  end if;

  insert into "RecipeItem" (id,"productId","materialId",name,unit,"unitPrice","quantityUsed","lineCost",type)
    select item->>'id',v_product_id,item->>'materialId',item->>'name',(item->>'unit')::"Unit",
      (item->>'unitPrice')::double precision,(item->>'quantityUsed')::double precision,
      (item->>'lineCost')::double precision,(item->>'type')::"RecipeItemType"
    from jsonb_array_elements(v_items) as item;

  return jsonb_build_object('id',v_product_id,'businessId',p_business_id,'name',v_name,'category',v_category,
    'rawCost',v_raw,'packagingCost',v_packaging,'overheadCost',v_overhead,'totalCost',v_total_cost,
    'profitMargin',v_margin,'sellingPrice',v_selling,'recipeItems',v_items);
end;
$$;

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
      max(m."unitPrice") as unit_price
    from jsonb_array_elements(p_items) as line(item)
    join "RecipeItem" r on r."productId"=line.item->>'productId' and r."materialId" is not null
    join "Product" p on p.id=r."productId" and p."businessId"=p_business_id
    join "Material" m on m.id=r."materialId" and m."businessId"=p_business_id
    group by r."materialId"
  loop
    update "Material" set "stockQty"="stockQty"-v_stock.qty,"updatedAt"=now()
      where id=v_stock.material_id and "businessId"=p_business_id returning "stockQty" into v_balance;
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

revoke all on function public.save_product_with_recipe(text,text,text,text,double precision,double precision,jsonb) from public,anon,authenticated;
grant execute on function public.save_product_with_recipe(text,text,text,text,double precision,double precision,jsonb) to service_role;
revoke all on function public.create_invoice_with_inventory(text,text,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_invoice_with_inventory(text,text,text,date,text,jsonb) to service_role;
