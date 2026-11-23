"""Build the reference database schema from the Supabase SQL migrations.

The Supabase SQL migrations are the schema source of truth (AgDR-0004).
supabase/migrations/ starts on 2026-10-01 and assumes the tables created
before that date, so this script replays the earlier history first:

1. Local stand-ins for the Supabase roles and auth.uid().
2. supabase/migrations_from_prod/ before 2026-10-01 (byte-for-byte copies
   of what production recorded).
3. The known production drift that no recorded migration holds (the
   User email/password columns and two Prisma-era tables).
4. Every file in supabase/migrations/, in name order. A local stand-in
   replaces pg_cron when the server does not ship it (plain Postgres in CI).

This is the same sequence tests/red-team/bootstrap-audit.py uses, without
its legacy test rows and with the payment ledger always applied.

Usage: DATABASE_URL=postgresql://...@localhost/<empty db> python3 scripts/db/build-schema.py

The target must be a local, empty database. The script refuses any other.
"""
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

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


# Supabase ships pg_cron. Plain Postgres (CI, local) does not, so the
# extension statement is dropped and this stand-in records the schedules.
# The drift check compares the public schema only, so the stand-in has no
# effect on its result.
CRON_EXTENSION = 'create extension if not exists pg_cron;'
CRON_STUB = '''CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (jobid bigserial PRIMARY KEY, jobname text, schedule text, command text);
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint
  LANGUAGE sql AS $$ INSERT INTO cron.job (jobname, schedule, command) VALUES (job_name, schedule, command) RETURNING jobid $$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_name text) RETURNS boolean
  LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobname = job_name RETURNING true $$;'''


def database_env() -> dict:
    """Return the psql environment for the local database in DATABASE_URL.

    The connection goes to psql through PG* variables, not the command
    line, so other local users cannot read the password from the process
    list.
    """
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        sys.exit('build-schema: set DATABASE_URL to an empty local database '
                 '(it is not read from apps/api/.env)')
    parts = urlsplit(url)
    # libpq lets query parameters override the host named in the URL.
    overrides = {'host', 'hostaddr', 'service'} & set(parse_qs(parts.query))
    if overrides:
        sys.exit('build-schema: DATABASE_URL must not set %s in its query string'
                 % ', '.join(sorted(overrides)))
    if parts.hostname not in ('localhost', '127.0.0.1'):
        sys.exit('build-schema: DATABASE_URL must point at a local database, got host %r'
                 % parts.hostname)
    env = {k: v for k, v in os.environ.items()
           if k not in ('DATABASE_URL', 'PGSERVICE', 'PGHOSTADDR', 'PGSERVICEFILE')}
    env.update({
        'PGHOST': parts.hostname,
        'PGPORT': str(parts.port or 5432),
        'PGDATABASE': unquote(parts.path.lstrip('/')),
        'PGUSER': unquote(parts.username or ''),
        'PGPASSWORD': unquote(parts.password or ''),
    })
    return env


def run_sql(env: dict, sql: str, label: str) -> None:
    pg_bin = os.environ.get('PG_BIN', '')
    psql = (pg_bin.rstrip('/') + '/psql') if pg_bin else 'psql'
    result = subprocess.run(
        [psql, '-X', '-v', 'ON_ERROR_STOP=1', '-q'],
        input=sql, text=True, capture_output=True, env=env,
    )
    if result.returncode:
        sys.exit('build-schema: %s failed\n%s' % (label, result.stderr))
    print(label)


def require_empty(env: dict) -> None:
    pg_bin = os.environ.get('PG_BIN', '')
    psql = (pg_bin.rstrip('/') + '/psql') if pg_bin else 'psql'
    result = subprocess.run(
        [psql, '-X', '-At', '-c',
         "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"],
        text=True, capture_output=True, env=env,
    )
    if result.returncode:
        sys.exit('build-schema: cannot connect\n%s' % result.stderr)
    if result.stdout.strip() != '0':
        sys.exit('build-schema: the public schema is not empty. Use a fresh database.')


def has_extension(env: dict, name: str) -> bool:
    pg_bin = os.environ.get('PG_BIN', '')
    psql = (pg_bin.rstrip('/') + '/psql') if pg_bin else 'psql'
    result = subprocess.run(
        [psql, '-X', '-At', '-c',
         "SELECT count(*) FROM pg_available_extensions WHERE name = '%s'" % name],
        text=True, capture_output=True, env=env,
    )
    return result.returncode == 0 and result.stdout.strip() == '1'


def main() -> None:
    env = database_env()
    require_empty(env)
    run_sql(env, ROLES, 'local Supabase roles')

    prod = sorted(PROD.glob('*.sql'))
    for path in prod:
        if path.name < '20260831':
            run_sql(env, path.read_text(), path.name)

    run_sql(env, PRODUCTION_DRIFT, 'known production drift')
    email = (PRISMA / '20260830124017_add_email_auth' / 'migration.sql').read_text()
    run_sql(env, email[email.index('-- CreateTable'):], 'EmailVerification table')
    run_sql(env, (PRISMA / '20260923150000_add_password_reset' / 'migration.sql').read_text(),
            'PasswordReset table')

    for path in prod:
        if '20260831' <= path.name < FIRST_SUPABASE_ONLY:
            run_sql(env, path.read_text(), path.name)

    cron_stubbed = False
    for path in sorted(SUPABASE.glob('*.sql')):
        sql = path.read_text()
        if CRON_EXTENSION in sql.lower() and not has_extension(env, 'pg_cron'):
            if not cron_stubbed:
                run_sql(env, CRON_STUB, 'local pg_cron stand-in')
                cron_stubbed = True
            sql = re.sub(re.escape(CRON_EXTENSION), '-- pg_cron not available locally: stand-in used',
                         sql, flags=re.IGNORECASE)
        run_sql(env, sql, path.name)


if __name__ == '__main__':
    main()
