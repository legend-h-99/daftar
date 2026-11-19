---
id: AgDR-0002
timestamp: 2026-11-17T16:20:00Z
agent: claude-code
model: claude-opus-5-5
session: e38f69b7-5085-46e2-a3fe-51a2c42d1e07
trigger: user-prompt
status: executed
category: tech-stack
projects: [daftar1]
---

# ESLint 9 flat config for apps/api and apps/mobile, gated in CI

> In the context of #73, facing two broken `lint` scripts, I decided to add ESLint 9 flat configs to both apps and run them in CI, to make lint a real check outside `apps/web`, accepting relaxed test-file rules and warnings that do not fail the build.

## Context

- `apps/api` had a `lint` script, but no `eslint` dependency and no config. The script also used `--fix` and globbed `apps/` and `libs/`, which do not exist.
- `apps/mobile` had `eslint` 9.39.5 and `eslint-config-expo` 9.2.0, but no config file. Its script used `--ext`, which ESLint 9 flat config rejects. Running it failed with "Oops! Something went wrong!".
- CI ran lint only for `apps/web` (ESLint 8, `.eslintrc.json`).
- With a working config, `apps/api` showed 35 errors. 27 were `no-explicit-any`, all in spec files. Production code had 4 issues: two unused imports, one dead helper, one unused `eslint-disable` comment.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Add flat configs and a CI step (chosen) | Lint becomes a real check in all three apps. | New dev dependencies in `apps/api`. |
| Delete the `apps/api` lint script | No new dependency. | The dev and CI API keeps no lint check at all. |
| Reuse ESLint 8 and `.eslintrc` from web | One ESLint version in the API and web. | Mobile already uses ESLint 9 and Expo's flat config. ESLint 8 is end-of-life. |

## Decision

Chosen: **ESLint 9 flat config in both apps**, because ESLint 9 and the `@typescript-eslint` 8.62.1 packages are already in `pnpm-lock.yaml` (through `apps/mobile` and `eslint-config-next`), so the API adds no new package families.

- `apps/api`: `eslint` 9.39.5, `@typescript-eslint/parser` 8.62.1 and `@typescript-eslint/eslint-plugin` 8.62.1, using the plugin's `flat/recommended` rules. Spec and `test/` files allow `any` and `require()`, and report unused variables as warnings.
- `apps/mobile`: `eslint-config-expo/flat` with Node globals for `test/**/*.cjs`.
- Scripts: `api lint` runs `eslint src test` without `--fix` (a new `lint:fix` keeps the old fixing behaviour). `mobile lint` runs `eslint .`.
- CI: a `Lint mobile` step in `mobile-security` and a `Lint API` step in `test-and-build`.

## Consequences

- Lint errors in `apps/api` or `apps/mobile` now fail CI.
- Warnings do not fail CI: 3 in API tests, 8 in mobile. They are left for a later cleanup.
- Production API code must not use bare `any`. This matches the code standard.
- The web app stays on ESLint 8. Moving it to ESLint 9 is separate work.
- `@typescript-eslint/*` and `eslint` versions in `apps/api` should move together on upgrade.

## Artifacts

- Ticket: https://github.com/legend-h-99/daftar/issues/73
