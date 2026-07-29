# Plan 011: Fix mobile tab bar showing extra routes for invoices sub-screens

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 347b684..HEAD -- apps/mobile/app/\(tabs\)/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `347b684`, 2026-07-17

## Why this matters

Expo Router auto-discovers every file inside `app/(tabs)/` and renders it as a
tab in the bottom tab bar — including files inside sub-directories — unless a
`_layout.tsx` in that sub-directory claims them into a nested navigator. Without
one, `app/(tabs)/invoices/new.tsx` and `app/(tabs)/invoices/[id].tsx` appear as
two orphaned tabs alongside the intended 5, producing a 7-tab bar with truncated
"invoices..." labels. This was confirmed on iOS Simulator: users see broken
navigation with no way to reach the extra tabs intentionally.

## Current state

**Directory structure (verified):**
```
app/(tabs)/
  _layout.tsx          ← defines 5 Tabs.Screen entries: dashboard, invoices, customers, expenses, more
  dashboard.tsx
  invoices.tsx
  customers.tsx
  expenses.tsx
  more.tsx
  invoices/
    [id].tsx           ← invoice detail screen
    new.tsx            ← new invoice form
    ← NO _layout.tsx  ← ROOT CAUSE: Expo Router sees these as tab routes
```

**`app/(tabs)/_layout.tsx` (lines 32–66)** defines exactly 5 named screens:
```tsx
<Tabs.Screen name="dashboard" options={{ title: 'الرئيسية', ... }} />
<Tabs.Screen name="invoices"  options={{ title: 'الفواتير', ... }} />
<Tabs.Screen name="customers" options={{ title: 'الزباين', ... }} />
<Tabs.Screen name="expenses"  options={{ title: 'المصاريف', ... }} />
<Tabs.Screen name="more"      options={{ title: 'المزيد', ... }} />
```

**`app.json` (relevant):**
```json
"plugins": [["expo-router", { "typedRoutes": true }]]
```
`typedRoutes: true` does not affect route discovery; auto-discovery is always on.

**Fix**: add `app/(tabs)/invoices/_layout.tsx` with a Stack navigator. Expo Router
will then treat `[id].tsx` and `new.tsx` as screens inside the invoices stack,
not as top-level tabs. The `invoices.tsx` becomes the stack's initial/index screen.

**Convention to follow**: look at how the project uses Expo Router — it uses
file-based routing with `Redirect` in `app/index.tsx` and `Tabs` in
`app/(tabs)/_layout.tsx`. The new Stack layout follows the same pattern.

## Commands you will need

| Purpose    | Command                                             | Expected on success        |
|------------|-----------------------------------------------------|----------------------------|
| Typecheck  | `cd apps/mobile && npx tsc --noEmit`                | exit 0, zero errors        |
| Dev server | `cd apps/mobile && npx expo start --port 8083 --ios`| starts Metro, opens Simulator |

## Scope

**In scope** (the only files you should create or modify):
- `apps/mobile/app/(tabs)/invoices/_layout.tsx` — CREATE this file

**Out of scope** (do NOT touch):
- `apps/mobile/app/(tabs)/_layout.tsx` — tab layout is correct; do not change
- `apps/mobile/app/(tabs)/invoices/new.tsx` — no changes needed
- `apps/mobile/app/(tabs)/invoices/[id].tsx` — no changes needed
- Any API or web files

## Git workflow

- Branch: `advisor/011-mobile-tab-bar-fix`
- Commit message: `fix(mobile): add Stack layout for invoices sub-screens to prevent tab bar duplication`

## Steps

### Step 1: Create `apps/mobile/app/(tabs)/invoices/_layout.tsx`

Create the file with this exact content:

```tsx
import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants';

export default function InvoicesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.surfaceApp },
      }}
    />
  );
}
```

**Why `headerShown: false`**: the individual screens (`invoices.tsx`, `[id].tsx`,
`new.tsx`) manage their own headers (or use `ScreenContainer`); a Stack header
would double-render.

**Why `contentStyle`**: matches the app's surface color so there's no flash of
white during screen transitions.

**Verify**: `ls apps/mobile/app/\(tabs\)/invoices/` → output includes `_layout.tsx`, `[id].tsx`, `new.tsx`

### Step 2: Typecheck

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: exit 0, zero errors. If you see errors referencing `_layout.tsx`,
check that the import path `../../../src/constants` resolves — it points to
`apps/mobile/src/constants/index.ts`.

**Verify**: exit code 0, no TypeScript errors in output.

### Step 3: Smoke-test on iOS Simulator

Start the dev server:
```bash
cd apps/mobile && npx expo start --port 8083 --ios
```

Confirm in the Simulator:
1. Bottom tab bar shows exactly **5 tabs**: الرئيسية، الفواتير، الزباين، المصاريف، المزيد
2. No extra "invoices..." tabs
3. Tapping الفواتير still shows the invoices list
4. Navigating from the invoices list to a detail screen works without showing the tab bar header

If you cannot run the Simulator, confirm only steps 1–2 (typecheck).

## Test plan

No automated test file needed for a routing layout — the verification is the
visual tab count. The typecheck gate (`tsc --noEmit`) is the machine-checkable
criterion.

If a test harness is added in a future plan, add a navigation integration test
that mounts `TabsLayout` and asserts exactly 5 `Tabs.Screen` children.

## Done criteria

Machine-checkable:

- [ ] `apps/mobile/app/(tabs)/invoices/_layout.tsx` exists
- [ ] `cd apps/mobile && npx tsc --noEmit` exits 0
- [ ] `git status` shows only the one new file
- [ ] `plans/README.md` status row for 011 updated to DONE

## STOP conditions

Stop and report if:

- `tsc --noEmit` produces errors that were not present before this change (i.e.,
  the error references a file other than the new `_layout.tsx`).
- The Simulator still shows extra tabs after the file is created (Expo Router
  may need a full Metro cache clear: `npx expo start --clear`).
- Navigating to an invoice detail screen causes a crash or blank screen.

## Maintenance notes

- If a new sub-flow is added inside `(tabs)/` (e.g., `customers/[id].tsx`), it
  needs its own `_layout.tsx` using the same pattern, or it will create orphaned
  tabs.
- Expo Router's auto-discovery behavior is version-sensitive; if Expo SDK is
  upgraded, re-verify the tab count after the upgrade.
