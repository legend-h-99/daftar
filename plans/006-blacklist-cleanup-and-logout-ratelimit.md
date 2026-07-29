# Plan 006: TokenBlacklist gets a cleanup cron and logout gets a rate limit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```
> git diff --stat a82de24..HEAD -- apps/api/src/auth/auth.controller.ts apps/api/src/app.module.ts
> ```
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/005-jwt-revocation.md (TokenBlacklist table must exist)
- **Category**: security
- **Planned at**: commit `a82de24`, 2026-07-09

## Why this matters

Plan 005 introduced JWT revocation via the `TokenBlacklist` table: every
logout writes one row. Without a cleanup job those rows accumulate forever —
every authenticated request queries the full table, so latency grows
proportionally to the number of users who have ever logged out. Additionally,
`POST /auth/logout` currently has no per-IP rate limit; an attacker with a
valid JWT can flood the table with legitimate blacklist entries (30 d expiry
each) to amplify the growth. Both problems are cheap to fix and should land
together.

## Current state

### `apps/api/src/auth/auth.controller.ts` — logout has no `@Throttle`

```ts
// auth.controller.ts:35-42
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) await this.authService.logout(token);
    return { loggedOut: true };
  }
```

OTP request endpoint (same file, line 17) shows the throttle pattern to
follow: `@Throttle({ default: { ttl: 60_000, limit: 5 } })`.

### `apps/api/src/app.module.ts` — `ScheduleModule` is absent

```ts
// app.module.ts imports list (no ScheduleModule):
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// ... PrismaModule, AuthModule, ... PurchasesModule
```

`@nestjs/schedule` is not in `apps/api/package.json` yet.

### `apps/api/prisma/schema.prisma` — TokenBlacklist has `@@index([expiresAt])`

```prisma
model TokenBlacklist {
  jti       String   @id
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
}
```

The index on `expiresAt` already exists, so the `deleteMany` cleanup query
will be efficient.

### Conventions to match

- All NestJS modules live in `apps/api/src/<module>/` with a `<module>.module.ts` and `<module>.service.ts`.
- Existing exemplar for a background job pattern: none yet — this is the first cron in the project. Follow standard NestJS `@nestjs/schedule` patterns.
- Import order in `app.module.ts`: alphabetical-ish; add `ScheduleModule` after `PrismaModule`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install dep | `cd apps/api && pnpm add @nestjs/schedule` | exit 0, package added |
| Typecheck API | `pnpm --filter api exec tsc --noEmit` | exit 0, no errors |
| Run API tests | `pnpm --filter api test` | all pass |
| Verify multer (optional) | `pnpm --filter api exec pnpm why multer` | multer@2.x listed |

## Scope

**In scope** (the only files you should modify or create):
- `apps/api/src/auth/auth.controller.ts` — add `@Throttle` to logout
- `apps/api/src/cleanup/cleanup.module.ts` — create new module
- `apps/api/src/cleanup/cleanup.service.ts` — create new service with cron job
- `apps/api/src/app.module.ts` — register `ScheduleModule` and `CleanupModule`
- `apps/api/package.json` — add `@nestjs/schedule` dependency

**Out of scope** (do NOT touch):
- `apps/api/prisma/schema.prisma` — the index already exists; no schema change needed
- `apps/api/src/auth/auth.service.ts` — logout logic is correct; only the controller needs `@Throttle`
- Any other module or file not listed above

## Git workflow

- Branch: `advisor/006-blacklist-cleanup-and-logout-ratelimit`
- Commit message style follows conventional commits (examples from git log:
  `feat(web): ...`, `fix(api): ...`).
- Suggested: one commit — `feat(api): add TokenBlacklist cleanup cron and logout rate limit`
- Do NOT push or open a PR.

## Steps

### Step 1: Add `@Throttle` to the logout endpoint

Open `apps/api/src/auth/auth.controller.ts`.

Add `@Throttle({ default: { ttl: 60_000, limit: 20 } })` immediately before
`@UseGuards(JwtAuthGuard)` on the logout method. 20 logouts/min per IP is
generous for legitimate use and stops bulk blacklist flooding.

After the edit the logout block should look like:

```ts
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) await this.authService.logout(token);
    return { loggedOut: true };
  }
```

**Verify**: `grep -n 'Throttle' apps/api/src/auth/auth.controller.ts` → three
lines (one for each of `otp/request`, `otp/verify`, and now `logout`).

### Step 2: Install `@nestjs/schedule`

```bash
cd apps/api && pnpm add @nestjs/schedule
```

**Verify**: `grep '@nestjs/schedule' apps/api/package.json` → prints the entry
with a version like `^4.x.x`.

### Step 3: Create `CleanupService`

Create the file `apps/api/src/cleanup/cleanup.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredBlacklistEntries() {
    const result = await this.prisma.tokenBlacklist.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Purged ${result.count} expired TokenBlacklist entries`);
    }
  }
}
```

**Verify**: The file exists and TypeScript can see it — `pnpm --filter api exec tsc --noEmit` → exit 0 is acceptable after step 4 (module not registered yet will cause an import error, so wait for the next step).

### Step 4: Create `CleanupModule`

Create the file `apps/api/src/cleanup/cleanup.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [CleanupService],
})
export class CleanupModule {}
```

### Step 5: Register `ScheduleModule` and `CleanupModule` in `AppModule`

Open `apps/api/src/app.module.ts`.

1. Add imports at the top:
   ```ts
   import { ScheduleModule } from '@nestjs/schedule';
   import { CleanupModule } from './cleanup/cleanup.module';
   ```

2. In the `imports` array, add `ScheduleModule.forRoot()` (after `ThrottlerModule`)
   and `CleanupModule` (after `PurchasesModule`, keeping the alphabetical-ish
   order — or at the end of the list):

   ```ts
   ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
   ScheduleModule.forRoot(),   // ← add this line
   PrismaModule,
   AuthModule,
   // ... existing modules ...
   PurchasesModule,
   CleanupModule,              // ← add this line
   ```

**Verify**: `pnpm --filter api exec tsc --noEmit` → exit 0, no errors.

## Test plan

No new unit test is needed for the cron — the job is a single `deleteMany`
call and the behaviour is verified by the types and integration with the DB.
The rate-limit change is also not unit-testable at the service level.

The spec file to update is `apps/api/src/auth/auth.service.spec.ts` — no
change required; the throttle decorator is on the controller, not the service.

**Manual smoke test** (optional): Start the dev API server
(`pnpm --filter api start:dev`), call `POST /auth/logout` with a valid JWT
more than 20 times within a minute from the same IP. The 21st call should
return HTTP 429.

## Done criteria

- [ ] `grep -n 'Throttle' apps/api/src/auth/auth.controller.ts` returns 3 lines
- [ ] `apps/api/src/cleanup/cleanup.service.ts` exists with `@Cron` decorator
- [ ] `apps/api/src/cleanup/cleanup.module.ts` exists
- [ ] `grep 'ScheduleModule' apps/api/src/app.module.ts` → found
- [ ] `grep 'CleanupModule' apps/api/src/app.module.ts` → found
- [ ] `pnpm --filter api exec tsc --noEmit` exits 0
- [ ] `pnpm --filter api test` exits 0 (existing 16 tests all pass)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- `auth.controller.ts` already has `@Throttle` on logout (drift — someone else fixed it).
- `@nestjs/schedule` is already in `apps/api/package.json` (check version; if >=3.x it's fine to use it, just skip `pnpm add`).
- `pnpm --filter api exec tsc --noEmit` fails with errors unrelated to your changes (pre-existing broken build — report it).
- The Prisma client does not recognise `tokenBlacklist` (plan 005 migration not applied to the running database).

## Maintenance notes

- The `purgeExpiredBlacklistEntries` cron runs at 03:00 server local time.
  If the production server is in UTC and users are in AST (UTC+3), 03:00 UTC
  = 06:00 local — acceptable. If the time zone ever matters, switch to a
  `@Cron('0 3 * * *', { timeZone: 'Asia/Riyadh' })` expression.
- When real SMS is wired up and OTP codes accumulate, a similar cleanup for
  `OtpCode` (where `consumed = true` or `expiresAt < now`) would belong in
  the same `CleanupService`.
- Reviewers should check that the `@Cron` decorator is imported from
  `@nestjs/schedule`, not from any other package.
