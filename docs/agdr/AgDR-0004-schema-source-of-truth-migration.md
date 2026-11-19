---
id: AgDR-0004
timestamp: 2026-11-18T13:30:00Z
agent: claude-code
model: claude-opus-5-5
session: e38f69b7-5085-46e2-a3fe-51a2c42d1e07
trigger: user-prompt
status: executed
category: architecture
projects: [daftar1]
---

# Supabase SQL migrations are the schema source of truth

> In the context of #74, facing a Prisma schema that no longer matches the production database, I decided to make the Supabase SQL migrations the schema source of truth, mirror them in `schema.prisma`, and fail CI on drift, to make CI test the schema production runs, accepting that Prisma's own migrations are frozen and that the drift check cannot see RLS, check constraints, partial indexes or SQL functions.

**Migration type**: orm (schema of record). No SQL is applied to any database.
**Affected tables / entities**: every table in `apps/api/prisma/schema.prisma`. Seven tables are added to it: `InvoicePayment`, `OperationRequest`, `AdminAuditLog`, `ApiErrorEvent`, `AuthRateLimit`, `ExternalUsageBudget`, `ProductAnalyticsEvent`.
**Estimated downtime**: none. Production is not touched.
**Data volume**: not applicable. No data moves.
**Target environment(s)**: dev and CI only.

## Context

- Production runs on Supabase. Its schema comes from `supabase/migrations/` (24 files, from 2026-10-01) on top of the earlier history recorded in `supabase/migrations_from_prod/`.
- `apps/api` uses Prisma. Its 13 migrations stop at 2026-09-23. CI `scale-tests` built its database with `prisma migrate deploy`, so it tested a schema production does not have.
- On 2026-11-18 I built the schema from the SQL migrations in a local PostgreSQL 17 and compared it with `schema.prisma` using `prisma migrate diff`. The differences:
  - 7 production tables were missing from Prisma (the list above).
  - `Invoice`, `InvoiceItem` and `Purchase` lacked 7 production columns (`idempotencyKey`, `idempotencyHash`, `voidedAt`, `position`, `inventoryBefore`, `inventoryAfter`).
  - `User`: production has `googleId`; Prisma had `googleSub` and `avatarUrl`, which production does not have. The Supabase function reads `googleId`.
  - `User.email`: production enforces uniqueness with a partial index (`WHERE email IS NOT NULL`). Prisma declared a plain unique index.
  - `StockMovement.refType` is `text` in production and was an enum in Prisma.
  - 5 indexes and several nullability and timestamp-type details differed.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Supabase SQL is the source of truth; `schema.prisma` mirrors it; CI fails on drift | Matches what production runs. SQL can express RLS, functions and check constraints. | `apps/api` must follow production names (`googleId`). Prisma migrations are frozen. The drift check compares only what Prisma can model. |
| Prisma is the source of truth; generate SQL for Supabase | One ORM-driven workflow. | Prisma cannot express RLS, policies, SQL functions or partial indexes, which production depends on. Hand-written SQL would still be needed, so there would be two sources. |
| Keep both; fail CI only on new drift against a saved snapshot | Small change. No `apps/api` code change. | Leaves today's drift in place. CI keeps testing an old schema. |

## Decision

Chosen: **Supabase SQL is the source of truth**, because production already runs from it and only SQL can express the RLS and function-based logic the product relies on.

What this PR does:

- `scripts/db/build-schema.py` builds the reference schema in an empty local database: Supabase role stand-ins, `migrations_from_prod/` before 2026-10-01, the known production drift, then every file in `supabase/migrations/`. It refuses a non-local or non-empty database.
- `scripts/db/check-schema-drift.sh` runs the builder, then `prisma migrate diff --exit-code` against `schema.prisma`. It exits 1 on any difference.
- CI `scale-tests` runs the drift check, then seeds and tests against that same database, instead of `prisma migrate deploy`.
- `schema.prisma` now matches the built schema. `apps/api` uses `googleId`, drops `avatarUrl`, and looks users up by email with `findFirst`.
- `apps/api/prisma/migrations/` is frozen. Two of its files are still read by the builder for tables production has but no recorded Supabase migration creates.
- `supabase/migrations_from_prod/` stays as a read-only record of production history. The builder replays it for the years before `supabase/migrations/` begins. This settles the third acceptance criterion of #74.

How to change the schema from now on: add a file to `supabase/migrations/`, update `schema.prisma` to match, and run `scripts/db/check-schema-drift.sh`.

## Rollback Plan

1. Revert the PR's merge commit on `main`.
2. Nothing else. No database was changed, so there is no data to restore.

**Rollback tested against**: not needed beyond `git revert`. The change touches code, CI and docs only.
**Rollback window**: unlimited.

## Cross-Service Consumers

- **Supabase Edge Function `api`** (production backend): unchanged. It already uses the production column names.
- **`apps/api` (NestJS)**: dev and test backend, plus the manual legacy Koyeb image. Its Prisma client now matches production. Google sign-in writes `googleId` instead of `googleSub` and no longer stores the avatar URL.
- **`apps/api/Dockerfile` (manual legacy Koyeb deploy)**: ran `prisma migrate deploy`, which would now build a schema the new client does not match. It now runs `prisma db push`, which applies `schema.prisma` and refuses changes that would lose data. `db push` cannot create the partial unique indexes on `User.email` and `User.googleId`, so the image then runs `prisma/legacy-unique-indexes.sql`. Without them, concurrent sign-ups could create duplicate users that email lookups would then pick between arbitrarily.
- **CI `financial-integrity`**: unchanged. `tests/red-team/bootstrap-audit.py` keeps its own copy of the build sequence plus legacy test rows.
- **`apps/web` and `apps/mobile`**: none. They call the HTTP API only.

Deploy-order constraint: none.

## Testing Plan

- **Dev smoke**: `DATABASE_URL=postgresql://postgres@127.0.0.1:55432/<empty db> scripts/db/check-schema-drift.sh` exits 0 on this branch and 1 on `main`'s `schema.prisma`.
- **CI**: the `scale-tests` job runs the drift check, `db:seed:scale` and `test:scale` against the SQL-built database.
- **Staging verify**: not applicable; no staging database is changed.

## Observability

- **During apply**: not applicable.
- **Post-apply**: the `scale-tests` job log shows `schema drift check: schema.prisma matches the SQL migrations`.

## Consequences

- CI tests `apps/api` against the schema production runs.
- A schema change that lands in SQL without a matching `schema.prisma` edit, or the reverse, fails CI.
- The drift check cannot see RLS policies, check constraints, partial indexes, triggers or SQL functions. Review covers those.
- The built schema reproduces production from its migration history plus a hand-written fixture for columns no recorded migration adds. It may still differ from production in places the history does not show. A `supabase db dump --schema public` of production would confirm it; that needs production access and is not done here.
- The build sequence exists twice: in `scripts/db/build-schema.py` and in `tests/red-team/bootstrap-audit.py`. A change to one should be made in the other.

## Artifacts

- Ticket: legend-h-99/daftar#74
- Commits / PRs: filled in when the PR opens.
