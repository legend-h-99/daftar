BEGIN;
CREATE FUNCTION public.export_business_data(p_business_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
'formatVersion',1,
'exportedAt',clock_timestamp(),
'business',(select to_jsonb(b) from public."Business" b where b.id=p_business_id),
'Material',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Material" r where r."businessId"=p_business_id),
'Product',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Product" r where r."businessId"=p_business_id),
'Customer',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Customer" r where r."businessId"=p_business_id),
'Supplier',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Supplier" r where r."businessId"=p_business_id),
'Invoice',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Invoice" r where r."businessId"=p_business_id),
'Purchase',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Purchase" r where r."businessId"=p_business_id),
'Expense',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."Expense" r where r."businessId"=p_business_id),
'StockMovement',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."StockMovement" r where r."businessId"=p_business_id),
'InvoicePayment',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."InvoicePayment" r where r."businessId"=p_business_id),
'RecipeItem',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."RecipeItem" r join public."Product" p on p.id=r."productId" where p."businessId"=p_business_id),
'InvoiceItem',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."InvoiceItem" r join public."Invoice" p on p.id=r."invoiceId" where p."businessId"=p_business_id),
'PurchaseItem',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public."PurchaseItem" r join public."Purchase" p on p.id=r."purchaseId" where p."businessId"=p_business_id));
$$;
REVOKE ALL ON FUNCTION public.export_business_data(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.export_business_data(text) TO service_role;
COMMIT;
