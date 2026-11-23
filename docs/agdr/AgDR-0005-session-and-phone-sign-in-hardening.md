---
id: AgDR-0005
timestamp: 2026-11-23T11:00:00Z
agent: claude-code
model: claude-opus-5-5
session: f33ab127-7347-48d6-b3dd-4cd5ee89d4f1
trigger: code-review
status: executed
category: security
projects: [daftar1]
---

# Session signing, client-IP trust and phone sign-in limits

> In the context of the 2026-11-15 and 2026-11-17 security audits, facing session tokens signed with the service-role key, rate limits that trusted a caller-supplied IP, and a shared SMS budget that one number could drain, I decided to sign sessions with a dedicated secret and a per-account token version, to trust the client IP only when the Pages Worker vouches for it, and to cap phone sign-in per hour with split SMS budgets. I accepted that the split budget can reveal whether a phone number has an account.

This record was written on 2026-11-23, after the code landed on `fix/landing-copy-trust` (commits `e066d59` on 2026-11-11 and `66547e5` on 2026-11-17). Rex asked for it in the review of PR #98. The founder chose the account-disclosure trade-off on 2026-11-23.

## Context

- Sessions were HS256 JWTs. The Edge function could sign them with `SUPABASE_SERVICE_ROLE_KEY` when `JWT_SECRET` was unset. A leak of one secret then exposed the other.
- A password change did not end existing sessions. Logout revokes one token through `TokenBlacklist`, but no mechanism revoked all of an account's tokens.
- `rateLimit` keyed IP buckets on `cf-connecting-ip`. A caller that reached the function URL directly could set that header to any value and get a fresh bucket per request.
- The daily SMS budget was shared by every user. The only limit on `/auth/otp/request` was 3 a minute per number, so one number could spend the day's budget in about 34 minutes. `/auth/otp/verify` allowed up to 7,200 guesses a day per number.

## Options Considered

| Topic | Option | Pros | Cons |
|-------|--------|------|------|
| Session signing | Require `JWT_SECRET`, never fall back (chosen) | The service-role key and the session key are independent | A deploy without `JWT_SECRET` fails every sign-in with 500 |
| Session signing | Keep the service-role fallback | No new required secret | One leak compromises both the database and every session |
| Session revocation | Per-account `tokenVersion` claim `pv` (chosen) | One column; a password change ends every older session | Every authenticated request reads the version |
| Session revocation | Blacklist every token on password change | No schema change | Needs a list of issued tokens, which the function does not keep |
| Client IP | Trust `cf-connecting-ip` only with `x-daftar-edge-secret` from the Worker (chosen) | Direct callers cannot choose their bucket | Direct callers get no IP bucket at all, only per-account and global caps |
| Client IP | Trust the header always | Simple | Any caller defeats every IP limit |
| SMS budget | Split `sms:returning` and `sms:new` (chosen) | A flood of unknown numbers cannot stop existing users from signing in | Reveals account existence once `sms:new` is spent (see Consequences) |
| SMS budget | One shared budget | Same response for every number | One attacker can stop phone sign-in for every existing user |

## Decision

- `JWT_SECRET` is required. `signJwt` and `verifyJwt` fail closed without it.
- `User.tokenVersion` (migration `20261115204049_user_token_version.sql`) is copied into the `pv` claim. Password reset and email verification assign a new value. `getUser` rejects a token whose `pv` does not match.
- The Pages Worker adds `x-daftar-edge-secret` from `EDGE_SHARED_SECRET`. `clientIp` returns `cf-connecting-ip` only when that header matches a secret of at least 32 characters. Otherwise no IP-keyed bucket is used.
- Phone sign-in limits, on top of the per-minute ones:
  - 5 OTP requests an hour per number.
  - 20 OTP requests an hour per trusted IP.
  - 15 verify attempts an hour per number.
- Known numbers spend `sms:returning` (`SMS_DAILY_SEND_CAP`, default 100). Unknown numbers spend `sms:new` (`SMS_NEW_DAILY_SEND_CAP`, default 50).
- **Accepted risk:** once `sms:new` is spent for the day, `/auth/otp/request` answers 503 for an unknown number and 200 with a real SMS for a registered one. Spending it takes about 50 requests, and direct callers bypass the IP caps. The founder accepted this on 2026-11-23, because a single budget would let one attacker stop sign-in for every existing customer. `apps/api/src/auth/edge-api.security.spec.ts` asserts this behaviour, so a change to it is deliberate.

## Consequences

- Deploy order matters:
  1. Set `JWT_SECRET` and `EDGE_SHARED_SECRET` on the Edge function, and `EDGE_SHARED_SECRET` on Pages.
  2. Apply `20261115204049_user_token_version.sql`.
  3. Deploy the function.
  Without `JWT_SECRET`, every sign-in fails. Without `EDGE_SHARED_SECRET`, every IP cap is off.
- Inferred from the code, not tested against production: sessions that the service-role key signed stop verifying once the function uses `JWT_SECRET`, so existing users sign in again after the deploy.
- An attacker can learn whether a phone number has an account after spending about 50 SMS sends. Revisit if account disclosure becomes a stated product risk, for example by adding a CAPTCHA before `sms:new` sends.
- `/auth/email/register` keeps a weaker form of the same disclosure: response timing and a 503 when the email budget runs out. `/auth/password/forgot` on `main` has the same weakness.

## Artifacts

- Tickets: https://github.com/legend-h-99/daftar/issues/55, https://github.com/legend-h-99/daftar/issues/57
- PR: https://github.com/legend-h-99/daftar/pull/98
- Audits: `docs/security-audit-2026-11-15.md`, `docs/security-audit-2026-11-17.md`
