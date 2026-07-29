# Plan 008: Harden AUTH_DEV_OTP guard with an allowlist instead of a blocklist

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```
> git diff --stat a82de24..HEAD -- apps/api/src/auth/auth.service.ts
> ```
> Compare the excerpt in "Current state" against the live code before editing.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a82de24`, 2026-07-09

## Why this matters

`AUTH_DEV_OTP=true` causes the API to include the one-time password in the
HTTP response body — a deliberate dev/demo convenience that must never run in
production. The current guard only rejects it when `NODE_ENV === 'production'`.
That is a blocklist: any value other than the string `'production'` (including
`'prod'`, `'staging'`, an empty string, or an unset variable) silently passes
the guard. The safer pattern is an allowlist: permit `AUTH_DEV_OTP=true` only
when `NODE_ENV` is explicitly `'development'` or `'test'`. Any other value
(including production-like strings that aren't exactly `'production'`) causes
the process to refuse to start with a clear error message.

## Current state

### `apps/api/src/auth/auth.service.ts` lines 28–36

```ts
    this.devOtpEnabled = configService.get<string>('AUTH_DEV_OTP') === 'true';

    if (this.devOtpEnabled && configService.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'AUTH_DEV_OTP must not be enabled in production. ' +
        'Remove it from your environment or set it to false.',
      );
    }
```

The problem is on line 30: the condition `=== 'production'` is a blocklist.
If `NODE_ENV` is `'prod'`, `'staging'`, or simply not set, a deployment with
`AUTH_DEV_OTP=true` will start successfully and leak OTP codes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm --filter api exec tsc --noEmit` | exit 0 |
| Tests | `pnpm --filter api test` | all pass |

## Scope

**In scope**:
- `apps/api/src/auth/auth.service.ts` — change lines 30–35 only

**Out of scope** (do NOT touch):
- Any test file — the existing `auth.service.spec.ts` test for the guard will
  need a one-line update (see Test plan below), but the scope is narrow
- Any other file

## Git workflow

- Branch: `advisor/008-dev-otp-allowlist-guard`
- Commit: `fix(api): harden AUTH_DEV_OTP guard — allowlist NODE_ENV instead of blocklist`
- Do NOT push or open a PR.

## Steps

### Step 1: Replace the blocklist check with an allowlist

Open `apps/api/src/auth/auth.service.ts`.

Replace lines 30–35 (the `if` block) with the following:

```ts
    const allowedEnvs = new Set(['development', 'test']);
    if (this.devOtpEnabled && !allowedEnvs.has(configService.get<string>('NODE_ENV') ?? '')) {
      throw new Error(
        'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test". ' +
        'Remove AUTH_DEV_OTP or set it to false in this environment.',
      );
    }
```

The full constructor block after the edit:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.devOtpEnabled = configService.get<string>('AUTH_DEV_OTP') === 'true';

    const allowedEnvs = new Set(['development', 'test']);
    if (this.devOtpEnabled && !allowedEnvs.has(configService.get<string>('NODE_ENV') ?? '')) {
      throw new Error(
        'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test". ' +
        'Remove AUTH_DEV_OTP or set it to false in this environment.',
      );
    }
  }
```

Do not change anything else in the file.

**Verify**: `grep -n 'allowedEnvs' apps/api/src/auth/auth.service.ts` → one
match on the new line.

### Step 2: Update the spec to match the new error message

Open `apps/api/src/auth/auth.service.spec.ts`.

Find the test case that verifies the production guard. It will look like:

```ts
it('should throw if AUTH_DEV_OTP=true and NODE_ENV=production', () => {
```

Update the `configService.get` mock so it returns `'production'` for
`NODE_ENV`. The test should still throw — it will pass without further changes
because `'production'` is not in `allowedEnvs`. However, if the test also
asserts the exact error message string, update the expected string to match
the new message:

> `'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test".'`

Check whether `toThrow(...)` in the test uses a string or regexp argument:
- If `toThrow()` with no argument: no change needed.
- If `toThrow('AUTH_DEV_OTP must not be enabled in production')`: update to
  the new message prefix.

**Verify**: `pnpm --filter api test` → all 16 tests pass (or however many
existed before this plan).

## Test plan

The existing spec already tests the constructor guard. The change in step 2
covers the regression. No new test file is needed.

To confirm the allowlist semantics work beyond the original `'production'`
case, optionally add one more `it` block in `auth.service.spec.ts`:

```ts
it('should throw if AUTH_DEV_OTP=true and NODE_ENV=staging', () => {
  const configGet = jest.fn().mockImplementation((key: string) => {
    if (key === 'AUTH_DEV_OTP') return 'true';
    if (key === 'NODE_ENV') return 'staging';
    return undefined;
  });
  const configService = { get: configGet } as unknown as ConfigService;
  expect(() => new AuthService(mockPrisma, mockJwt, configService)).toThrow(
    'AUTH_DEV_OTP is only allowed when NODE_ENV is "development" or "test"',
  );
});
```

This test is optional but recommended.

**Verify**: `pnpm --filter api test` exits 0.

## Done criteria

- [ ] `grep 'allowedEnvs' apps/api/src/auth/auth.service.ts` → found
- [ ] `grep 'NODE_ENV.*production' apps/api/src/auth/auth.service.ts` → no matches (old guard gone)
- [ ] `pnpm --filter api exec tsc --noEmit` exits 0
- [ ] `pnpm --filter api test` exits 0
- [ ] Only `apps/api/src/auth/auth.service.ts` and `apps/api/src/auth/auth.service.spec.ts` are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- The code at `auth.service.ts:28-36` does not match the "Current state"
  excerpt (the file may have been changed by another plan or by the user).
- The existing spec test for the guard is missing entirely — report it; do not
  guess what the test was supposed to check.
- `tsc --noEmit` fails after the edit — report the exact error.

## Maintenance notes

- If the project ever adds a `'staging'` environment that should also allow
  dev OTPs (e.g. for QA), add `'staging'` to the `allowedEnvs` Set. The
  allowlist pattern makes this explicit and visible in code review, unlike the
  old blocklist.
- The `?? ''` fallback handles the case where `NODE_ENV` is not set at all —
  an empty string is not in `allowedEnvs`, so an unset `NODE_ENV` with
  `AUTH_DEV_OTP=true` will correctly refuse to start.
