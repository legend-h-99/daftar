"""Build the reference database schema from the Supabase SQL migrations.

The Supabase SQL migrations are the schema source of truth (AgDR-0004).
supabase/migrations/ starts on 2026-10-01 and assumes the tables created
before that date, so this script replays the earlier history first:

1. Local stand-ins for the Supabase roles and auth.uid().
2. supabase/migrations_from_prod/ before 2026-10-01 (byte-for-byte copies
   of what production recorded).
3. The known production drift that no recorded migration holds (the
   User email/password columns and two Prisma-era tables).
4. Every file in supabase/migrations/, in name order.

This is the same sequence tests/red-team/bootstrap-audit.py uses, without
its legacy test rows and with the payment ledger always applied.

Usage: DATABASE_URL=postgresql://...@localhost/<empty db> python3 scripts/db/build-schema.py

The target must be a local, empty database. The script refuses any other.
"""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
PROD = ROOT / 'supabase' / 'migrations_from_prod'
SUPABASE = ROOT / 'supabase' / 'migrations'
PRISMA = ROOT / 'apps' / 'api' / 'prisma' / 'migrations'
# From this date on, supabase/migrations/ is replayed instead of
# migrations_from_prod/. Two production entries after it have empty
# statements and cannot be replayed (see migrations_from_prod/README.md).
FIRST_SUPABASE_ONLY = '20261001'

ROLES = '''DO $$ BEGIN
IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;'''

# Columns production has on these tables but no recorded migration adds.
# Kept identical to tests/red-team/bootstrap-audit.py.
PRODUCTION_DRIFT = '''ALTER TABLE "User" ADD COLUMN "emailVerified" boolean DEFAULT false,
  ADD COLUMN "passwordHash" text, ADD COLUMN "updatedAt" timestamp DEFAULT now();
ALTER TABLE "Material" ADD COLUMN "updatedAt" timestamp DEFAULT now();
ALTER TABLE "RecipeItem" ADD COLUMN "updatedAt" timestamp DEFAULT now();'''


def database_url() -> str:
    url = os.environ.get('DATABASE_URL', '')
    host = urlsplit(url).hostname
    if host not in ('localhost', '127.0.0.1'):
        sys.exit('build-schema: DATABASE_URL must point at a local database, got host %r' % host)
    return url


def run_sql(url: str, sql: str, label: str) -> None:
    pg_bin = os.environ.get('PG_BIN', '')
    psql = (pg_bin.rstrip('/') + '/psql') if pg_bin else 'psql'
    result = subprocess.run(
        [psql, url, '-X', '-v', 'ON_ERROR_STOP=1', '-q'],
        input=sql, text=True, capture_output=True,
    )
    if result.returncode:
        sys.exit('build-schema: %s failed\n%s' % (label, result.stderr))
    print(label)


def require_empty(url: str) -> None:
    pg_bin = os.environ.get('PG_BIN', '')
    psql = (pg_bin.rstrip('/') + '/psql') if pg_bin else 'psql'
    result = subprocess.run(
        [psql, url, '-X', '-At', '-c',
         "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"],
        text=True, capture_output=True,
    )
    if result.returncode:
        sys.exit('build-schema: cannot connect\n%s' % result.stderr)
    if result.stdout.strip() != '0':
        sys.exit('build-schema: the public schema is not empty. Use a fresh database.')


def main() -> None:
    url = database_url()
    require_empty(url)
    run_sql(url, ROLES, 'local Supabase roles')

    prod = sorted(PROD.glob('*.sql'))
    for path in prod:
        if path.name < '20260831':
            run_sql(url, path.read_text(), path.name)

    run_sql(url, PRODUCTION_DRIFT, 'known production drift')
    email = (PRISMA / '20260830124017_add_email_auth' / 'migration.sql').read_text()
    run_sql(url, email[email.index('-- CreateTable'):], 'EmailVerification table')
    run_sql(url, (PRISMA / '20260923150000_add_password_reset' / 'migration.sql').read_text(),
            'PasswordReset table')

    for path in prod:
        if '20260831' <= path.name < FIRST_SUPABASE_ONLY:
            run_sql(url, path.read_text(), path.name)

    for path in sorted(SUPABASE.glob('*.sql')):
        run_sql(url, path.read_text(), path.name)


if __name__ == '__main__':
    main()
