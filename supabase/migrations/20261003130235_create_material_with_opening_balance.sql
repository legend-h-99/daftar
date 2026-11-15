-- Save manual inventory additions and their opening ledger entry atomically.
create or replace function public.create_material_with_opening_balance(
  p_business_id text,
  p_material_id text,
  p_body jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public."Material"%rowtype;
  v_price double precision := (p_body->>'purchasePrice')::double precision;
  v_qty double precision := (p_body->>'purchaseQty')::double precision;
  v_initial double precision := coalesce((p_body->>'initialQty')::double precision, 0);
  v_vat double precision := coalesce((p_body->>'vatRate')::double precision, 0);
  v_reorder double precision := (p_body->>'reorderLevel')::double precision;
begin
  if nullif(btrim(p_body->>'name'), '') is null or
     v_price is null or not (v_price >= 0 and v_price < 'Infinity'::double precision) or
     v_qty is null or not (v_qty > 0 and v_qty < 'Infinity'::double precision) or
     not (v_initial >= 0 and v_initial < 'Infinity'::double precision) or
     not (v_vat >= 0 and v_vat <= 100) or
     (v_reorder is not null and not (v_reorder >= 0 and v_reorder < 'Infinity'::double precision)) then
    raise exception 'Invalid material';
  end if;

  insert into public."Material" (
    "id", "businessId", "name", "unit", "purchasePrice", "purchaseQty",
    "unitPrice", "vatRate", "stockQty", "reorderLevel", "updatedAt"
  ) values (
    p_material_id, p_business_id, btrim(p_body->>'name'), (p_body->>'unit')::public."Unit",
    v_price, v_qty, v_price / v_qty, v_vat, v_initial, v_reorder, current_timestamp
  ) returning * into v_material;

  if v_initial > 0 then
    insert into public."StockMovement" (
      "id", "businessId", "materialId", "type", "qty", "balanceAfter", "note"
    ) values (
      gen_random_uuid()::text, p_business_id, p_material_id, 'ADJUSTMENT',
      v_initial, v_initial, 'رصيد افتتاحي'
    );
  end if;
  return to_jsonb(v_material);
end;
$$;

revoke all on function public.create_material_with_opening_balance(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_material_with_opening_balance(text,text,jsonb) to service_role;
