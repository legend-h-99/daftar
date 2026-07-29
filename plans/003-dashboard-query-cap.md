# Plan 003: Cap dashboard unpaid-invoices query and fix aggregation accuracy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d58f93..HEAD -- apps/api/src/dashboard/ apps/web/app/\(app\)/dashboard/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — adds a cap and a parallel count query; response shape gains one
  field (`unpaidInvoicesLimitedTo`), existing fields stay identical.
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `2d58f93`, 2026-07-09

## Why this matters

`DashboardService.summary()` fetches **all** UNPAID and PARTIAL invoices for a
business with `include: { customer: true }` and no `take` limit. For a business
that has been operating for 12+ months, this can be hundreds of rows loaded on
every dashboard visit. More subtly: if the list is capped later, the
`unpaidInvoicesTotal` (a sum over the in-memory array) would undercount.

This plan:
1. Caps the returned invoice list at 50 (the UI shows a summary; the "لي عند"
   page shows the full list).
2. Adds a parallel `count()` and `_sum` aggregate so `unpaidInvoicesCount` and
   `unpaidInvoicesTotal` always reflect the true business-wide figures, not just
   the first 50.
3. Adds a `unpaidInvoicesLimitedTo: number` field to the response so the
   frontend can show a "view all" prompt when the cap is hit.

## Current state

### `apps/api/src/dashboard/dashboard.service.ts` (full relevant section)

```ts
// lines 15–74 (summary method)
async summary(businessId: string, month?: string) {
  let range: ReturnType<typeof getMonthRange>;
  try {
    range = getMonthRange(month);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }

  const [paidInvoices, purchases, expenses, unpaidInvoices, lowStockMaterials] = await Promise.all([
    this.prisma.invoice.findMany({
      where: { businessId, status: InvoiceStatus.PAID, issueDate: { gte: range.start, lt: range.end } },
      select: { total: true },
    }),
    this.prisma.purchase.findMany({
      where: { businessId, date: { gte: range.start, lt: range.end } },
      select: { total: true },
    }),
    this.prisma.expense.findMany({
      where: { businessId, date: { gte: range.start, lt: range.end } },
      select: { amount: true },
    }),
    this.prisma.invoice.findMany({
      where: {
        businessId,
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
      },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    }),
    this.prisma.$queryRaw<...>`SELECT ...`,
  ]);

  // ...

  const unpaidInvoicesFormatted = unpaidInvoices.map((inv) => ({ ... }));

  const unpaidInvoicesTotal = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.total - inv.paidAmount),
    0,
  );

  return {
    month: range.month,
    totalSales,
    totalPurchases,
    totalExpenses,
    netProfit,
    unpaidInvoices: unpaidInvoicesFormatted,
    unpaidInvoicesCount: unpaidInvoices.length,
    unpaidInvoicesTotal,
    lowStock: lowStockMaterials,
  };
}
```

### `apps/web/app/(app)/dashboard/page.tsx` (how the response is consumed)

The frontend uses `summary.unpaidInvoicesCount`, `summary.unpaidInvoicesTotal`,
and `summary.unpaidInvoices` (the list). These are all part of the
`DashboardSummary` type in `apps/web/lib/types.ts`.

### `apps/web/lib/types.ts` — `DashboardSummary` interface

Read the current shape of `DashboardSummary` before editing, so you know exactly
which fields to extend.

## Commands you will need

| Purpose       | Command                                             | Expected on success    |
|---------------|-----------------------------------------------------|------------------------|
| Build API     | `pnpm --filter api build`                           | exit 0                 |
| Typecheck web | `pnpm --filter web exec tsc --noEmit`               | exit 0                 |
| API tests     | `pnpm --filter api test -- dashboard.service` (after Plan 001) | all pass |

## Scope

**In scope**:
- `apps/api/src/dashboard/dashboard.service.ts`
- `apps/web/lib/types.ts` — add `unpaidInvoicesLimitedTo: number` to `DashboardSummary`
- `apps/web/app/(app)/dashboard/page.tsx` — optionally show "view all" prompt

**Out of scope**:
- `apps/api/src/dashboard/dashboard.controller.ts` — no change needed
- Any other service — this is a surgical change to the summary query only
- Pagination UI for the invoice list — the "لي عند" page handles the full list

## Git workflow

- Branch: `advisor/003-dashboard-query-cap`
- Commit: `fix(dashboard): cap unpaid invoices to 50; accurate count/total via aggregate`

## Steps

### Step 1: Read `DashboardSummary` in `apps/web/lib/types.ts`

Before editing anything, run:
```bash
grep -n "DashboardSummary\|unpaidInvoices" apps/web/lib/types.ts
```
Note the exact field names and types. You'll need this to add `unpaidInvoicesLimitedTo`.

**Verify**: The interface has `unpaidInvoices`, `unpaidInvoicesCount`, `unpaidInvoicesTotal` — all present.

### Step 2: Update `dashboard.service.ts` — cap list + parallel aggregation

In `DashboardService.summary()`, replace the single `this.prisma.invoice.findMany`
call for unpaid invoices with **three parallel queries** inside the same
`Promise.all`. The full new `Promise.all` becomes:

```ts
const UNPAID_CAP = 50;

const [paidInvoices, purchases, expenses, unpaidInvoices, unpaidAggregate, lowStockMaterials] =
  await Promise.all([
    this.prisma.invoice.findMany({
      where: { businessId, status: InvoiceStatus.PAID, issueDate: { gte: range.start, lt: range.end } },
      select: { total: true },
    }),
    this.prisma.purchase.findMany({
      where: { businessId, date: { gte: range.start, lt: range.end } },
      select: { total: true },
    }),
    this.prisma.expense.findMany({
      where: { businessId, date: { gte: range.start, lt: range.end } },
      select: { amount: true },
    }),
    // Capped list for display — most overdue first.
    this.prisma.invoice.findMany({
      where: {
        businessId,
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
      },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
      take: UNPAID_CAP,
    }),
    // True totals across ALL unpaid/partial invoices — not capped.
    this.prisma.invoice.aggregate({
      where: {
        businessId,
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
      },
      _count: { id: true },
      _sum: { total: true, paidAmount: true },
    }),
    this.prisma.$queryRaw<
      { id: string; name: string; unit: string; stockQty: number; reorderLevel: number }[]
    >`SELECT id, name, unit, "stockQty", "reorderLevel"
      FROM "Material"
      WHERE "businessId" = ${businessId}
        AND "reorderLevel" IS NOT NULL
        AND "stockQty" <= "reorderLevel"
      ORDER BY "stockQty" ASC
      LIMIT 10`,
  ]);
```

Then replace the aggregation lines at the bottom of the method:

```ts
const unpaidInvoicesFormatted = unpaidInvoices.map((inv) => ({
  id: inv.id,
  number: inv.number,
  customerName: inv.customer?.name ?? null,
  total: inv.total,
  dueDate: inv.dueDate,
  status: inv.status,
}));

// Use the aggregate for accurate true totals (not capped at 50).
const trueTotal = (unpaidAggregate._sum.total ?? 0) - (unpaidAggregate._sum.paidAmount ?? 0);
const trueCount = unpaidAggregate._count.id;

return {
  month: range.month,
  totalSales,
  totalPurchases,
  totalExpenses,
  netProfit,
  unpaidInvoices: unpaidInvoicesFormatted,
  unpaidInvoicesCount: trueCount,
  unpaidInvoicesTotal: trueTotal,
  unpaidInvoicesLimitedTo: UNPAID_CAP,   // new field
  lowStock: lowStockMaterials,
};
```

**Verify**: `pnpm --filter api build` → exit 0.

### Step 3: Update `DashboardSummary` type in `apps/web/lib/types.ts`

Add `unpaidInvoicesLimitedTo: number;` to the `DashboardSummary` interface,
alongside the existing `unpaidInvoicesCount` field.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0.

### Step 4: (Optional) Show "view all" prompt in dashboard when cap is hit

In `apps/web/app/(app)/dashboard/page.tsx`, locate where `unpaidInvoicesCount`
is displayed. If `summary.unpaidInvoices.length >= summary.unpaidInvoicesLimitedTo`,
add a small note linking to `/li-end`:

```tsx
{summary.unpaidInvoicesCount > summary.unpaidInvoicesLimitedTo && (
  <Link href="/li-end" className="text-xs text-brand-700 underline">
    عرض جميع الفواتير ({summary.unpaidInvoicesCount})
  </Link>
)}
```

This step is optional but recommended for a clean UX when the cap is hit.

**Verify**: `pnpm --filter web exec tsc --noEmit` → exit 0.

## Test plan

If Plan 001 is done, add one test to `dashboard.service.spec.ts`:

- **Test**: `summary()` with 55 unpaid invoices: `unpaidInvoices` array has length
  50, `unpaidInvoicesCount` is 55, `unpaidInvoicesTotal` reflects all 55 invoices.
  Mock `prisma.invoice.findMany` to return an array of 50 items, and mock
  `prisma.invoice.aggregate` to return `{ _count: { id: 55 }, _sum: { total: 5500, paidAmount: 0 } }`.

If Plan 001 is not done yet, manually verify by checking the API response shape
(`curl http://localhost:3001/api/dashboard/summary -H "Authorization: Bearer <token>"`).

## Done criteria

- [ ] `pnpm --filter api build` exits 0
- [ ] `pnpm --filter web exec tsc --noEmit` exits 0
- [ ] API response for `/dashboard/summary` includes `unpaidInvoicesLimitedTo: 50`
- [ ] `unpaidInvoicesCount` and `unpaidInvoicesTotal` are accurate even when list is capped
  (verified by checking against known test data or by running a manual DB check)
- [ ] Only in-scope files modified (`git diff --name-only HEAD`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `prisma.invoice.aggregate` with `_sum` doesn't type-check (some Prisma versions
  have nuances with nullable `_sum` fields) — use `?? 0` on `_sum.total` and
  `_sum.paidAmount` as shown in the plan.
- The `Promise.all` destructuring breaks because of the new 6th element — ensure
  the array length and variable names match exactly.
- Step 4 (dashboard link) causes a TypeScript error — verify the `DashboardSummary`
  type was updated in Step 3 before editing the page.

## Maintenance notes

- `UNPAID_CAP = 50` is a constant at the top of the method; move it to
  `src/common/constants.ts` if/when that file is created (see DEBT-06).
- The "لي عند" page (`apps/web/app/(app)/li-end/page.tsx`) fetches its own copy of
  all UNPAID/PARTIAL invoices independently. If the full list becomes large, it
  will need its own pagination — this plan does not address that.
- If the dashboard is extended to support multi-user access, the cap may need to
  be per-user or tenant-configurable.
