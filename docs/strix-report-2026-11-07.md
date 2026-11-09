# Security Penetration Test Report

**Generated:** 2026-11-07 07:56:40 UTC

# Executive Summary

An authorized white-box security assessment was performed on **Daftar**, an Arabic SMB accounting SaaS built on Supabase Edge Functions (Deno) behind Cloudflare, with a Next.js web frontend. Testing concentrated on the primary REST backend (`supabase/functions/api/index.ts`) and the database layer (RLS policies and `SECURITY DEFINER` functions), with secondary coverage of the web client.

**Overall risk posture: Low to Moderate.** The application is notably well-engineered from a security standpoint and shows evidence of multiple prior hardening review rounds. The highest-value risks tested for — multi-tenant data exposure (IDOR), authentication/JWT bypass, admin takeover, SQL injection, and stored XSS — were **not present**. Tenant isolation, which is the core security invariant for a multi-business accounting product, is enforced consistently and correctly across every endpoint and every database function.

**Key findings (two Medium):**
- **IP-based rate-limit bypass** — per-IP throttles trust client-supplied forwarding headers. If the Supabase Edge Function origin is reachable directly (bypassing Cloudflare), an attacker can rotate those headers to defeat per-IP limits, enabling unauthenticated database write-flooding on the analytics endpoint and loss of the global abuse backstop. Identity-keyed limits are unaffected.
- **Mass assignment in generic CRUD** — the shared create/update handler uses a denylist-only field model, allowing an authenticated user to overwrite server-computed columns on their **own** business (material stock/cost values and fabricated stock-ledger rows), corrupting their own accounting figures. No cross-tenant impact.

**Business impact:** Neither finding exposes another business's data or allows account/admin takeover. The realistic impact is cost/abuse (rate-limit bypass) and self-inflicted books-integrity corruption (mass assignment). Both have straightforward, low-effort remediations with fixes already drafted.

**Remediation theme:** adopt deny-by-default posture at the two boundaries that currently rely on trust — authenticate the Cloudflare→origin hop before trusting forwarding headers, and replace the CRUD field denylist with positive per-table allow-lists.

# Remediation & Verification Status (updated 2026-11-07)

> This section was added after the automated report was generated. Each finding was verified against the live environment and remediated. Commits are on branch `codex/fix-audit-2026-10-17` and pushed to origin.

- **Finding #1 — IP-based rate-limit bypass → FALSE POSITIVE (verified), hardened anyway.** The report's open question ("whether the origin is publicly reachable off-Cloudflare") was answered by inspecting Supabase **edge logs** (233 requests/24h): every request carries Cloudflare-only metadata (`request.cf.city/colo/country/botManagement`, `cf_ray`) and `cf-connecting-ip` is present on **100%** of requests with a real, **per-client** value (5 distinct IPs, 0 empty). The `*.supabase.co` origin is itself fronted by Cloudflare, which sets `cf-connecting-ip` and strips any client-supplied value — so it is **not** spoofable, and there is no un-proxied origin the public can reach. Because `rateLimit()` reads `cf-connecting-ip` first, per-IP limits hold correctly. **Reclassified to informational.** A defensive hardening was still applied: trust only `cf-connecting-ip` and drop the spoofable `x-real-ip`/`x-forwarded-for` fallbacks. — commit `db66a6b`.

- **Finding #2 — Mass assignment in generic CRUD → FIXED.** Added positive per-table allow-lists (`MUTABLE_FIELDS` / `onlyMutableFields`) to the generic handler and made `StockMovement` **read-only** via that path (writes → `405`; stock changes only via `adjust_material_stock`). `stockQty`/`unitPrice`/`purchaseQty` can no longer be set through `PATCH /materials/:id`, and ledger rows can no longer be fabricated via `POST /stock-movements`. Verified by the existing edge tests (9/9) plus 12 new security assertions. — commit `ac5f887`.

- **Recommendation #3 — money overflow bound → MIGRATION DRAFTED (review only).** Added `CHECK` constraints rejecting `Infinity`/`NaN`/negative on invoice & purchase money columns as a DB-level backstop (`supabase/migrations/20261107100000_bound_money_amounts.sql`). Logic verified read-only (note: Postgres orders `NaN` above `+Infinity`, so the predicate is `>= 0 AND < 'Infinity'`, not a naive `<> 'Infinity'`). Not yet deployed — test on a Supabase branch before merging. — commit `5a66110`.

- **Recommendation #4 — tighten CSP → DEFERRED (not applicable as-is).** Nonce-based CSP needs per-request server rendering; the web app is a **static export** on Cloudflare Pages, so nonces don't fit without edge middleware. The current CSP is already strong and no XSS sink is reachable. Recommended path when warranted: a Cloudflare Pages `_middleware` that injects a per-request nonce.

- **Recommendation #5 — pin JWT `alg` → FIXED.** `verifyJwt` now explicitly rejects any token whose header `alg` ≠ `HS256`. — commit `ac5f887`.

Full engagement record: `docs/security-audit-2026-11-07.md`.

# Methodology

**Engagement type:** Authorized white-box (source-available) security audit. No running instance was available, so findings are grounded in complete source-to-sink code traces; dynamic reproduction was noted as a confidence gap where applicable.

**Scope:**
- **Primary:** `supabase/functions/api/index.ts` (the entire Deno edge REST API) and `supabase/migrations/*` + `supabase/migrations_from_prod/*` (schema, RLS policies, and `SECURITY DEFINER` RPCs).
- **Secondary:** `apps-web` (Next.js) for client-side XSS and client secret exposure.

**Approach:** Testing followed OWASP WSTG and OWASP API Security Top 10 categories. A shared threat model was established first, anchored on the critical architectural fact that the API connects with the Supabase **service-role key, which bypasses RLS** — making application-code `businessId` scoping and in-RPC `p_business_id` validation the true tenant-isolation controls. Work was decomposed across four specialized review lanes executed in parallel:

1. **Authentication, JWT, admin escalation, OTP/password-reset, rate limiting** — token signing/verification, algorithm handling, revocation/replay, Google OAuth linking, OTP and email flows, and IP/identity rate-limit keying.
2. **Multi-tenant isolation (IDOR/BOLA), RLS, and SECURITY DEFINER RPC safety** — verification that every referenced identifier (material, product, supplier, customer, invoice) is validated against the caller's business in both application code and every database function; full RLS policy review.
3. **Mass assignment, input validation, and money/state-machine business logic** — field-binding controls, invoice payment/status consistency, numeric bounds, idempotency handling, and stock movements.
4. **Frontend XSS and client secret exposure** — all HTML/redirect sinks, rendering of attacker-controlled business data, auth pages, API client token storage, and committed secrets.

**Activities:** source-to-sink tracing, authorization-boundary analysis, SQL/RPC review for injection and scope gaps, field-binding analysis, cryptographic/token review, and secret sweeps. Coverage was recorded for every surface assessed, including those that came back clean.

# Technical Analysis

**Severity model** reflects demonstrated exploitability × impact, calibrated to this target: cross-tenant financial data access or auth/admin bypass would be Critical/High; the confirmed issues are self-tenant or cost/abuse in nature and rate as Medium.

**Confirmed findings (2, both Medium):**

1. **IP-based rate-limit bypass via spoofed forwarding headers** (CWE-348, CVSS 6.5). **✎ STATUS (2026-11-07): FALSE POSITIVE — verified the `*.supabase.co` origin is always behind Cloudflare (`cf-connecting-ip` present on 100% of edge requests, per-client, not client-spoofable), so per-IP limits hold; hardened anyway in commit `db66a6b`. See "Remediation & Verification Status" above.** `rateLimit()` derives the client IP from `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` without proof the request transited Cloudflare. A direct-to-origin request to the `*.supabase.co/functions/v1/api` URL lets a single host rotate these headers and defeat all per-IP limits — the global `api` 100/min throttle and the unauthenticated `/analytics/events` 60/min limit — enabling unauthenticated database write-flooding and loss of the global abuse backstop. Identity/account-keyed limits are unaffected. The residual open item is whether the origin is publicly reachable off-Cloudflare; if it is forced through Cloudflare this degrades to a hardening gap.

2. **Mass assignment in generic CRUD** (CWE-915, CVSS 4.3). **✎ STATUS (2026-11-07): FIXED in commit `ac5f887` — positive per-table allow-lists added and `StockMovement` made read-only via the generic path. See "Remediation & Verification Status" above.** The shared `handleCrud` write path guards inserts/updates with only an immutable-field **denylist** and no positive allow-list. `PATCH /materials/:id` can directly set `stockQty` (including negative), `unitPrice`, `purchasePrice`, and `purchaseQty`, bypassing the `adjust_material_stock` ledger; `POST /stock-movements` can fabricate ledger rows whose attacker-set `costAmount` flows into `dashboard_summary`'s cost-of-goods-sold. Impact is confined to the attacker's **own** business (all writes are `businessId`-scoped) — an integrity/books-corruption issue, not a cross-tenant one.

**Areas tested and confirmed sound (no issues):**
- **Multi-tenant isolation** — every `SECURITY DEFINER` RPC validates referenced identifiers against `p_business_id` before any read/join/mutate; generic CRUD pairs every `id` lookup with `businessId`; foreign-key relations are business-validated; `businessId` is DB-authoritative (reloaded per request), so JWT tampering is inert.
- **RLS** — all 18 application tables enable RLS with non-spoofable tenant policies keyed on `auth.uid()`; no `USING(true)`; the helper is private-schema; all public `SECURITY DEFINER` functions are `service_role`-only, and admin/aggregate RPCs are reachable only behind `isAdmin` gating or a dedicated bearer token.
- **Authentication/JWT** — HMAC signature is always verified (no `alg:none`/confusion path); tokens are single-use-revocable via `jti` blacklist; admin status derives from DB-authoritative email + Google/verified proof with no attacker-reachable path to an admin email; Google OAuth validates `aud` and `email_verified`; OTP and password-reset flows use CSPRNG tokens, single-use consumption, expiry checks, no existence oracle, and bounded sends.
- **Business logic / money** — invoice totals are immutable and RPC-computed; `normalizeInvoiceUpdate` enforces status/paidAmount consistency and rejects negative/NaN/Infinity; idempotency keys are business-scoped; insufficient-stock is rejected atomically.
- **Frontend** — the only HTML sinks are safe (library-generated SVG, static script, innerHTML-clear); all business/API data renders as React-escaped JSX text, including admin screens; the production session JWT lives in a `__Host-` HttpOnly cookie (not localStorage); no service-role key or JWT secret is present in the client; only intended-public values (Supabase anon key, Google client ID) are exposed.

**Systemic theme:** the two findings share one root pattern — trusting an input at a boundary that should be deny-by-default (forwarded headers from an unauthenticated hop; arbitrary request fields into a write). Everywhere the codebase applies positive validation and authoritative server-side state, it is robust.

**Attack chaining:** the two Medium findings have independent root causes and distinct impacts (external cost/abuse vs. self-tenant integrity) with no reinforcing path between them; no higher-impact chain exists. One low-impact numeric-overflow item (unbounded `unitPrice*quantity` on UNPAID invoice/purchase item loops producing an `Infinity` own-tenant total) remains an open, self-tenant hardening gap and is folded into the allow-list remediation.

# Recommendations

**Immediate**
1. **Authenticate the Cloudflare→origin hop before trusting forwarding headers** (rate-limit bypass). Require a shared secret header injected by Cloudflare (e.g. a transform rule adding a secret value) and have the edge function reject or ignore client-supplied `cf-connecting-ip`/`x-real-ip`/`x-forwarded-for` on requests that lack it. Alternatively, restrict the Supabase Edge Function origin so it is only reachable via Cloudflare. Confirm whether the `*.supabase.co` origin currently answers directly off-Cloudflare; if so, this is the priority fix.

2. **Replace the CRUD denylist with positive per-table field allow-lists** (mass assignment). For every table routed through the generic handler (`Material`, `Customer`, `Supplier`, `Expense`, `StockMovement`, and the Invoice/Purchase PATCH paths), accept only the explicitly user-editable columns and reject all others. This closes the entire class in one change: it prevents overwriting `stockQty`/`unitPrice`/`purchasePrice` on materials, blocks fabricated stock-ledger rows, and incidentally bounds the PATCH-path `vatRate`/`date` gaps. Route any legitimate stock change exclusively through `adjust_material_stock` so the ledger stays authoritative.

**Short-term**
3. **Bound monetary magnitudes at the money-RPC boundary.** Apply the existing `MAX_AMOUNT`/finite checks to `unitPrice * quantity` inside `create_invoice_with_inventory` and `create_purchase_with_inventory` item loops so a malformed UNPAID document cannot store an `Infinity` total and distort dashboard sums.

**Medium-term (hardening, defense-in-depth)**
4. **Tighten the production CSP** `script-src` to drop `unsafe-inline` in favor of nonces/hashes. No reachable sink exploits it today, but it strengthens the already-good XSS posture.
5. **Validate the JWT header `alg`** explicitly on verification. There is no current forge path, but pinning `HS256` removes any future algorithm-confusion risk.

**Retest & validation**
- Re-test the two Medium items after remediation: confirm per-IP limits hold against spoofed forwarding headers on a direct-to-origin request, and confirm `PATCH /materials/:id` / `POST /stock-movements` reject non-allow-listed fields while legitimate edits still succeed.
- Where a running instance becomes available, execute the provided proofs-of-concept to lift both findings from static (medium) to dynamically-confirmed confidence and to quantify the analytics write-flood and COGS distortion.
- The multi-tenant isolation, RLS, authentication, and frontend lanes were assessed as sound and do not require remediation; a lightweight retest after any schema or RPC change is advisable to preserve the current strong posture.

