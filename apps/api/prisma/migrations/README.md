# Frozen

These Prisma migrations stopped on 2026-09-23 and no longer match production.
Do not add to them and do not run `prisma migrate dev` or `prisma migrate deploy`.

The schema source of truth is `supabase/migrations/`
([AgDR-0004](../../../../docs/agdr/AgDR-0004-schema-source-of-truth-migration.md)).
Build a local database with `pnpm --filter api db:build`.

Two files here are still read by `scripts/db/build-schema.py` and
`tests/red-team/bootstrap-audit.py`, because production has their tables but no
recorded Supabase migration creates them:

- `20260830124017_add_email_auth/migration.sql` (the `EmailVerification` table)
- `20260923150000_add_password_reset/migration.sql` (the `PasswordReset` table)
