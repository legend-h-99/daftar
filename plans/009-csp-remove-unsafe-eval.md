# Plan 009: Remove `unsafe-eval` from Content-Security-Policy in production

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```
> git diff --stat a82de24..HEAD -- apps/web/next.config.ts
> ```
> Compare the "Current state" excerpt against the live file before editing.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a82de24`, 2026-07-09

## Why this matters

`Content-Security-Policy: script-src 'self' 'unsafe-inline' 'unsafe-eval'`
disables the primary XSS mitigation that CSP provides: `unsafe-eval` allows
`eval()`, `new Function()`, and `setTimeout(string)` — all classic XSS vectors.
Next.js requires `unsafe-eval` only in development (for hot-module replacement),
not in the production build. Serving a production app with `unsafe-eval` in the
CSP is equivalent to having no CSP at all for script execution. Removing it from
the production CSP reduces the XSS blast radius at zero cost to functionality.

`unsafe-inline` is also present in both `script-src` and `style-src`. For
styles that is correct (Tailwind generates inline styles). For scripts, Next.js
App Router does inject a small inline bootstrap chunk; removing `unsafe-inline`
from `script-src` requires nonce-based CSP which is a larger change. That work
is deferred — this plan removes only `unsafe-eval`, which has no legitimate
production use.

## Current state

### `apps/web/next.config.ts` lines 14–38 (complete `headers()` block)

```ts
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // ← 'unsafe-eval' here
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' http://localhost:3001 https://wa.me",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
```

The file is at `apps/web/next.config.ts`. The full file is 41 lines.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck web | `pnpm --filter web exec tsc --noEmit` | exit 0 |
| Build web | `pnpm --filter web build` | exit 0, `.next/` populated |
| Verify CSP in build | see step 3 | `unsafe-eval` absent from headers |

## Scope

**In scope**:
- `apps/web/next.config.ts` — change `script-src` directive only

**Out of scope** (do NOT touch):
- `apps/api/` — this is a frontend-only change
- `style-src` directive — `unsafe-inline` is intentional for Tailwind
- `connect-src` directive — do not change the listed origins
- Any `nonce` infrastructure — that is a follow-up not in scope here

## Git workflow

- Branch: `advisor/009-csp-remove-unsafe-eval`
- Commit: `fix(web): remove unsafe-eval from CSP script-src in production`
- Do NOT push or open a PR.

## Steps

### Step 1: Make `script-src` conditional on environment

Open `apps/web/next.config.ts`.

The `headers()` function currently builds a single CSP string. Replace it with
a version that conditionally includes `'unsafe-eval'` only in development:

```ts
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' http://localhost:3001 https://wa.me",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
```

This is the complete replacement of the `headers()` method. The rest of
`next.config.ts` (imports, `outputFileTracingRoot`, `distDir`) stays unchanged.

**Verify**: `grep "scriptSrc" apps/web/next.config.ts` → found. `grep "unsafe-eval" apps/web/next.config.ts` → found exactly once (inside the `isDev` branch, not in the `else` branch).

### Step 2: Typecheck

```bash
pnpm --filter web exec tsc --noEmit
```

**Verify**: exits 0, no errors.

### Step 3: Build and verify production CSP

```bash
NODE_ENV=production pnpm --filter web build
```

After the build completes, inspect the generated headers config that Next.js
writes into the build output. The easiest check is to grep the compiled output:

```bash
grep -r "unsafe-eval" apps/web/.next/ 2>/dev/null || echo "NOT FOUND"
```

**Verify**: prints `NOT FOUND` — `unsafe-eval` does not appear in the production
build's header configuration.

Alternatively, start the production server
(`NODE_ENV=production pnpm --filter web start`) on port 3000 and curl it:

```bash
curl -I http://localhost:3000 2>&1 | grep -i content-security
```

**Verify**: the `Content-Security-Policy` header in the response does NOT
contain `unsafe-eval`.

## Test plan

No automated tests are applicable here — Next.js `next.config.ts` headers are
not covered by the existing test suite. The build + curl smoke test in step 3
is the verification gate.

The dev server behaviour (hot reload) is unaffected because `process.env.NODE_ENV`
is `'development'` during `next dev`.

## Done criteria

- [ ] `grep "unsafe-eval" apps/web/next.config.ts` → appears exactly once, inside the `isDev` ternary branch
- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] `NODE_ENV=production pnpm --filter web build` exits 0
- [ ] Production build or running server does not include `unsafe-eval` in the CSP header
- [ ] Only `apps/web/next.config.ts` is modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- The `next.config.ts` `headers()` block does not match the "Current state"
  excerpt (another plan or the user changed it).
- `pnpm --filter web exec tsc --noEmit` fails with errors unrelated to your
  change (pre-existing broken types — report it, do not fix it in this plan).
- `pnpm --filter web build` fails — report the exact error; do not attempt to
  fix build configuration in this plan.
- After the build, `grep -r "unsafe-eval" apps/web/.next/` finds a match —
  this means Next.js is overriding the header; report it.

## Maintenance notes

- The `connect-src` directive hardcodes `http://localhost:3001` (the local
  dev API). In a real production deployment the API will be at a different
  origin; the `connect-src` must be updated at that point. This is out of
  scope for this plan.
- A fully hardened CSP would replace `unsafe-inline` in `script-src` with
  a per-request nonce (via Next.js middleware). Next.js 15 App Router has
  built-in nonce support. That work should be planned after the SMS gateway
  is live and the app is in stable production shape.
- If Tajawal or other fonts are ever loaded from a CDN (e.g. Google Fonts),
  `font-src` must be extended to include that origin.
