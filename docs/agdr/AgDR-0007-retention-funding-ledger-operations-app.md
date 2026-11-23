---
id: AgDR-0007
timestamp: 2026-11-23T11:00:00Z
agent: claude-code
model: claude-opus-5-5
session: f33ab127-7347-48d6-b3dd-4cd5ee89d4f1
trigger: code-review
status: executed
category: architecture
projects: [daftar1]
---

# pg_cron retention, the funding ledger, and the operations app

> In the context of the security hardening branch merged by PR #98, facing three structural additions made without a decision record, I recorded them here: retention moves to a `pg_cron` job, owner funding gets its own append-only `FundingEntry` ledger, and internal operations run as a separate `apps/operations` service. Each accepts a new dependency or surface in exchange for keeping it out of the customer request path.

This record was written on 2026-11-23 from the commits that introduced each item (`d74abeb`, `ca8aadb`, `36567b8`). The options below are reconstructed from those commits and the code. The original authors did not leave a comparison. Rex asked for this record in the review of PR #98.

## Context

- Retention deletes for `ProductAnalyticsEvent` and `ApiErrorEvent` ran inside `admin_overview`, `product_analytics_summary` and `record_product_event`. A read or an event write could then delete rows (#56).
- Owner contributions, loans, withdrawals and repayments had no home. Recording them as sales or expenses would distort profit and cost of goods sold.
- Internal operations work (metrics, support triage, agent runs) needed its own interface and credentials, apart from the customer app.

## Options Considered

| Topic | Option | Pros | Cons |
|-------|--------|------|------|
| Retention | `pg_cron` job daily at 03:17 (chosen) | Reads and writes stop deleting. One place for retention | Depends on `pg_cron`, which plain Postgres lacks |
| Retention | Keep deletes inside functions | No new extension | Side effects on reads, as #56 reports |
| Retention | External scheduler calling an endpoint | No extension | Another credentialed caller and another moving part |
| Funding | Separate append-only `FundingEntry` table (chosen) | Funding stays out of sales, COGS and profit. Corrections are opposite entries | A new table, grants and an export change |
| Funding | Reuse expenses or invoices with a type flag | No schema change | Every report must filter it out, and one miss distorts profit |
| Operations | Separate `apps/operations` Next.js app with its own auth (chosen) | No admin code in the customer bundle. Its own credentials | A second app to secure, deploy and keep current |
| Operations | Admin pages inside `apps/web` | One deploy | Admin code and privileges ship next to the customer app |

## Decision

- Migration `20261115204123_move_retention_out_of_reads.sql` removes the deletes from the three functions and schedules `daftar-retention-analytics-errors` with `pg_cron`. It deletes analytics and error rows older than 30 days. `scripts/db/build-schema.py` stubs `pg_cron` on plain Postgres, so the drift check still runs in CI.
- `FundingEntry` holds `OWNER_CONTRIBUTION`, `LOAN`, `OWNER_WITHDRAWAL` and `LOAN_REPAYMENT` with a positive amount and a `requestId` unique per business for idempotency. `service_role` gets `SELECT` and `INSERT` only. `export_business_data` now includes funding entries.
- `apps/operations` is a standalone workspace app on port 3100 with its own auth, engine and worker, plus an `operations-metrics` Edge function and its migration.

## Consequences

- Production needs `pg_cron` enabled before the retention migration applies. Supabase ships it.
- Funding corrections are new opposite entries, never edits. The audit trail is the table itself.
- `apps/operations` has had only a skim in the review of PR #98. It needs a security review before it is deployed anywhere reachable.
- Each item adds maintenance: one extension, one table, one app.

## Artifacts

- Tickets: https://github.com/legend-h-99/daftar/issues/56
- PR: https://github.com/legend-h-99/daftar/pull/98
