# Migrations as recorded in production

Source: `supabase_migrations.schema_migrations` of project `nklcbcpkycrhuumpbksb` (read-only), 2026-10-07.
25 of the 27 recorded migrations are here, **byte-for-byte** (md5 of each file equals md5 of the stored statement).

## Recorded with empty statements in production
`20261003153110_review_findings` and `20261004132159_admin_support` have no stored SQL in production's history.
Their source now exists on `main` as `supabase/migrations/20261003120000_review_findings.sql` and
`supabase/migrations/20261004090000_admin_support.sql`; compare those with the live schema before trusting them.

## Differences from `supabase/migrations/`
- Missing there: the first 12 migrations (init through `deny_rate_limit_clients_20260916`) and `invoice_idempotency_key`.
- Different timestamps (same SQL): `reject_invoice_insufficient_stock`, `invoice_paid_amount_atomic`,
  `create_material_with_opening_balance`.
- Different SQL: `create_purchase_with_inventory`, `fix_required_timestamps`, `enable_rls_on_application_tables`,
  `grant_api_service_role_access`, `reconcile_stage_schema_drift`.
- Only in `supabase/migrations/`, not applied in production: `20261007090000_invoice_payment_ledger.sql`.

Nothing in `supabase/migrations/` was modified. Decide how to reconcile before relying on either folder to rebuild a database.
