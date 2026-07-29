# Plan 001: Establish a test baseline for the NestJS API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d58f93..HEAD -- apps/api/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW — additive only; no source changes
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `2d58f93`, 2026-07-09

## Why this matters

Zero test coverage means every code change is a blind refactor. The three
services with the highest impact (`AuthService`, `DashboardService`,
`InvoicesService`) perform financial calculations and authentication; a
regression there causes silent data corruption or broken logins. This plan
establishes Jest in the API, writes critical unit tests for those three
services, and creates a one-command verification gate that every future plan
can rely on.

## Current state

- `apps/api/package.json` has **no** `jest`, `@nestjs/testing`, `ts-jest`, or
  `@types/jest` entries and no `test` script. Running `pnpm test` inside
  `apps/api/` currently fails with "Missing script: test".
- `apps/api/tsconfig.json` uses `"module": "commonjs"` and `"target": "ES2021"` —
  compatible with ts-jest without additional flags.
- No `*.spec.ts` files exist anywhere in the repo.
- Critical services to cover (in priority order):
  - `apps/api/src/auth/auth.service.ts` — OTP generation, verification, JWT signing
  - `apps/api/src/dashboard/dashboard.service.ts` — profit/loss calculation, unpaid total
  - `apps/api/src/invoices/invoices.service.ts` — findAll, findOne, updateStatus
- The NestJS testing module (`@nestjs/testing`) creates an isolated module with
  mocked providers; tests do NOT need a live database.
- Error handling pattern: services throw `BadRequestException` and
  `NotFoundException` from `@nestjs/common`.
- Repo convention for private methods: `private readonly` on service fields
  (e.g., `private readonly prisma: PrismaService`). Tests mock `PrismaService`
  at the module level.

## Commands you will need

| Purpose      | Command                                  | Expected on success              |
|--------------|------------------------------------------|----------------------------------|
| Install deps | `pnpm --filter api add -D jest @nestjs/testing ts-jest @types/jest` | exit 0 |
| Run tests    | `pnpm --filter api test`                 | all pass, suite summary printed  |
| Typecheck    | `pnpm --filter api exec tsc --noEmit`    | exit 0, no errors                |

## Scope

**In scope** (the only files you should create or modify):
- `apps/api/package.json` — add devDependencies + test script + jest config
- `apps/api/jest.config.js` — Jest configuration (new file)
- `apps/api/src/auth/auth.service.spec.ts` (new)
- `apps/api/src/dashboard/dashboard.service.spec.ts` (new)
- `apps/api/src/invoices/invoices.service.spec.ts` (new)

**Out of scope** (do NOT touch):
- Any source (non-test) file — this plan adds tests only, no source changes
- `apps/web/` — frontend has no test setup yet; separate plan
- `apps/api/src/purchases/` — covered by a later plan

## Git workflow

- Branch: `advisor/001-test-baseline`
- Commits: one commit per service's spec file, e.g.
  `test(api): add auth service unit tests`
  `test(api): add dashboard service unit tests`
  `test(api): add invoices service unit tests`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Install Jest dependencies

```bash
pnpm --filter api add -D jest @nestjs/testing ts-jest @types/jest
```

**Verify**: `cat apps/api/package.json | grep '"jest"'` → shows jest version.

### Step 2: Create `apps/api/jest.config.js`

Create the file with this exact content:

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

**Verify**: `node apps/api/jest.config.js` → no errors (the file loads without throwing).

### Step 3: Add test script to `apps/api/package.json`

Add inside `"scripts"`:
```json
"test": "jest",
"test:cov": "jest --coverage"
```

**Verify**: `pnpm --filter api test -- --listTests 2>&1 | grep "No tests"` → should say
"No tests found" (no spec files yet) but exit 0.

### Step 4: Write `auth.service.spec.ts`

Create `apps/api/src/auth/auth.service.spec.ts`. The file must cover:

1. `requestOtp`: creates a new OTP record, invalidates prior unconsumed codes, and
   returns `{ sent: true }` (no `devCode`) when `AUTH_DEV_OTP` is not `'true'`.
2. `requestOtp` with `AUTH_DEV_OTP=true`: returns `{ sent: true, devCode: <string> }`.
3. `verifyOtp` with correct code: returns `{ accessToken, user, hasBusiness }`.
4. `verifyOtp` with wrong code: throws `BadRequestException`.
5. `verifyOtp` with expired code: throws `BadRequestException`.
6. `verifyOtp` after 5 failed attempts: marks code consumed, throws `BadRequestException`.

Use this test structure (mock `PrismaService` and `JwtService`):

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            otpCode: {
              updateMany: jest.fn(),
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            user: { upsert: jest.fn() },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-jwt') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
  });

  // ... tests here
});
```

Key: set up `prisma.otpCode.findFirst` to return a mock OTP object for valid-code
tests (with `{ id, code, expiresAt: future date, consumed: false, attempts: 0 }`).
For expired tests, set `expiresAt` to a past date.

**Verify**: `pnpm --filter api test -- auth.service` → all 6 cases pass.

### Step 5: Write `dashboard.service.spec.ts`

Create `apps/api/src/dashboard/dashboard.service.spec.ts`. Cover:

1. `summary()` with no invoices/purchases/expenses: all totals are 0, `netProfit` is 0.
2. `summary()` with paid invoices: `totalSales` = sum of their totals.
3. `summary()` with expenses: `totalExpenses` = sum, `netProfit` = sales − purchases − expenses.
4. `summary()` with an unpaid invoice: it appears in `unpaidInvoices`, its amount in `unpaidInvoicesTotal`.
5. `summary()` with invalid `month` string: throws `BadRequestException`.

Mock `PrismaService` with `invoice.findMany`, `purchase.findMany`, `expense.findMany`,
and `$queryRaw` (return empty array for low-stock). The
`getMonthRange` utility is real (not mocked) — let the unit test call it directly.

**Verify**: `pnpm --filter api test -- dashboard.service` → all 5 cases pass.

### Step 6: Write `invoices.service.spec.ts`

Create `apps/api/src/invoices/invoices.service.spec.ts`. Cover:

1. `findAll()` by businessId: returns only invoices matching `businessId`.
2. `findOne()` for an existing invoice: returns the invoice with items and customer.
3. `findOne()` for a non-existent invoice: throws `NotFoundException`.
4. `updateStatus()` to PAID: sets `status: 'PAID'` on the correct invoice.
5. `remove()` for an existing invoice: calls `prisma.invoice.delete`.

No need to test `create()` or `generatePdf()` in this baseline — those require
more complex mocking (transactions, PDFKit). They are marked as follow-up.

**Verify**: `pnpm --filter api test -- invoices.service` → all 5 cases pass.

### Step 7: Run full suite

```bash
pnpm --filter api test
```

**Verify**: Output shows 16 tests (or more) passing across 3 suites, exit 0.

## Test plan

Files: `auth.service.spec.ts`, `dashboard.service.spec.ts`, `invoices.service.spec.ts`
All tests mock `PrismaService` — no real database required.
Pattern to follow: standard NestJS `Test.createTestingModule` with `useValue` mocks.

## Done criteria

- [ ] `pnpm --filter api test` exits 0 with ≥ 16 tests passing
- [ ] `pnpm --filter api exec tsc --noEmit` exits 0
- [ ] `grep -r "describe\|it(" apps/api/src --include="*.spec.ts" | wc -l` outputs ≥ 16
- [ ] No source files (non-spec) were modified (`git diff --name-only HEAD | grep -v spec`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report (do not improvise) if:
- Installing Jest introduces a peer-dependency conflict with existing NestJS packages that cannot be resolved with `--legacy-peer-deps` or pnpm overrides.
- The `@nestjs/testing` module API differs from what the plan describes (check the installed version's docs).
- A test requires touching actual source files to be testable — flag it and skip that test case rather than refactoring source.
- You discover `prisma.$transaction` cannot be easily mocked without a real DB — skip `create()` tests as documented above.

## Maintenance notes

- `create()` in `InvoicesService` uses a Prisma serializable transaction and
  requires full stock logic — do not attempt to unit-test it until Plan 003 ships
  (server-side filtering, simpler service structure).
- When the SMS gateway is wired in `AuthService`, the `requestOtp` test must be
  updated to mock the SMS provider.
- `generatePdf()` in `InvoicesService` uses `PDFKit` and filesystem reads — integration
  test or e2e test, not unit; plan separately.
