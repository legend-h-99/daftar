---
id: AgDR-0003
timestamp: 2026-11-17T17:10:00Z
agent: claude-code
model: claude-opus-5-5
session: e38f69b7-5085-46e2-a3fe-51a2c42d1e07
trigger: user-prompt
status: executed
category: security
projects: [daftar1]
---

# Time-boxed audit exception for the picomatch ReDoS advisory

> In the context of #79, facing a high-severity `picomatch` advisory with no patched version that failed CI on every branch, I decided to ignore that one advisory until 2026-12-17 with a CI-enforced expiry, to unblock CI, accepting a build-time ReDoS risk for 30 days.

## Context

- GitHub updated [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) on 2026-11-17 at 15:56 UTC. It covers `picomatch` up to 4.0.7. `first_patched_version` is null, so no fix exists.
- `pnpm audit --prod --audit-level high` (`mobile-security`) and `apps/web/test/release-audit.mjs` (`test-and-build`) failed on every branch. `main` passed both at 15:25 UTC with the same lockfile.
- The 3 high findings in the audit are this one advisory in three versions:
  - 4.0.5: `apps/web` > `@sentry/nextjs` > `@rollup/plugin-commonjs` > `picomatch`.
  - 3.0.2: `apps/mobile` > `expo` > `@expo/cli` > `picomatch`.
  - 2.3.2: `apps/mobile` > `react-native` > `@react-native/community-cli-plugin` > `metro` > `jest-worker` > `jest-util` > `picomatch`.
- Reachability evidence, checked 2026-11-17:
  - Every path is a build or CLI tool: a Rollup plugin used only by a Sentry webpack loader, the Expo CLI, the Metro bundler.
  - The production web build on Cloudflare Pages is a static export (`NEXT_OUTPUT_EXPORT=1` sets `output: "export"`), so it has no server runtime. `vercel.json` builds without that flag. In that build `picomatch` is still reached only through build tooling.
  - No `picomatch` strings (`picomatch`, `isExtglob`, `POSIX_REGEX_SOURCE`) appear in the 79 web JS files built on 2026-11-17, or in the iOS and Android Hermes bundles from 2026-11-11.
  - `supabase/functions` does not use `picomatch`.
- Limit of this evidence: a string search in bundles is an inference, not proof that no code path exists. The mobile bundles are six days old.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Ignore this GHSA only, until 2026-12-17, with a CI expiry check and a named owner (chosen) | CI is green again. Other high advisories still fail. The exception cannot outlive its date without a new decision. | The build-time ReDoS risk stays for up to 30 days. |
| Ignore with the expiry only written down | Smallest change. | Nothing forces a review. The exception can live forever. |
| Wait for an upstream fix | No risk accepted. | CI stays red for every PR for an unknown time. |
| Override `picomatch` to a newer version | Removes the finding. | No patched version exists, so no override fixes it. |

## Decision

Chosen: **ignore `GHSA-fc5q-39xc-vjpf` until 2026-12-17, enforced in CI**, because the evidence points to build-time use only and the founder accepted a 30-day risk.

- `pnpm-workspace.yaml` → `auditConfig.ignoreGhsas` lists the one ID. Both `pnpm audit` and `release-audit.mjs` honour it.
- `tests/security/audit-exceptions.json` holds the reason, the expiry, the owner (`legend-h-99`, the founder), the ticket and this AgDR.
- `tests/security/check-audit-exceptions.mjs` fails when:
  - an exception has expired, or expires more than 90 days ahead;
  - an expiry is not a real calendar date;
  - an entry has no reason or no owner;
  - a GHSA or CVE ID appears in `pnpm-workspace.yaml` or `package.json` with no entry (IDs are matched anywhere in those files, in any case, so an unusual YAML or JSON layout cannot hide an ignore);
  - an entry is stale.
- The check runs in `mobile-security` before the audit, and daily at 06:00 UTC on `main` (`.github/workflows/audit-exceptions.yml`).

## Consequences

- On 2026-12-18 CI fails until the owner re-assesses the advisory. Remove the exception if `picomatch` ships a fix, or extend the date (at most 90 days ahead) with a new reason.
- A new ignore in `pnpm-workspace.yaml` or `package.json` needs a matching entry in `audit-exceptions.json`. Ignores set outside those two files (for example a user-level `.npmrc`) are not checked.
- Moderate and low advisories are unchanged (12 moderate, 1 low). They did not fail CI before this change either.
- If a future code path matches untrusted glob patterns with `picomatch` at runtime, this exception is no longer valid.

## Artifacts

- Ticket: https://github.com/legend-h-99/daftar/issues/79
- Blocked PR: https://github.com/legend-h-99/daftar/pull/78
