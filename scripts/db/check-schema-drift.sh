#!/usr/bin/env bash
# Fail when apps/api/prisma/schema.prisma differs from the schema the
# Supabase SQL migrations build (AgDR-0004).
#
# Usage: DATABASE_URL=postgresql://...@localhost/<empty db> scripts/db/check-schema-drift.sh
#
# The database must be local and empty. It is left holding the built schema,
# so a later CI step can run tests against it.
#
# Limit: prisma migrate diff compares tables, columns, types, defaults,
# primary and foreign keys, unique constraints and plain indexes. It does not
# see RLS policies, check constraints, partial indexes, triggers or SQL
# functions.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"

python3 "$root/scripts/db/build-schema.py"

cd "$root/apps/api"
set +e
pnpm exec prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  --exit-code
status=$?
set -e

case "$status" in
  0)
    echo "schema drift check: schema.prisma matches the SQL migrations"
    ;;
  2)
    echo "schema drift check FAILED: schema.prisma differs from the SQL migrations." >&2
    echo "The SQL above would turn the migrated database into schema.prisma." >&2
    echo "Fix schema.prisma to match supabase/migrations/ (the source of truth)." >&2
    exit 1
    ;;
  *)
    echo "schema drift check: prisma migrate diff failed with exit code $status" >&2
    exit "$status"
    ;;
esac
