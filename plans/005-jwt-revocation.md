# Plan 005: JWT revocation via token blacklist and logout endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d58f93..HEAD -- apps/api/src/auth/ apps/api/prisma/schema.prisma apps/web/components/TopBar.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — schema migration required (additive); `JwtStrategy.validate()` becomes
  async (Passport supports this natively); the `jti` claim is new, so existing
  tokens issued before this plan land have no `jti` and skip the blacklist check
  gracefully (by design).
- **Depends on**: none (safe to run alongside or after Plans 001–004)
- **Category**: security
- **Planned at**: commit `2d58f93`, 2026-07-09

## Why this matters

JWT tokens are currently issued with a 30-day lifetime and no logout endpoint. A
user who taps "تسجيل خروج" (sign out) only clears their localStorage — their
token remains valid on the server for the remainder of its 30-day window. On a
lost or shared device this is a meaningful risk: anyone with the token can access
all invoices, expenses, and business data for up to a month.

This plan:
1. Adds a `jti` (JWT ID) claim to every new token.
2. Adds a `TokenBlacklist` table indexed by `jti`.
3. Makes `JwtStrategy.validate()` async and checks the blacklist on every request.
4. Adds `POST /auth/logout` that blacklists the calling token.
5. Updates the frontend sign-out handler to call the logout endpoint before
   clearing localStorage.

Tokens issued before this plan is deployed have no `jti` and are handled gracefully
(the strategy skips the blacklist check if `jti` is absent).

## Current state

### `apps/api/prisma/schema.prisma` — relevant tail

No `TokenBlacklist` model exists. The schema has `OtpCode` with an expiry
(`expiresAt DateTime`), which is the pattern to follow for the new model.

### `apps/api/src/auth/strategies/jwt.strategy.ts`

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set — refusing to start.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): CurrentUserData {
    return {
      userId: payload.sub,
      phone: payload.phone,
      businessId: payload.businessId,
    };
  }
}
```

`PrismaService` is NOT currently injected here. `JwtStrategy` is provided in
`AuthModule` alongside `AuthService`.

### `apps/api/src/common/types/auth.types.ts`

```ts
export interface JwtPayload {
  sub: string;
  phone: string;
  businessId: string | null;
}

export interface CurrentUserData {
  userId: string;
  phone: string;
  businessId: string | null;
}
```

`jti` is not yet in `JwtPayload`.

### `apps/api/src/auth/auth.service.ts` — `signToken` method

```ts
signToken(payload: JwtPayload): string {
  return this.jwtService.sign(payload, { expiresIn: '30d' });
}
```

No `jti` is added.

### `apps/api/src/auth/auth.controller.ts`

```ts
@UseGuards(JwtAuthGuard)
@Get('me')
me(@CurrentUser() user: CurrentUserData) {
  return this.authService.me(user.userId);
}
```

No logout endpoint exists.

### `apps/web/components/TopBar.tsx` — sign-out handler

```tsx
import { clearToken } from "@/lib/auth";
// ...
function handleSignOut() {
  clearToken();
  router.replace("/login");
}
```

No API call. `apiPost` is not yet imported here.

### Repo conventions

- `PrismaModule` is global (set `isGlobal: true` in `PrismaModule` if not — check
  `prisma.module.ts`; if the module exports `PrismaService`, other modules can
  import it without re-registering).
- JWT signing: `jwtService.sign(payload, options)` accepts `jwtid` option for `jti`.
- `crypto.randomUUID()` (built-in Node 18+) generates a collision-resistant UUID.
- Error handling: throw `UnauthorizedException` from `@nestjs/common` for revoked tokens.
- Frontend `apiPost`: defined in `apps/web/lib/api.ts`; accepts `(path, body)`.

## Commands you will need

| Purpose          | Command                                              | Expected on success |
|------------------|------------------------------------------------------|---------------------|
| Prisma generate  | `pnpm --filter api prisma:generate`                  | exit 0              |
| Prisma migrate   | `pnpm --filter api exec prisma migrate dev --name add-token-blacklist` | exit 0 + migration file created |
| Build API        | `pnpm --filter api build`                            | exit 0              |
| Typecheck web    | `pnpm --filter web exec tsc --noEmit`                | exit 0              |

## Scope

**In scope**:
- `apps/api/prisma/schema.prisma` — add `TokenBlacklist` model
- `apps/api/src/common/types/auth.types.ts` — add `jti` to `JwtPayload`
- `apps/api/src/auth/strategies/jwt.strategy.ts` — inject `PrismaService`, async validate
- `apps/api/src/auth/auth.service.ts` — add `jti` to `signToken`, add `logout()` method
- `apps/api/src/auth/auth.controller.ts` — add `POST /auth/logout` endpoint
- `apps/web/components/TopBar.tsx` — call API logout before clearing localStorage

**Out of scope**:
- `apps/api/src/auth/auth.module.ts` — `PrismaModule` is global; no import needed
- Any other file
- localStorage-to-httpOnly-cookie migration — separate architectural decision
- Periodic cleanup of expired blacklist entries — noted in Maintenance

## Git workflow

- Branch: `advisor/005-jwt-revocation`
- Commits:
  1. `feat(api): add TokenBlacklist model and migration`
  2. `feat(api): add jti claim, logout endpoint, blacklist check`
  3. `feat(web): call API logout on sign-out`

## Steps

### Step 1: Add `TokenBlacklist` to Prisma schema

Append to `apps/api/prisma/schema.prisma`, after the `OtpCode` model:

```prisma
model TokenBlacklist {
  jti       String   @id
  expiresAt DateTime
  createdAt DateTime @default(now())

  // Enables efficient cleanup of expired entries.
  @@index([expiresAt])
}
```

Run:
```bash
pnpm --filter api exec prisma migrate dev --name add-token-blacklist
pnpm --filter api prisma:generate
```

**Verify**: `ls apps/api/prisma/migrations/ | grep token_blacklist` → new migration directory listed.

### Step 2: Add `jti` to `JwtPayload` in `auth.types.ts`

In `apps/api/src/common/types/auth.types.ts`, add the optional `jti` field:

```ts
export interface JwtPayload {
  sub: string;
  phone: string;
  businessId: string | null;
  jti?: string;   // present on tokens issued after plan 005
}
```

**Verify**: `pnpm --filter api exec tsc --noEmit` → exit 0 (type change is additive).

### Step 3: Update `signToken` in `AuthService` to include `jti`

In `apps/api/src/auth/auth.service.ts`, update `signToken`:

```ts
signToken(payload: JwtPayload): string {
  return this.jwtService.sign(payload, {
    expiresIn: '30d',
    jwtid: crypto.randomUUID(),  // adds 'jti' claim to the token
  });
}
```

Add the import at the top of the file (Node built-in):

```ts
import { randomInt, randomUUID } from 'crypto';
```

(Replace the existing `import { randomInt } from 'crypto';` with this line.)

**Verify**: `pnpm --filter api build` → exit 0.

### Step 4: Add `logout()` method to `AuthService`

In `apps/api/src/auth/auth.service.ts`, add after the `me()` method:

```ts
async logout(rawToken: string): Promise<void> {
  const payload = this.jwtService.decode(rawToken) as JwtPayload & { exp?: number };
  const jti = payload?.jti;
  if (!jti) return; // token pre-dates plan 005 — can't blacklist, expires naturally
  const expiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await this.prisma.tokenBlacklist.upsert({
    where: { jti },
    update: {},
    create: { jti, expiresAt },
  });
}
```

**Verify**: `pnpm --filter api exec tsc --noEmit` → exit 0.

### Step 5: Add `POST /auth/logout` to `AuthController`

In `apps/api/src/auth/auth.controller.ts`, add the `@Req` import and a new endpoint:

```ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
```

Add after the `me` route:

```ts
@UseGuards(JwtAuthGuard)
@Post('logout')
async logout(@Req() req: Request) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) await this.authService.logout(token);
  return { loggedOut: true };
}
```

**Verify**: `pnpm --filter api build` → exit 0.

### Step 6: Make `JwtStrategy.validate()` async and check the blacklist

In `apps/api/src/auth/strategies/jwt.strategy.ts`, inject `PrismaService` and add
blacklist check. Full replacement:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserData, JwtPayload } from '../../common/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not set — refusing to start.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserData> {
    if (payload.jti) {
      const revoked = await this.prisma.tokenBlacklist.findUnique({
        where: { jti: payload.jti },
      });
      if (revoked) throw new UnauthorizedException('Token has been revoked');
    }
    return {
      userId: payload.sub,
      phone: payload.phone,
      businessId: payload.businessId,
    };
  }
}
```

**Verify**: `pnpm --filter api build` → exit 0.

### Step 7: Update `TopBar.tsx` to call logout endpoint before clearing localStorage

In `apps/web/components/TopBar.tsx`, add `apiPost` import and update `handleSignOut`:

```tsx
import { clearToken } from "@/lib/auth";
import { apiPost } from "@/lib/api";

// ...

async function handleSignOut() {
  try {
    await apiPost('/auth/logout', {});
  } catch {
    // If the request fails (network error, expired token), still sign out locally.
  } finally {
    clearToken();
    router.replace("/login");
  }
}
```

Change `function handleSignOut()` to `async function handleSignOut()`.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0.

### Step 8: Manual smoke test

With dev servers running:
1. Log in with OTP, get a JWT.
2. Verify `/api/auth/me` returns user data (token is valid).
3. Click "تسجيل خروج" (sign out) in the app.
4. Try to call `/api/auth/me` with the same token (e.g. via curl or Postman).
5. Confirm the response is `401 Unauthorized` with the message "Token has been revoked".

**Verify**: `curl http://localhost:3001/api/auth/me -H "Authorization: Bearer <old-token>"` → `{"statusCode":401,"message":"Token has been revoked"}`.

## Test plan

If Plan 001 is done, add tests to `auth.service.spec.ts`:

1. `logout()` with a token that has a `jti` claim: inserts a row into `TokenBlacklist` via `prisma.tokenBlacklist.upsert`.
2. `logout()` with a token that has no `jti` (pre-plan-005 token): returns without calling `prisma`.
3. Mock `JwtStrategy.validate()`: if `prisma.tokenBlacklist.findUnique` returns a record, `UnauthorizedException` is thrown.
4. Mock `JwtStrategy.validate()`: if `findUnique` returns null, returns the `CurrentUserData` object.

## Done criteria

- [ ] Migration file exists in `apps/api/prisma/migrations/` with `token_blacklist` in the name
- [ ] `pnpm --filter api build` exits 0
- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] After logout, the old token returns `401 Unauthorized` (manual smoke test Step 8)
- [ ] New tokens (after this plan) contain a `jti` claim (decode a new token at jwt.io to confirm)
- [ ] Old tokens (no `jti`) still work — the blacklist check is skipped gracefully
- [ ] Only in-scope files modified (`git diff --name-only HEAD`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `prisma migrate dev` fails because the database is not running or has an existing
  unresolved migration — resolve the migration state first, then retry.
- `JwtStrategy` constructor fails to receive `PrismaService` (`Cannot inject
  PrismaService into JwtStrategy`) — verify that `PrismaModule` exports
  `PrismaService` and is marked global (or import `PrismaModule` in `AuthModule`).
- `passport-jwt` doesn't support async `validate()` — in practice it does support
  Promises; if the version in this repo doesn't, upgrade `passport-jwt` to 4.0.0+.
- Step 8 smoke test shows the old token is still accepted — confirm the `jti` was
  written to `TokenBlacklist` by checking the DB directly:
  `SELECT * FROM "TokenBlacklist" ORDER BY "createdAt" DESC LIMIT 1;`

## Maintenance notes

- `TokenBlacklist` entries are never deleted automatically. For long-running
  production deployments, add a cron job (or NestJS `@Cron` task) that runs
  `DELETE FROM "TokenBlacklist" WHERE "expiresAt" < NOW()` once daily.
- Tokens issued before plan 005 deploys have no `jti` and skip the blacklist check
  permanently — they expire naturally after 30 days. No data migration is needed.
- If short-lived access tokens (e.g. 1h) with refresh tokens are introduced later,
  the blacklist should target refresh tokens instead (they're long-lived), and
  access tokens can remain stateless.
- The `@@index([expiresAt])` makes cleanup queries fast; include it when the
  cleanup job is added.
