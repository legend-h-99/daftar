-- Keep production SQL aggregates while separating sales from collections.
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
    'totalSales', (select coalesce(sum(total),0) from inv),
    'totalPurchases', (select coalesce(sum(coalesce(total,0)),0) from "Purchase" where "businessId"=p_business_id
      and (p_start_date is null or date>=p_start_date) and (p_end_date is null or date<p_end_date)),
    'operatingExpenses', (select coalesce(sum(amount),0) from "Expense" where "businessId"=p_business_id
      and (p_start_date is null or date>=p_start_date) and (p_end_date is null or date<p_end_date)),
    -- Historical movement cost; only legacy movements fall back to the current price.
    'costOfGoodsSold', (select coalesce(sum(coalesce(s."costAmount", abs(s.qty)*coalesce(m."unitPrice",0))),0)
      from "StockMovement" s left join "Material" m on m.id=s."materialId"
      where s."businessId"=p_business_id and s.type='SALE'
        and (p_start is null or s."createdAt">=p_start) and (p_end is null or s."createdAt"<p_end)),
    'costEstimated', exists(select 1 from "StockMovement" where "businessId"=p_business_id and type='SALE' and "costAmount" is null and (p_start is null or "createdAt">=p_start) and (p_end is null or "createdAt"<p_end)),
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
