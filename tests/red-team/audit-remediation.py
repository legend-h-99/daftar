"""Financial regression tests against a disposable LOCAL PostgreSQL database.

Set AUDIT_DATABASE_URL to an already bootstrapped local database whose name
contains 'audit'. This script inserts synthetic records; it refuses remote DBs.
No dependency beyond Python and PostgreSQL command-line tools is required.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlsplit
import uuid

url = os.environ['AUDIT_DATABASE_URL']
parsed = urlsplit(url)
assert parsed.hostname in ('127.0.0.1', 'localhost'), 'Local database required'
assert 'audit' in parsed.path, 'Disposable audit database required'
pgbin = os.environ.get('PG_BIN', '')
psql = str(Path(pgbin) / 'psql') if pgbin else 'psql'
results = []

def execute(sql, fail=False):
    p = subprocess.run([psql,url,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],text=True,capture_output=True)
    if fail:
        assert p.returncode != 0, 'Expected rejection: '+sql[:100]
        return p.stderr
    assert p.returncode == 0, p.stderr
    return p.stdout.strip()

def literal(value):
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (int,float)): return str(value)
    return "'"+str(value).replace("'","''")+"'"

def rpc(name,*args,fail=False):
    raw=execute('select to_jsonb(public.'+name+'('+','.join(literal(x) for x in args)+'))',fail=fail)
    return raw if fail else json.loads(raw)

def check(name,fn):
    fn(); results.append({'name':name,'status':'PASS'}); print('PASS '+name)

def same(value,expected): assert value==expected,(value,expected)

prefix=uuid.uuid4().hex[:10]
a,b='audit-a-'+prefix,'audit-b-'+prefix
execute('insert into "Business"(id,name,"updatedAt","vatEnabled") values '+','.join('('+','.join(map(literal,row))+')' for row in [(a,'Synthetic A','2026-11-03',True),(b,'Synthetic B','2026-11-03',False)]))
ma,mb='material-a-'+prefix,'material-b-'+prefix
rpc('create_material_with_opening_balance',a,ma,json.dumps({'name':'Synthetic ingredient','unit':'PIECE','purchasePrice':60,'purchaseQty':1,'initialQty':1}))
rpc('create_material_with_opening_balance',b,mb,json.dumps({'name':'Other ingredient','unit':'PIECE','purchasePrice':2,'purchaseQty':1,'initialQty':1}))
recipe=json.dumps([{'materialId':ma,'name':'Synthetic ingredient','unit':'PIECE','quantityUsed':1,'type':'RAW'}])
product=rpc('save_product_with_recipe',a,None,'Synthetic dish',None,0,30,recipe)
pid=product['id']
customer_b='customer-b-'+prefix
execute(f'insert into "Customer"(id,"businessId",name) values({literal(customer_b)},{literal(b)},\'Other customer\')')
item=json.dumps([{'productId':pid,'name':'Synthetic dish','unitPrice':100,'quantity':1}])
check('foreign customer rejected before invoice writes',lambda: rpc('create_invoice_with_inventory',a,customer_b,'UNPAID',None,None,item,'cross-'+prefix,fail=True))
check('foreign recipe material rejected',lambda: rpc('save_product_with_recipe',a,None,'Bad',None,0,30,json.dumps([{'materialId':mb,'name':'Other','unit':'PIECE','quantityUsed':1,'type':'RAW'}]),fail=True))

def concurrent_last_stock():
    def create(i):
        try: return rpc('create_invoice_with_inventory',a,None,'UNPAID',None,None,item,'stock-'+prefix+str(i))
        except AssertionError: return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool: rows=list(pool.map(create,[1,2]))
    same(sum(x is not None for x in rows),1)
    same(float(execute(f'select "stockQty" from "Material" where id={literal(ma)}')),0)
    same(int(execute(f'select count(*) from "Invoice" where "businessId"={literal(a)}')),1)
    return next(x for x in rows if x)
invoice=concurrent_last_stock();iid=invoice['id']
results.append({'name':'concurrent last-stock sale: one success, one rollback','status':'PASS'})
execute(f'insert into "Expense"(id,"businessId",category,amount,date) values({literal("expense-"+prefix)},{literal(a)},\'OTHER\',10,current_date)')
check('profit excludes output VAT: 100 - 60 - 10 = 30',lambda: same((lambda s:s['totalSales']-s['costOfGoodsSold']-s['operatingExpenses'])(rpc('dashboard_summary',a)),30))
check('invoice replay creates no extra stock or invoice',lambda: same(rpc('create_invoice_with_inventory',a,None,'UNPAID',None,None,item,'stock-'+prefix+('1' if execute(f'select "idempotencyKey" from "Invoice" where id={literal(iid)}').endswith('1') else '2'))['id'],iid))
check('payment writes journal amount once',lambda: same(rpc('set_invoice_payment',a,iid,'PAID',115,0)['paidAmount'],115))
check('stale payment write rejected',lambda: rpc('set_invoice_payment',a,iid,'PARTIAL',10,0,fail=True))
check('payment journal is present and matches collected cash',lambda: same(float(execute(f'select sum(amount) from "InvoicePayment" where "invoiceId"={literal(iid)}')),115))
check('foreign invoice payment rejected',lambda: rpc('set_invoice_payment',b,iid,'PAID',115,None,fail=True))
check('cancel paid invoice without deleting journal',lambda: same(rpc('delete_invoice_with_inventory',a,iid),True))
check('cancel twice restores stock only once',lambda: (same(rpc('delete_invoice_with_inventory',a,iid),True),same(float(execute(f'select "stockQty" from "Material" where id={literal(ma)}')),1)))
check('cancelled payment journal nets to zero',lambda: same(float(execute(f'select sum(amount) from "InvoicePayment" where "invoiceId"={literal(iid)}')),0))
check('cancelled invoice excluded from sales and COGS',lambda: (same(rpc('dashboard_summary',a)['totalSales'],0),same(rpc('dashboard_summary',a)['costOfGoodsSold'],0)))

purchase_items=json.dumps([{'materialId':ma,'name':'Synthetic ingredient','unit':'PIECE','quantity':2,'unitPrice':7}])
def concurrent_purchase():
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        rows=list(pool.map(lambda _:rpc('create_purchase_with_inventory',a,None,None,None,'MANUAL',None,purchase_items,'purchase-'+prefix),[1,2]))
    same(rows[0]['id'],rows[1]['id'])
    same(float(execute(f'select "stockQty" from "Material" where id={literal(ma)}')),3)
    return rows[0]
purchase=concurrent_purchase();purid=purchase['id'];results.append({'name':'concurrent purchase retries add inventory once','status':'PASS'})
check('purchase key reused with different body rejected',lambda:rpc('create_purchase_with_inventory',a,None,None,None,'MANUAL','changed',purchase_items,'purchase-'+prefix,fail=True))
check('foreign purchase reversal rejected',lambda:same(rpc('void_purchase_with_inventory',b,purid),False))
check('purchase reversal restores stock and previous price',lambda:(same(rpc('void_purchase_with_inventory',a,purid),True),same(float(execute(f'select "stockQty" from "Material" where id={literal(ma)}')),1),same(float(execute(f'select "unitPrice" from "Material" where id={literal(ma)}')),60)))
check('purchase reversal replay is harmless',lambda:(same(rpc('void_purchase_with_inventory',a,purid),True),same(float(execute(f'select "stockQty" from "Material" where id={literal(ma)}')),1)))
check('reversed purchase excluded from purchase summary',lambda:same(rpc('dashboard_summary',a)['totalPurchases'],0))
check('negative material stock rejected by DB constraint',lambda:execute(f'update "Material" set "stockQty"=-1 where id={literal(ma)}',fail=True))
check('material price recalculates unit cost atomically',lambda:same(rpc('update_material_details',a,ma,json.dumps({'purchasePrice':80}))['unitPrice'],80))
check('RPC rejects direct balance mutation',lambda:rpc('update_material_details',a,ma,json.dumps({'stockQty':99}),fail=True))
check('foreign material update rejected',lambda:rpc('update_material_details',b,ma,json.dumps({'purchasePrice':1}),fail=True))

round_items=json.dumps([{'name':'raw','unit':'PIECE','unitPrice':10.004,'quantityUsed':1,'type':'RAW'},{'name':'pack','unit':'PIECE','unitPrice':2.004,'quantityUsed':1,'type':'PACKAGING'}])
check('database recipe reference rounds to 12.00 and 17.14',lambda:(same(rpc('save_product_with_recipe',a,None,'Rounding',None,0,30,round_items)['totalCost'],12),same(rpc('save_product_with_recipe',a,None,'Rounding 2',None,0,30,round_items)['sellingPrice'],17.14)))
uid='audit-user-'+prefix
execute(f'insert into "User"(id,email) values({literal(uid)},{literal(uid+"@example.invalid")})')
def onboarding_concurrent():
    def go(_):
        try:return rpc('onboard_business',uid,'New business',None,False,None)
        except AssertionError:return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:rows=list(pool.map(go,[1,2]))
    same(sum(x is not None for x in rows),1)
check('concurrent onboarding creates and links only one business',onboarding_concurrent)

export=rpc('export_business_data',a)
check('export contains own records and no other business material',lambda:(same(export['business']['id'],a),same(any(x['id']==mb for x in export['Material']),False),same('passwordHash' in json.dumps(export),False)))
check('anonymous role cannot execute financial RPC',lambda:execute(f'set role anon; select public.export_business_data({literal(a)})',fail=True))
check('authenticated role cannot read business table directly',lambda:execute('set role authenticated; select * from public."Business"',fail=True))

check('legacy paid balance retains one unknown-date entry',lambda:same(execute('select count(*) from "InvoicePayment" where "invoiceId"=\'legacy-audit-invoice\' and source=\'LEGACY_UNDATED\' and "occurredAt" is null'),'1'))

def failed_onboarding_rolls_back():
    user='audit-failing-'+prefix
    execute(f'insert into "User"(id,email) values({literal(user)},{literal(user+"@example.invalid")})')
    count=execute('select count(*) from "Business"')
    execute('''create function public.audit_fail_user_link() returns trigger language plpgsql as $$ begin
      if new.id like 'audit-failing-%' then raise exception 'synthetic link failure'; end if; return new; end $$;
      create trigger audit_fail_user_link before update on "User" for each row execute function public.audit_fail_user_link();''')
    try:
        rpc('onboard_business',user,'Should roll back',None,False,None,fail=True)
        same(execute('select count(*) from "Business"'),count)
    finally:
        execute('drop trigger audit_fail_user_link on "User"; drop function public.audit_fail_user_link()')
check('failed user link rolls back business creation',failed_onboarding_rolls_back)

def consumed_purchase_is_not_reversed():
    row=rpc('create_purchase_with_inventory',a,None,None,None,'MANUAL',None,purchase_items,'consumed-'+prefix)
    rpc('create_invoice_with_inventory',a,None,'UNPAID',None,None,item,'after-purchase-'+prefix)
    stock=execute(f'select "stockQty" from "Material" where id={literal(ma)}')
    rpc('void_purchase_with_inventory',a,row['id'],fail=True)
    same(execute(f'select "stockQty" from "Material" where id={literal(ma)}'),stock)
    same(execute(f'select "voidedAt" is null from "Purchase" where id={literal(row["id"])}'),'t')
check('purchase with later consumption rejects reversal without partial writes',consumed_purchase_is_not_reversed)

execute(f'''insert into "Expense"(id,"businessId",category,amount,date)
 select 'bulk-{prefix}-'||g,{literal(a)},'OTHER',1,current_date from generate_series(1,1201) g''')
check('SQL summary includes all 1201 additional expenses',lambda:same(rpc('dashboard_summary',a)['operatingExpenses'],1211))

def collection_date_is_not_invoice_date():
    free=json.dumps([{'name':'Synthetic dated invoice','quantity':1,'unitPrice':10}])
    row=rpc('create_invoice_with_inventory',a,None,'UNPAID',None,None,free,'dated-'+prefix)
    execute(f'update "Invoice" set "createdAt"=(now() at time zone \'utc\')-interval \'2 months\' where id={literal(row["id"])}')
    rpc('set_invoice_payment',a,row['id'],'PARTIAL',4,0)
    same(execute(f'''select count(*) from "InvoicePayment" p join "Invoice" i on i.id=p."invoiceId"
      where i.id={literal(row['id'])} and p."occurredAt">=date_trunc('month',now())
      and i."createdAt"<date_trunc('month',now())'''),'1')
check('collection date follows payment rather than old invoice date',collection_date_is_not_invoice_date)

def changed_price_is_not_overwritten_by_reversal():
    row=rpc('create_purchase_with_inventory',a,None,None,None,'MANUAL',None,purchase_items,'changed-price-'+prefix)
    rpc('update_material_details',a,ma,json.dumps({'purchasePrice':99}))
    stock=execute(f'select "stockQty" from "Material" where id={literal(ma)}')
    rpc('void_purchase_with_inventory',a,row['id'],fail=True)
    same(execute(f'select "stockQty" from "Material" where id={literal(ma)}'),stock)
    same(float(execute(f'select "purchasePrice" from "Material" where id={literal(ma)}')),99)
check('purchase reversal cannot overwrite a later manual price edit',changed_price_is_not_overwritten_by_reversal)

output=Path(os.environ.get('AUDIT_RESULTS_PATH','audit-db-results.json'))
output.write_text(json.dumps({'scope':'Disposable local PostgreSQL; synthetic records only; no production access','tests':results},indent=2))
print(f'{len(results)} database checks passed')
