# Audit remediation — 3 November 2026

This change prepares the technical repairs from the 2 November audit. It does not claim customer validation, a production restore, tax certification, or a live billing launch.

## Implemented

- F01/F02: generic stock-movement writes are rejected. Material changes use an allowlist and a database function that recalculates unit price; stock changes use the existing atomic adjustment. New database constraints reject negative/nonfinite financial values without rewriting historical records.
- F03: purchases made after this migration have before-images and can be reversed atomically if there have been no later inventory movements. Reversal preserves the purchase and ledger, restores previous prices, and is safe to repeat. Historical purchases without a before-image are refused for automatic reversal and require a reviewed correction.
- F04/F05: profit uses sales before output VAT, independently of collection status. Product preview and NestJS use the database rounding policy. Existing monetary column types remain unchanged; a Decimal conversion is not smuggled into this release.
- F06: web lists traverse 200-row pages, preserving filters; failed later pages reject the entire load. API ordering includes an ID tie-breaker. SQL aggregates are tested with 1201 additional expenses.
- F07: the migration installs the collection journal on production-like databases that do not yet have it, and tolerates the existing proposal where already applied. Legacy paid balances retain unknown collection dates. Invoice cancellation preserves invoice/payment history, restores inventory once, and reverses the paid balance; canceled records are excluded from lists and report aggregates.
- F08/F09: purchase retries use a stable key plus payload fingerprint; concurrent retries create one purchase. Onboarding creates and links the business in one transaction with a user lock.
- F10: authenticated, rate-limited business export includes records and their children in one database snapshot; credentials and other businesses are excluded. The privacy page and reports expose the download. The owner supplied info@daftar1.com for support/privacy requests; it is displayed on login, landing and privacy. Retention durations and an approved manual deletion procedure still require operational acceptance; no retention rule was fabricated.
- F11/F12: future pricing is marked beside the proposed limits. Unmeasured speed claims are removed. Browser print checks cover a long Arabic invoice with 75 lines; physical phone sharing remains a release acceptance task.
- F13/F14: compatible dependency security updates, runtime mobile report validation, and matching report field names. The release-web audit has zero findings. Remaining native-only dependency findings are listed in the delivery notes rather than hidden by the web filter.
- Maintenance mode gates authenticated business operations during a coordinated upgrade, including direct native calls. It does not replace a production backup.
- Cloudflare branch previews are denied API access by default. Configure an isolated staging API before opting in with `DAFTAR_PREVIEW_API_ENABLED=true`; do not review draft financial writes against production.

## Rollout order — requires a verified production backup

1. Record the deployed web/API revisions, function definitions and applied migration IDs. Verify a production backup and restore it to an isolated target; the local synthetic restore performed during development is not this prerequisite.
2. Announce a short maintenance window. Set `MAINTENANCE_MODE=true` for the Edge API before exposing the new code. Deploy the new API while the gate is active. `/auth/me`, sign-out and health remain usable; business operations return an expected 503.
3. Use the two **new** migrations, in order: `20261103010000_audit_financial_integrity.sql`, then `20261103020000_business_data_export.sql`. Do not blindly replay every historical migration: production migration names/timestamps differ, and the old journal proposal is intentionally absorbed by the new migration. The first migration needs the production financial functions from October, including the reviewed invoice-idempotency function.
4. Validate the new NOT VALID constraints against the production snapshot. The read-only aggregate preflight on 3 November found zero rows violating the four new financial checks; recheck under the maintenance window. Do not repair historical amounts automatically if validation fails.
5. Set `PAYMENT_LEDGER_ENABLED=true` only after the journal exists and sums match current paid balances. Unknown-date legacy entries must remain marked incomplete in monthly cash reports.
6. Deploy the matching web build. Verify Google with a named test account, two-business access boundaries, export, a small invoice and its cancellation, a purchase retry, and a real mobile print/share. Avoid tests on customer-owned records.
7. Disable maintenance after acceptance. Monitor errors, journal balances, inventory reconciliation and duplicate-operation conflicts.

Once the journal has accepted writes or cancellation has preserved records, keep the database forward-compatible. A code rollback that ignores `voidedAt` is not a safe general rollback: retain maintenance and deploy a compatible forward fix. Do not drop the journal or restore over newer financial transactions.

## Repeatable local checks

Use a disposable local PostgreSQL 17 database with a name containing `audit`. The scripts refuse remote hostnames. Bootstrap requires an empty database and creates synthetic fixtures plus roles; it is **not a production installer**.

```sh
export AUDIT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/daftar_audit_ci
python3 tests/red-team/bootstrap-audit.py
python3 tests/red-team/audit-remediation.py
python3 tests/red-team/restore-audit.py
```

`AUDIT_BASELINE_LEDGER=true` bootstraps a database that already has the old journal. `PG_BIN` selects a PostgreSQL client directory; dump/restore needs a client compatible with the server version. CI runs the financial checks against both baseline variants.

Also run web/API tests, type checks, web lint, static production build, synthetic release UI checks and session checks. Browser UI tests intercept application API calls and never submit synthetic credentials to production. `UX_SCENARIO` optionally selects one browser scenario for diagnosis.

## Operational work prepared today, with elapsed-time work still pending

The accompanying pilot guide and scorecard prepare recruitment, consent, first-value tasks, D7 follow-up and a 29 SAR price test. Those measurements require actual customers and time. Billing stays disabled until demand and support economics justify it. Support/retention/deletion decisions, verified production restore, physical-phone acceptance and rollout approval are not replaced by passing unit tests.
