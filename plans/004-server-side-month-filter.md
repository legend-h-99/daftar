# Plan 004: Move month filtering server-side for invoices and purchases

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d58f93..HEAD -- apps/api/src/invoices/ apps/api/src/purchases/ apps/web/app/\(app\)/invoices/page.tsx apps/web/app/\(app\)/purchases/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — changes both API and frontend; the in-flight fetch on month change
  may flash an empty state briefly. Test month switching manually.
- **Depends on**: none
- **Category**: perf / tech-debt
- **Planned at**: commit `2d58f93`, 2026-07-09

## Why this matters

Both the invoices and purchases pages fetch **every record the business has ever
created**, then filter by month in the browser via `useMemo`. For a business with
2 years of data this can be 300+ rows transferred on every page load, only to
discard 95% of them. The backend already has a `getMonthRange()` utility and the
`getMonthRange` pattern is used by the dashboard — it just hasn't been wired to
the list endpoints yet.

After this plan: frontend passes `?month=YYYY-MM`, backend returns only the
relevant month's records, and the client-side `month` filter in `useMemo` becomes
a no-op identity (removed to avoid confusion).

## Current state

### `apps/api/src/invoices/dto/find-invoices-query.dto.ts`

```ts
import { IsEnum, IsOptional } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class FindInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
```

### `apps/api/src/invoices/invoices.service.ts` — `findAll` method

```ts
findAll(businessId: string, query: FindInvoicesQueryDto) {
  return this.prisma.invoice.findMany({
    where: { businessId, status: query.status },
    include: { customer: true },
    orderBy: { number: 'desc' },
  });
}
```

### `apps/api/src/purchases/purchases.service.ts` — `findAll` method

```ts
findAll(businessId: string) {
  return this.prisma.purchase.findMany({
    where: { businessId },
    include: { supplier: true, items: true },
    orderBy: { number: 'desc' },
  });
}
```

### `apps/api/src/purchases/purchases.controller.ts` — `findAll` method

```ts
@Get()
findAll(@CurrentUser() user: CurrentUserData) {
  return this.purchasesService.findAll(user.businessId as string);
}
```

### `apps/web/app/(app)/invoices/page.tsx` — fetch pattern (lines 30–50)

```tsx
useEffect(() => {
  let cancelled = false;
  setInvoices(null);
  apiGet<Invoice[]>("/invoices")  // no month param
    .then((data) => { if (!cancelled) setInvoices(data); })
    .catch((err) => { ... });
  return () => { cancelled = true; };
}, []);  // runs once — month changes only affect useMemo

const filtered = useMemo(() => {
  if (!invoices) return null;
  return invoices.filter((inv) => {
    const dateStr = inv.issueDate || inv.createdAt;
    const matchMonth = !dateStr || toMonthStr(dateStr) === month;
    const matchTab = tab === "ALL" || inv.status === tab;
    return matchMonth && matchTab;
  });
}, [invoices, month, tab]);
```

### `apps/web/app/(app)/purchases/page.tsx` — fetch pattern (lines 21–33)

```tsx
useEffect(() => {
  apiGet<Purchase[]>("/purchases")  // no month param
    .then(setPurchases)
    .catch((err) => setError(...));
  apiGet<PurchasesSummary>("/purchases/summary").then(setSummary).catch(() => {});
}, []);  // runs once

const filtered = useMemo(
  () => purchases?.filter((p) => p.date && toMonthStr(p.date) === month) ?? null,
  [purchases, month],
);
```

### Repo conventions

- `getMonthRange(month?)` utility is at `apps/api/src/common/utils/month-range.ts`.
  Import it as `import { getMonthRange } from '../common/utils/month-range';`.
- DTO validation: `@IsOptional()` + `@IsString()` + `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)` for month.
- `class-validator` and `class-transformer` are already installed.
- Frontend: `currentMonthStr()` from `@/lib/format` returns the current `"YYYY-MM"` string.

## Commands you will need

| Purpose       | Command                                             | Expected on success    |
|---------------|-----------------------------------------------------|------------------------|
| Build API     | `pnpm --filter api build`                           | exit 0                 |
| Typecheck web | `pnpm --filter web exec tsc --noEmit`               | exit 0                 |
| Lint API      | `pnpm --filter api lint`                            | exit 0                 |

## Scope

**In scope**:
- `apps/api/src/invoices/dto/find-invoices-query.dto.ts`
- `apps/api/src/invoices/invoices.service.ts`
- `apps/api/src/purchases/purchases.service.ts`
- `apps/api/src/purchases/purchases.controller.ts`
- `apps/web/app/(app)/invoices/page.tsx`
- `apps/web/app/(app)/purchases/page.tsx`

**Out of scope**:
- `apps/api/src/purchases/dto/create-purchase.dto.ts` — purchase creation DTOs unchanged
- `apps/web/app/(app)/invoices/[id]/page.tsx` — invoice detail page unchanged
- `apps/web/app/(app)/invoices/new/page.tsx` — creation page unchanged
- The `purchases/summary` endpoint — uses `findMany` per supplier/month but is a different aggregate; not touched here
- Any other file

## Git workflow

- Branch: `advisor/004-server-side-month-filter`
- Commits per logical unit:
  `feat(api): add month filter to invoices and purchases endpoints`
  `feat(web): pass month param to invoices and purchases API calls`

## Steps

### Step 1: Add `month` to `FindInvoicesQueryDto`

Edit `apps/api/src/invoices/dto/find-invoices-query.dto.ts`:

```ts
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class FindInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;
}
```

**Verify**: `pnpm --filter api exec tsc --noEmit` → exit 0.

### Step 2: Update `InvoicesService.findAll()` to filter by month

In `apps/api/src/invoices/invoices.service.ts`, add the `getMonthRange` import at the top:

```ts
import { getMonthRange } from '../common/utils/month-range';
```

Replace `findAll`:

```ts
findAll(businessId: string, query: FindInvoicesQueryDto) {
  const range = query.month ? getMonthRange(query.month) : undefined;
  return this.prisma.invoice.findMany({
    where: {
      businessId,
      status: query.status,
      ...(range && { issueDate: { gte: range.start, lt: range.end } }),
    },
    include: { customer: true },
    orderBy: { number: 'desc' },
  });
}
```

**Verify**: `pnpm --filter api build` → exit 0.

### Step 3: Add a `FindPurchasesQueryDto` and update purchases `findAll`

Create `apps/api/src/purchases/dto/find-purchases-query.dto.ts`:

```ts
import { IsOptional, IsString, Matches } from 'class-validator';

export class FindPurchasesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;
}
```

In `apps/api/src/purchases/purchases.service.ts`, add at the top:

```ts
import { getMonthRange } from '../common/utils/month-range';
import { FindPurchasesQueryDto } from './dto/find-purchases-query.dto';
```

Replace `findAll`:

```ts
findAll(businessId: string, query: FindPurchasesQueryDto = {}) {
  const range = query.month ? getMonthRange(query.month) : undefined;
  return this.prisma.purchase.findMany({
    where: {
      businessId,
      ...(range && { date: { gte: range.start, lt: range.end } }),
    },
    include: { supplier: true, items: true },
    orderBy: { number: 'desc' },
  });
}
```

In `apps/api/src/purchases/purchases.controller.ts`, update `findAll`:

```ts
import { FindPurchasesQueryDto } from './dto/find-purchases-query.dto';

// ...

@Get()
findAll(@CurrentUser() user: CurrentUserData, @Query() query: FindPurchasesQueryDto) {
  return this.purchasesService.findAll(user.businessId as string, query);
}
```

Add `@Query` to the existing `@nestjs/common` import.

**Verify**: `pnpm --filter api build` → exit 0.

### Step 4: Update `apps/web/app/(app)/invoices/page.tsx`

The `useEffect` must now depend on `month` and pass `?month=YYYY-MM` to the API.
Replace the useEffect and remove the month-filter from useMemo:

```tsx
// Replace the useEffect:
useEffect(() => {
  let cancelled = false;
  setInvoices(null);
  apiGet<Invoice[]>(`/invoices?month=${month}`)
    .then((data) => { if (!cancelled) setInvoices(data); })
    .catch((err) => {
      if (!cancelled)
        setError(err instanceof ApiError ? err.message : "تعذر تحميل الفواتير");
    });
  return () => { cancelled = true; };
}, [month]);  // re-fetch when month changes

// Replace the filtered useMemo (remove month condition, keep tab filter):
const filtered = useMemo(() => {
  if (!invoices) return null;
  return invoices.filter((inv) => tab === "ALL" || inv.status === tab);
}, [invoices, tab]);
```

Also update `monthTotal` useMemo if it still exists — it should now sum `filtered`
(already correctly returns the current month's invoices from the API).

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0.

### Step 5: Update `apps/web/app/(app)/purchases/page.tsx`

Replace the useEffect to pass `?month=YYYY-MM` and make it depend on `month`:

```tsx
useEffect(() => {
  setPurchases(null);
  apiGet<Purchase[]>(`/purchases?month=${month}`)
    .then(setPurchases)
    .catch((err) =>
      setError(err instanceof ApiError ? err.message : "تعذر تحميل المشتريات"),
    );
  apiGet<PurchasesSummary>("/purchases/summary").then(setSummary).catch(() => {});
}, [month]);  // re-fetch when month changes

// Replace filtered useMemo — server already filtered by month, no client filter needed:
const filtered = purchases;  // rename if the variable is still needed, or inline directly
```

Remove the `toMonthStr` import from this file if it's no longer used anywhere else in the file.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0.

### Step 6: Manual smoke test

Start the dev server (`pnpm --filter web dev` + `pnpm --filter api start:dev`) and:

1. Open `/invoices` — invoices for the current month appear.
2. Switch to a previous month via the arrows — the list updates and shows only that month's invoices.
3. Open `/purchases` — same behavior.
4. Confirm that switching month triggers a new network request (DevTools → Network tab) rather than just a useMemo re-computation.

**Verify**: Network tab shows new `/invoices?month=YYYY-MM` requests on month change.

## Test plan

If Plan 001 is done: add a test to `invoices.service.spec.ts` verifying that
`findAll()` with `{ month: '2026-01' }` calls `prisma.invoice.findMany` with an
`issueDate` range filter corresponding to January 2026.

If Plan 001 is not done: manual smoke test in Step 6 is the gate.

## Done criteria

- [ ] `pnpm --filter api build` exits 0
- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] `curl "http://localhost:3001/api/invoices?month=2026-07" -H "Authorization: Bearer <token>"` returns only July 2026 invoices
- [ ] Network tab confirms month changes trigger new API requests (not client-side filtering)
- [ ] Month switching in both `/invoices` and `/purchases` works without page reload
- [ ] Only in-scope files modified (`git diff --name-only HEAD`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `getMonthRange` throws for the `month` value being passed — verify the regex in the DTO matches the `currentMonthStr()` output format (`YYYY-MM`).
- Removing the `toMonthStr` import from purchases page causes a TypeScript error (it may be used elsewhere in the file) — remove only if it's truly unused.
- The `filtered` variable rename in Step 5 breaks JSX references — search for all `filtered` usages in the file before replacing.
- The invoices useEffect re-fetching on every month change causes a visible flash — this is expected UX; add a `loading` state if needed, but do NOT change the fetch pattern.

## Maintenance notes

- The `purchases/summary` endpoint still loads all purchases in JS for its GROUP BY
  aggregation. This is a separate PERF-03 finding and not in scope here.
- The `li-end` page (`apps/web/app/(app)/li-end/page.tsx`) fetches all invoices
  independently and filters for UNPAID/PARTIAL. It deliberately shows all-time debt,
  not a month slice — do not add `?month=` there.
- When `status` and `month` filters are combined (`/invoices?status=UNPAID&month=2026-07`),
  both are applied at the DB level — this is correct and consistent.
