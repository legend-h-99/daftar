# Plan 012: Fix biometric auth race condition and missing token validation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 347b684..HEAD -- apps/mobile/app/index.tsx apps/mobile/app/\(auth\)/login.tsx apps/mobile/src/store/auth.store.ts apps/mobile/src/lib/api.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug + security
- **Planned at**: commit `347b684`, 2026-07-17

## Why this matters

Two related issues in the biometric authentication flow:

**Bug (race condition):** `tryBiometric()` is an `async` function called without
`await` at `app/index.tsx:58`. The component's render logic runs immediately
after the call — before the async biometric auth completes — and emits a
`<Redirect href="/(auth)/login" />` for unauthenticated users. When biometric
then succeeds, it calls `router.replace('/(tabs)/dashboard')` on top of an
already-navigated login screen, creating an unpredictable navigation stack.

**Security:** The biometric gate checks for a stored JWT (`getToken()`) and an
enrollment flag (`BIOMETRIC_KEY`) but never validates that the token is still
accepted by the server. A user who restores a device backup or clones the device
can carry over a revoked or expired JWT + the enrollment flag, and bypass the
OTP gate entirely on login. The `/(tabs)/*` screens depend on JWT validity at
the API level (401 → redirect to login), but there's a window of navigation
before the first API call where the user appears authenticated.

## Current state

**`app/index.tsx` (full file, 67 lines):**
```tsx
// line 13–60 — the useEffect
useEffect(() => {
  if (isLoading || biometricAttempted.current) return;

  async function tryBiometric() {
    biometricAttempted.current = true;

    const token = await getToken();
    if (!token) return;

    const enrolled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    if (enrolled !== 'true') return;
    // ... hardware/enrollment checks ...

    let attempts = 0;
    while (attempts < 3) {
      const result = await LocalAuthentication.authenticateAsync({ ... });
      if (result.success) {
        router.replace('/(tabs)/dashboard');   // ← succeeds asynchronously
        return;
      }
      // ...
    }
    router.replace('/(auth)/login');
  }

  if (!isAuthenticated) {
    tryBiometric();   // ← line 58: called WITHOUT await
  }
}, [isLoading, isAuthenticated]);

// line 62–66 — render runs immediately
if (isLoading) return null;
return isAuthenticated
  ? <Redirect href="/(tabs)/dashboard" />
  : <Redirect href="/(auth)/login" />;   // ← this fires before tryBiometric() finishes
```

**`src/lib/api.ts` (line 12):** exports `apiClient` with a `me` equivalent
check available via the interceptors. The API exposes `GET /api/auth/me` (verify
this exists by checking `apps/api/src/auth/auth.controller.ts` — look for a
`@Get('me')` or equivalent profile endpoint).

**Convention:** Auth store is in `src/store/auth.store.ts` using Zustand.
The `isLoading` flag already gates the render — extend this pattern.

## Commands you will need

| Purpose    | Command                              | Expected on success      |
|------------|--------------------------------------|--------------------------|
| Typecheck  | `cd apps/mobile && npx tsc --noEmit` | exit 0, zero errors      |
| API check  | `grep -n "@Get" apps/api/src/auth/auth.controller.ts` | lists all GET routes in auth |

## Scope

**In scope**:
- `apps/mobile/app/index.tsx` — fix the unawaited call; add biometric loading state

**Out of scope**:
- `apps/mobile/app/(auth)/login.tsx` — the biometric button there is a
  convenience UX shortcut, not the security gate; leave it as-is
- `apps/mobile/src/store/auth.store.ts` — no store changes needed
- Any API files
- `apps/mobile/app/(tabs)/` — no changes

## Git workflow

- Branch: `advisor/012-biometric-race-fix`
- Commit: `fix(mobile): await tryBiometric to prevent race condition with Redirect`

## Steps

### Step 1: Check whether `GET /api/auth/me` exists in the API

```bash
grep -n "@Get\|@Post" apps/api/src/auth/auth.controller.ts
```

**If you see a `@Get('me')` or `@Get('profile')` route**: note its exact path.
You will use it in Step 3 to validate the token post-biometric.

**If no such route exists**: STOP and report. Do not improvise a token
validation call against a non-existent endpoint. Report which routes do exist.

### Step 2: Add a biometric-in-progress loading state to `app/index.tsx`

The fix has two parts:

**Part A — add a `biometricPending` state** so the render holds while async
auth runs:

```tsx
const [biometricPending, setBiometricPending] = React.useState(false);
```

**Part B — set it before calling, clear it when done, and `await` the call**:

Inside the `useEffect`, change the call site from:
```tsx
if (!isAuthenticated) {
  tryBiometric();   // OLD — no await
}
```
to:
```tsx
if (!isAuthenticated) {
  setBiometricPending(true);
  await tryBiometric();
  setBiometricPending(false);
}
```

Note: `useEffect` callbacks cannot themselves be `async`. Wrap the body in an
IIFE:
```tsx
useEffect(() => {
  if (isLoading || biometricAttempted.current) return;

  (async () => {
    if (!isAuthenticated) {
      setBiometricPending(true);
      await tryBiometric();
      setBiometricPending(false);
    }
  })();
}, [isLoading, isAuthenticated]);
```

**Part C — gate the render on `biometricPending`**:

Change:
```tsx
if (isLoading) return null;
```
to:
```tsx
if (isLoading || biometricPending) return null;
```

This prevents the `<Redirect>` from firing while biometric is in progress.

**Verify**: `cd apps/mobile && npx tsc --noEmit` → exit 0

### Step 3: Add server-side token validation after biometric success

Inside `tryBiometric()`, after the `if (result.success)` check, before calling
`router.replace('/(tabs)/dashboard')`:

```tsx
if (result.success) {
  // Validate token is still accepted by server
  try {
    await apiClient.get('/auth/me');  // or the correct path from Step 1
    router.replace('/(tabs)/dashboard');
  } catch {
    // Token is expired or revoked — clear and go to login
    await clearToken();
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    router.replace('/(auth)/login');
  }
  return;
}
```

Import `apiClient` and `clearToken` from `../../src/lib/api` (already imported
in the file as `getToken` — add `apiClient` and `clearToken` to the import).
Import `SecureStore` from `expo-secure-store` (already imported).

**If Step 1 found no `/auth/me` route**: STOP here. Do not fabricate an
endpoint. Report back.

**Verify**: `cd apps/mobile && npx tsc --noEmit` → exit 0

## Test plan

No automated test file exists for this component. The verification is behavioral:

1. **Race condition fix**: Open app with a stored JWT + biometric enrolled →
   confirm only ONE navigation event fires (dashboard), not login then dashboard.
2. **Token validation**: Manually expire/delete the token from SecureStore while
   keeping `biometric_enrolled: true` → open app → biometric prompt appears →
   on success → app should redirect to login (token invalid), not dashboard.

These are manual verification steps; document results in NOTES when reporting.

## Done criteria

- [ ] `cd apps/mobile && npx tsc --noEmit` exits 0
- [ ] `app/index.tsx` contains `biometricPending` state variable
- [ ] `app/index.tsx` contains `await tryBiometric()` (not just `tryBiometric()`)
- [ ] `app/index.tsx` render block returns `null` when `biometricPending` is true
- [ ] `app/index.tsx` calls `apiClient.get(...)` inside the `result.success` branch
- [ ] `git status` shows only `apps/mobile/app/index.tsx` modified
- [ ] `plans/README.md` status row for 012 updated to DONE

## STOP conditions

- Step 1 finds no `GET /auth/me` (or equivalent) route in the API controller.
- TypeScript errors appear in files other than `app/index.tsx` after changes.
- The biometric prompt stops appearing after the fix (indicates the `biometricPending` 
  flag is being set incorrectly).

## Maintenance notes

- The `/auth/me` call adds latency on app open for biometric users. If this
  becomes a UX concern, the response can be used to pre-warm TanStack Query's
  user cache (pass to `queryClient.setQueryData`).
- If JWT expiry behavior changes in the API (e.g., silent refresh), revisit the
  `catch` branch to handle 401 vs. network errors differently.
- The biometric enrollment flag (`BIOMETRIC_KEY`) is cleared on token
  validation failure. This is intentional — if the token is gone, re-enrollment
  should be required after the next OTP login.
