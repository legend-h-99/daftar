create or replace function public.create_purchase_with_inventory(
  p_business_id text,
  p_supplier_id text,
  p_supplier_name text,
  p_date date,
  p_source text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id text;
  v_purchase_id text := gen_random_uuid()::text;
  v_purchase_number integer;
  v_item jsonb;
  v_material_id text;
  v_material_name text;
  v_unit "Unit";
  v_quantity double precision;
  v_unit_price double precision;
  v_line_total double precision;
  v_balance double precision;
  v_total double precision := 0;
  v_items jsonb := '[]'::jsonb;
  v_item_result jsonb;
begin
  if p_business_id is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid purchase';
  end if;
  perform 1 from "Business" where id = p_business_id for update;
  if not found then raise exception 'Business not found'; end if;
  if p_supplier_id is not null and p_supplier_id <> '' then
    select id into v_supplier_id from "Supplier" where id=p_supplier_id and "businessId"=p_business_id;
    if v_supplier_id is null then raise exception 'Supplier not found'; end if;
  elsif nullif(trim(p_supplier_name), '') is not null then
    select id into v_supplier_id from "Supplier" where "businessId"=p_business_id and lower(name)=lower(trim(p_supplier_name)) order by "createdAt" limit 1;
    if v_supplier_id is null then
      v_supplier_id := gen_random_uuid()::text;
      insert into "Supplier" (id,"businessId",name) values (v_supplier_id,p_business_id,trim(p_supplier_name));
    end if;
  end if;
  select coalesce(max(number),0)+1 into v_purchase_number from "Purchase" where "businessId"=p_business_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item)<>'object' or nullif(trim(v_item->>'name'),'') is null
      or coalesce((v_item->>'quantity')::double precision,0)<=0
      or coalesce((v_item->>'unitPrice')::double precision,-1)<0 then
      raise exception 'Invalid purchase item';
    end if;
    v_material_name:=trim(v_item->>'name');
    v_unit:=(v_item->>'unit')::"Unit";
    v_quantity:=(v_item->>'quantity')::double precision;
    v_unit_price:=(v_item->>'unitPrice')::double precision;
    v_line_total:=v_quantity*v_unit_price;
    v_total:=v_total+v_line_total;
    v_material_id:=nullif(v_item->>'materialId','');
    if v_material_id is not null then
      select id into v_material_id from "Material" where id=v_material_id and "businessId"=p_business_id for update;
      if v_material_id is null then raise exception 'Material not found'; end if;
    else
      select id into v_material_id from "Material" where "businessId"=p_business_id and name=v_material_name and unit=v_unit order by "createdAt" limit 1 for update;
    end if;
    if v_material_id is null then
      v_material_id:=gen_random_uuid()::text;
      v_balance:=v_quantity;
      insert into "Material" (id,"businessId",name,unit,"purchasePrice","purchaseQty","unitPrice","stockQty")
      values (v_material_id,p_business_id,v_material_name,v_unit,v_line_total,v_quantity,v_unit_price,v_quantity);
    else
      update "Material" set "stockQty"="stockQty"+v_quantity,"purchasePrice"=v_line_total,
        "purchaseQty"=v_quantity,"unitPrice"=v_unit_price,"updatedAt"=now()
      where id=v_material_id and "businessId"=p_business_id returning "stockQty" into v_balance;
    end if;
    v_item_result:=jsonb_build_object('id',gen_random_uuid()::text,'materialId',v_material_id,
      'name',v_material_name,'unit',v_unit,'quantity',v_quantity,'unitPrice',v_unit_price,'lineTotal',v_line_total);
    insert into "StockMovement" (id,"businessId","materialId",type,qty,"balanceAfter","costAmount","refType","refId")
      values (gen_random_uuid()::text,p_business_id,v_material_id,'PURCHASE',v_quantity,v_balance,v_line_total,'PURCHASE',v_purchase_id);
    v_items:=v_items||jsonb_build_array(v_item_result);
  end loop;
  v_total:=round(v_total::numeric,2)::double precision;
  insert into "Purchase" (id,"businessId","supplierId",number,date,total,notes,source)
    values (v_purchase_id,p_business_id,v_supplier_id,v_purchase_number,coalesce(p_date,current_date),v_total,p_notes,coalesce(nullif(p_source,''),'MANUAL')::"PurchaseSource");
  insert into "PurchaseItem" (id,"purchaseId","materialId",name,unit,quantity,"unitPrice","lineTotal")
    select item->>'id',v_purchase_id,item->>'materialId',item->>'name',(item->>'unit')::"Unit",
      (item->>'quantity')::double precision,(item->>'unitPrice')::double precision,(item->>'lineTotal')::double precision
    from jsonb_array_elements(v_items) as item;
  return jsonb_build_object('id',v_purchase_id,'number',v_purchase_number,
    'supplier',case when v_supplier_id is null then null else (select jsonb_build_object('id',id,'name',name,'phone',phone) from "Supplier" where id=v_supplier_id) end,
    'date',coalesce(p_date,current_date)::timestamp,'total',v_total,'notes',p_notes,
    'source',coalesce(nullif(p_source,''),'MANUAL'),'items',v_items);
end;
$$;
revoke all on function public.create_purchase_with_inventory(text,text,text,date,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_purchase_with_inventory(text,text,text,date,text,text,jsonb) to service_role;