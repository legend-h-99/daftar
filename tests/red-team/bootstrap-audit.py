from pathlib import Path
import subprocess
r=Path(__file__).resolve().parents[2]
import os
from urllib.parse import urlsplit
url=os.environ['AUDIT_DATABASE_URL']
u=urlsplit(url)
assert u.hostname in ('127.0.0.1','localhost') and 'audit' in u.path, 'Disposable local audit DB required'
pg=os.environ.get('PG_BIN','')
pg=(pg.rstrip('/')+'/') if pg else ''
def sql(s,label):
 p=subprocess.run([pg+'psql',url,'-X','-v','ON_ERROR_STOP=1','-q'],input=s,text=True,capture_output=True)
 if p.returncode: raise RuntimeError(label+'\n'+p.stderr)
 print(label)
sql('''DO $$ BEGIN
IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres SUPERUSER; END IF;
IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;''','local roles')
prod=sorted((r/'supabase/migrations_from_prod').glob('*.sql'))
for p in prod:
 if p.name<'20260831': sql(p.read_text(),p.name)
sql('''ALTER TABLE "User" ADD COLUMN "emailVerified" boolean DEFAULT false, ADD COLUMN "passwordHash" text, ADD COLUMN "updatedAt" timestamp DEFAULT now();
ALTER TABLE "Material" ADD COLUMN "updatedAt" timestamp DEFAULT now();
ALTER TABLE "RecipeItem" ADD COLUMN "updatedAt" timestamp DEFAULT now();''','known production auth/schema drift fixture')
email=(r/'apps/api/prisma/migrations/20260830124017_add_email_auth/migration.sql').read_text()
sql(email[email.index('-- CreateTable'):],'email table')
sql((r/'apps/api/prisma/migrations/20260923150000_add_password_reset/migration.sql').read_text(),'password reset table')
for p in prod:
 if '20260831'<=p.name<'20261001':sql(p.read_text(),p.name)
sql('''INSERT INTO \"Business\"(id,name,\"updatedAt\") VALUES('legacy-audit-fixture','Synthetic legacy',now());
INSERT INTO \"Invoice\"(id,\"businessId\",number,status,subtotal,total,\"paidAmount\") VALUES('legacy-audit-invoice','legacy-audit-fixture',1,'PAID',10,10,10);''','legacy paid balance before remediation')
for p in sorted((r/'supabase/migrations').glob('*.sql')):
 if p.name<'20261103' and ('invoice_payment_ledger' not in p.name or os.environ.get('AUDIT_BASELINE_LEDGER')=='true'):sql(p.read_text(),p.name)
sql((r/'supabase/migrations/20261103010000_audit_financial_integrity.sql').read_text(),'new remediation migration (production baseline without payment ledger)')

sql((r/'supabase/migrations/20261103020000_business_data_export.sql').read_text(),'business export migration')
