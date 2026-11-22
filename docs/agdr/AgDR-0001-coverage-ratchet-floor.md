---
id: AgDR-0001
timestamp: 2026-11-17T16:30:00Z
agent: claude-code
model: claude-opus-5-5
session: e38f69b7-5085-46e2-a3fe-51a2c42d1e07
trigger: user-prompt
status: executed
category: patterns
projects: [daftar1]
---

# Coverage thresholds as a ratchet floor, enforced in CI

> In the context of #72, facing no coverage gate in Jest, Vitest or CI, I decided to set thresholds at the measured baseline and run both suites with coverage in CI, to stop silent coverage loss now, accepting that the API floor is very low (about 7%).

## Context

- No coverage threshold existed in `apps/api/jest.config.js`, `apps/web/vitest.config.ts` or `.github/workflows/ci.yml`.
- Baseline on `main` (8aafc01), measured on 2026-11-17:
  - `apps/web`: statements 66.54%, branches 50.8%, functions 64.85%, lines 69.27%.
  - `apps/api` (all of `src`, specs excluded): statements 7.11%, branches 9.53%, functions 4.38%, lines 7.43%. `domain/` and `application/` have 0% coverage.
- The ticket asks for a threshold that does not break `main`.
- Vitest needs a coverage provider package to report coverage. The repo did not have one.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Ratchet floor at the baseline (chosen) | Passes `main` today. Fails any PR that lowers coverage. Easy to raise. | API floor is low. It does not force new tests. |
| 80% target now | Matches the ApexYard target. | Fails CI on every PR today. The API is at about 7%. |
| Coverage report only, no threshold | No risk of a red build. | Coverage can still drop without notice. |

For the Vitest provider:

| Option | Pros | Cons |
|--------|------|------|
| `@vitest/coverage-v8` 4.1.10 (chosen) | First-party provider. Pinned to the installed `vitest` 4.1.10. Uses native V8 coverage, no instrumentation step. | One new dev dependency. |
| `@vitest/coverage-istanbul` | Same maintainers. | Instruments code, so runs are slower. |

## Decision

Chosen: **ratchet floor at the measured baseline, with `@vitest/coverage-v8` pinned to the `vitest` version**, because it adds a gate today without breaking `main`.

- Jest measures every `src/**/*.ts` file except specs and `main.ts`, so untested files count against the score.
- CI runs `pnpm --filter web test -- --run --coverage` and `pnpm --filter api test --runInBand --coverage`.

## Consequences

- A PR that lowers coverage below the floor fails CI.
- Raise the numbers in the two config files when tests land. Do not lower them to make a PR pass.
- `@vitest/coverage-v8` must move in step with `vitest` on upgrade.
- The 80% domain-logic target is not met. Tests for `apps/api/src/domain` and `apps/api/src/application` are follow-up work.

## Update 2026-11-22: domain target set

The owner chose an 80% target for `apps/api/src/domain` only.

- Five new spec files cover `domain/services/recipe-cost.calculator`, two use cases, and two utils. All 205 tests pass.
- `apps/api/src/domain` now has 100% on all four metrics. Jest enforces 80% on it through the `./src/domain/` key. Jest resolves that key from the package root, not from `rootDir`.
- Files under that key no longer count toward the global floor. Measured without `src/domain`, the API is at statements 11.10%, branches 17.05%, functions 6.89%, lines 11.53%. The global floor is raised to 11 / 17 / 6 / 11.
- `apps/api/src/application` stays under the global floor at about 6%. An 80% gate there would fail CI today. Raising it is follow-up work.

## Artifacts

- Ticket: https://github.com/legend-h-99/daftar/issues/72
