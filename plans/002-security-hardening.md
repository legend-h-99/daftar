# Plan 002: Security hardening — CORS guard, security headers, AUTH_DEV_OTP production gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d58f93..HEAD -- apps/api/src/main.ts apps/api/src/auth/auth.service.ts apps/web/next.config.ts`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED — CORS change affects all cross-origin callers; test with the dev
  frontend before marking done.
- **Depends on**: none (safe to run before or after Plan 001)
- **Category**: security
- **Planned at**: commit `2d58f93`, 2026-07-09

## Why this matters

Three independent security gaps, all fixable in one pass:

1. **CORS open by default**: `apps/api/src/main.ts:33` sets `origin: true` (allow
   all origins) when `CORS_ORIGIN` is not set. An accidental production deploy
   without this env var leaves the API accepting authenticated cross-origin requests
   from any site.
2. **No HTTP security headers**: `apps/web/next.config.ts` has no `headers()`
   function. Missing CSP, X-Frame-Options, and HSTS make XSS more damaging and
   the app frameable for clickjacking.
3. **AUTH_DEV_OTP exposed**: `auth.service.ts:63–65` returns the raw OTP code in
   the API response when `AUTH_DEV_OTP=true`. The local `.env` has this enabled by
   default; if anyone copies `.env` to production, every OTP is exposed in the
   response body.

None of these are active exploits today (the app is dev-only), but all three
must be fixed before any real user can log in.

## Current state

### File 1: `apps/api/src/main.ts` (relevant lines)

```ts
// line 29–35
const corsOrigin = process.env.CORS_ORIGIN;
app.enableCors({
  // In dev (no CORS_ORIGIN set) reflect any origin so LAN devices can connect.
  // In production, set CORS_ORIGIN to the exact frontend URL(s), comma-separated.
  origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  credentials: true,
});
```

### File 2: `apps/api/src/auth/auth.service.ts` (relevant lines)

```ts
// line 21
private readonly devOtpEnabled: boolean;

// line 28
this.devOtpEnabled = configService.get<string>('AUTH_DEV_OTP') === 'true';

// line 63–66
if (this.devOtpEnabled) {
  this.logger.warn(`AUTH_DEV_OTP is on — returning OTP for ${phone} in the response`);
  return { sent: true, devCode: code };
}
// TODO: hand the code to the SMS gateway here.
return { sent: true };
```

### File 3: `apps/web/next.config.ts` (full current content)

```ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
```

### Repo conventions

- NestJS config is read via `ConfigService.get<string>(key)`.
- The `Logger` is already injected in `AuthService` as `private readonly logger = new Logger(AuthService.name)`.
- `NODE_ENV` is the standard Node.js environment discriminator.
- Next.js `headers()` must be an async function returning an array of route-header objects.

## Commands you will need

| Purpose          | Command                                            | Expected on success    |
|------------------|----------------------------------------------------|------------------------|
| Build API        | `pnpm --filter api build`                          | exit 0                 |
| Typecheck web    | `pnpm --filter web exec tsc --noEmit`              | exit 0, no errors      |
| Dev servers      | check that `http://localhost:3000` still works after each change |             |

## Scope

**In scope**:
- `apps/api/src/main.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/web/next.config.ts`

**Out of scope**:
- Any other file — these three contain all the changes.
- JWT lifetime or revocation — covered by Plan 004 (not yet planned).
- localStorage token storage — documented MVP decision; not touched here.

## Git workflow

- Branch: `advisor/002-security-hardening`
- One commit per step is fine; alternatively one commit for all three:
  `fix(security): CORS guard, security headers, AUTH_DEV_OTP production check`

## Steps

### Step 1: Fix CORS — require CORS_ORIGIN in non-dev environments

In `apps/api/src/main.ts`, replace the `enableCors` block (lines 29–35) with:

```ts
const corsOrigin = process.env.CORS_ORIGIN;
const isDev = process.env.NODE_ENV !== 'production';

if (!corsOrigin && !isDev) {
  throw new Error(
    'CORS_ORIGIN environment variable must be set in production. ' +
    'Example: CORS_ORIGIN=https://app.daftar.sa',
  );
}

app.enableCors({
  origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  credentials: true,
});
```

This keeps the dev fallback (`true`) but prevents accidental open-CORS production
deploys by crashing at startup.

**Verify**:
- `pnpm --filter api build` → exit 0
- In a terminal: `NODE_ENV=production node -e "process.env.CORS_ORIGIN=''; require('./apps/api/dist/main')" 2>&1 | grep "CORS_ORIGIN"` → should print the error message. (Only do this after `pnpm --filter api build` succeeds.)
- With dev server running: `http://localhost:3001/api/auth/me` still responds.

### Step 2: Add AUTH_DEV_OTP production guard in AuthService

In `apps/api/src/auth/auth.service.ts`, in the `constructor`, after line 28, add
a startup check. The full constructor becomes:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly jwtService: JwtService,
  configService: ConfigService,
) {
  this.devOtpEnabled = configService.get<string>('AUTH_DEV_OTP') === 'true';

  if (this.devOtpEnabled && configService.get<string>('NODE_ENV') === 'production') {
    throw new Error(
      'AUTH_DEV_OTP must not be enabled in production. ' +
      'Remove it from your environment or set it to false.',
    );
  }
}
```

**Verify**:
- `pnpm --filter api build` → exit 0
- `pnpm --filter api exec tsc --noEmit` → exit 0
- With `AUTH_DEV_OTP=true` in `.env` and `NODE_ENV` unset (dev), the API still
  starts normally (the guard only fires when `NODE_ENV === 'production'`).

### Step 3: Add HTTP security headers in Next.js

Replace the entire `apps/web/next.config.ts` with:

```ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent the app from being embedded in iframes (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS for 1 year once the site is served over TLS.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Basic referrer policy for privacy.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Content Security Policy: allows same-origin scripts + inline styles
          // (Tailwind requires inline styles in dev). Tighten before v1 launch.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
};

export default nextConfig;
```

Notes on the CSP:
- `'unsafe-inline'` and `'unsafe-eval'` for scripts are required by Next.js dev
  mode. For production, these should be tightened with a nonce-based CSP — mark
  that as a follow-up in the Maintenance notes.
- `connect-src` includes `http://localhost:3001` for local dev and `https://wa.me`
  for the WhatsApp share link. When the production API URL is known, add it here.

**Verify**:
- `pnpm --filter web exec tsc --noEmit` → exit 0
- Start dev server: `pnpm --filter web dev`
- Open browser → `http://localhost:3000` → open DevTools → Network → pick any
  request → Response Headers → confirm `X-Frame-Options: DENY` is present.

## Test plan

No new test files for this plan. Manual verification is the gate:

1. API CORS: confirm the dev server still accepts `http://localhost:3000` requests
   (open the app in browser after the change and navigate around).
2. API OTP guard: confirm the API starts normally in dev; in a scratch test,
   set `NODE_ENV=production` without `AUTH_DEV_OTP` and confirm the API starts; set
   both and confirm it throws the error message.
3. Security headers: browser DevTools confirms all 5 headers are present on the
   Next.js response.

## Done criteria

- [ ] `pnpm --filter api build` exits 0
- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] `curl -s -I http://localhost:3000 | grep -i "x-frame-options"` → `X-Frame-Options: DENY`
- [ ] `curl -s -I http://localhost:3000 | grep -i "content-security-policy"` → non-empty CSP header
- [ ] `NODE_ENV=production node apps/api/dist/main.js 2>&1 | grep "CORS_ORIGIN"` → shows the error (without CORS_ORIGIN set)
- [ ] Dev app still loads and login flow works end-to-end at `http://localhost:3000`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- The CSP header breaks the app (white screen, network errors in console) — check
  the `connect-src` directive first, then `script-src`. Widen the policy minimally
  to fix, and note what was changed.
- `pnpm --filter web exec tsc --noEmit` fails after editing `next.config.ts` — the
  `headers()` return type may need `Promise<Header[]>`; import `Header` from `'next'` if needed.
- The API fails to start in dev after Step 2 — verify `NODE_ENV` is not
  accidentally set to `'production'` in your local `.env`.

## Maintenance notes

- The CSP `'unsafe-eval'` is required for Next.js dev HMR. For production builds,
  it can be removed — the production bundle does not eval. Plan this as a follow-up
  before the public launch.
- When the production `connect-src` URL is known (e.g. `https://api.daftar.sa`),
  update the CSP. Make the `NEXT_PUBLIC_API_URL` env var the source of truth
  instead of hardcoding `localhost:3001`.
- The CORS guard (Step 1) only checks `NODE_ENV === 'production'`. If the staging
  environment doesn't set `NODE_ENV=production`, the guard won't fire there —
  consider adding a separate `ALLOW_ALL_ORIGINS=true` dev flag instead.
