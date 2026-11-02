"""Dump and restore synthetic audit data in the same LOCAL PostgreSQL cluster."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.parse import urlsplit,urlunsplit
import uuid

source=os.environ['AUDIT_DATABASE_URL']
u=urlsplit(source)
assert u.hostname in ('127.0.0.1','localhost') and 'audit' in u.path
pg=Path(os.environ.get('PG_BIN',''))
def tool(name):return str(pg/name) if str(pg)!='.' else name
destination=urlunsplit((u.scheme,u.netloc,'/daftar_audit_restore_'+uuid.uuid4().hex[:8],'',''))
out=Path(os.environ.get('AUDIT_BACKUP_DIR','audit-backup'));out.mkdir(exist_ok=True)
dump=out/'synthetic-audit.dump'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True);assert p.returncode==0,p.stderr;return p.stdout.strip()
def query(db,sql):return run([tool('psql'),db,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql])
def fingerprints(db):
 tables=query(db,"select tablename from pg_tables where schemaname='public' order by tablename").splitlines()
 return {t:query(db,'select md5(coalesce(string_agg(to_jsonb(t)::text,\'\' order by to_jsonb(t)::text),\'\')) from public."'+t.replace('"','""')+'" t') for t in tables}
start=time.monotonic()
run([tool('pg_dump'),source,'-Fc','-f',str(dump)])
run([tool('createdb'),'--maintenance-db',source,urlsplit(destination).path.lstrip('/')])
run([tool('pg_restore'),'--exit-on-error','--dbname',destination,str(dump)])
original=fingerprints(source);restored=fingerprints(destination)
assert original==restored,'Restored financial data differs'
result={'scope':'Synthetic local database; this does not validate a production backup','tables_matched':len(original),'elapsed_seconds':round(time.monotonic()-start,3),'sha256':hashlib.sha256(dump.read_bytes()).hexdigest(),'all_table_fingerprints_match':True}
(out/'restore-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
