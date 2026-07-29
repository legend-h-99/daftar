# Plan 013: Add pagination to unbounded list endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 347b684..HEAD -- apps/api/src/customers/ apps/api/src/purchases/ apps/api/src/products/ apps/api/src/suppliers/ apps/api/src/materials/ apps/api/src/common/`
> If any in-scope file changed since this plan was written, check the
> "Current state" excerpts against live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `347b684`, 2026-07-17

## Why this matters

Five `findMany()` calls in the API return every record for a business with no
upper bound. On mobile clients — which load the customers list, products list,
and purchases summary in the normal flow — a business with hundreds or thousands
of records will transfer large JSON payloads, consume excess memory, and cause
slow list renders. The mobile app's `TanStack Query` layer caches the whole
response; subsequent fetches still bear the full payload on revalidation.

The `purchases/summary` endpoint is the most acute case: it loads all purchases
into Node memory, then iterates them twice in JS to produce by-supplier and
by-month aggregations. The same result is achievable with a Prisma `groupBy`
query, letting the database handle the aggregation.

## Current state

**Affected service methods (all confirmed by code inspection):**

`apps/api/src/customers/customers.service.ts:16-21`:
```ts
findAll(businessId: string) {
  return this.prisma.customer.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    // ← no take / skip
  });
}
```

`apps/api/src/products/products.service.ts` — `findAll()`, similar pattern,
no `take`/`skip`.

`apps/api/src/suppliers/suppliers.service.ts` — `findAll()`, no `take`/`skip`.

`apps/api/src/materials/materials.service.ts` — `findAll()`, no `take`/`skip`.

`apps/api/src/purchases/purchases.service.ts:206-234`:
```ts
async summary(businessId: string) {
  const purchases = await this.prisma.purchase.findMany({
    where: { businessId },
    include: { supplier: { select: { name: true } } },
    // ← no take / skip; loads ALL records
  });
  // then iterates twice in JS to build bySupplier / byMonth maps
}
```

**Convention to follow:** Look at `apps/api/src/invoices/invoices.service.ts`
and `apps/api/src/purchases/purchases.service.ts` — they already accept a
`month: string` parameter in DTOs. Follow the same DTO pattern. Look at
`apps/api/src/common/` for any shared DTOs that already exist.

**NestJS DTO pattern used in this repo** (example from
`apps/api/src/invoices/dto/get-invoices.dto.ts` or similar):
```ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
```

## Commands you will need

| Purpose    | Command                                                              | Expected on success |
|------------|----------------------------------------------------------------------|---------------------|
| Typecheck  | `cd apps/api && npx tsc --noEmit`                                    | exit 0              |
| Tests      | `cd apps/api && pnpm test`                                           | all pass            |
| Build      | `cd apps/api && pnpm build`                                          | exit 0              |

## Scope

**In scope**:
- `apps/api/src/common/dto/pagination.dto.ts` — CREATE (shared DTO)
- `apps/api/src/customers/customers.service.ts`
- `apps/api/src/customers/customers.controller.ts`
- `apps/api/src/products/products.service.ts`
- `apps/api/src/products/products.controller.ts`
- `apps/api/src/suppliers/suppliers.service.ts`
- `apps/api/src/suppliers/suppliers.controller.ts`
- `apps/api/src/materials/materials.service.ts`
- `apps/api/src/materials/materials.controller.ts`
- `apps/api/src/purchases/purchases.service.ts` — `summary()` refactor only
- `apps/api/src/purchases/purchases.controller.ts` — `summary` endpoint only
- `apps/api/src/common/index.ts` (or barrel file if it exists) — export new DTO

**Out of scope** (do NOT touch):
- `apps/api/src/invoices/` — invoices already have month filtering; pagination
  is a separate concern deferred to avoid scope creep
- `apps/api/src/dashboard/` — dashboard returns aggregates, not lists
- Any mobile or web files — the mobile services use `apiClient.get()`; adding
  `?limit=50` as a default on the server means mobile clients get paginated
  results without any client change
- Prisma schema — no schema changes needed

## Git workflow

- Branch: `advisor/013-api-pagination`
- Commit per service or as one logical commit:
  `feat(api): add default pagination to customers, products, suppliers, materials list endpoints`
  `refactor(api): replace purchases/summary JS aggregation with Prisma groupBy`

## Steps

### Step 1: Check what exists in `apps/api/src/common/`

```bash
ls apps/api/src/common/
```

If a `dto/` directory already exists, check whether a `PaginationDto` is
already defined there. If it is: use it as-is, skip the creation in Step 2.
Note the exact import path for use in Steps 3–6.

**Verify**: you know the exact path to use for `PaginationDto` imports.

### Step 2: Create `apps/api/src/common/dto/pagination.dto.ts`

If it doesn't already exist:

```ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
```

Default `limit: 50` is conservative — the mobile customer list fits 15 rows per
screen; 50 covers 3 full screens with scrolling. Max `200` prevents a client
from bypassing pagination with `?limit=99999`.

Export it from the common barrel if one exists (check for
`apps/api/src/common/index.ts`).

**Verify**: `cd apps/api && npx tsc --noEmit` → exit 0

### Step 3: Add pagination to `customers.service.ts` and `customers.controller.ts`

**Service (`customers.service.ts`)** — change `findAll` signature:
```ts
findAll(businessId: string, pagination: { limit: number; skip: number }) {
  return this.prisma.customer.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: pagination.limit,
    skip: pagination.skip,
  });
}
```

**Controller (`customers.controller.ts`)** — add `@Query()` parameter:
```ts
import { PaginationDto } from '../common/dto/pagination.dto';

@Get()
findAll(
  @CurrentUser() user: CurrentUserData,
  @Query() pagination: PaginationDto,
) {
  return this.customersService.findAll(
    user.businessId as string,
    { limit: pagination.limit ?? 50, skip: pagination.skip ?? 0 },
  );
}
```

**Verify**: `cd apps/api && npx tsc --noEmit` → exit 0

### Step 4: Repeat for `products`, `suppliers`, `materials`

Apply the identical pattern from Step 3 to:
- `apps/api/src/products/products.service.ts` — `findAll()` method
- `apps/api/src/products/products.controller.ts` — `findAll()` endpoint
- `apps/api/src/suppliers/suppliers.service.ts` — `findAll()` method
- `apps/api/src/suppliers/suppliers.controller.ts` — `findAll()` endpoint
- `apps/api/src/materials/materials.service.ts` — `findAll()` method
- `apps/api/src/materials/materials.controller.ts` — `findAll()` endpoint

**Verify after each pair**: `cd apps/api && npx tsc --noEmit` → exit 0

### Step 5: Refactor `purchases.summary()` to use Prisma `groupBy`

Replace the in-memory aggregation in `apps/api/src/purchases/purchases.service.ts`:

**Old `summary()` (lines 206–234):** loads all purchases into memory, iterates
in JS.

**New `summary()`:** delegate aggregation to the database:

```ts
async summary(businessId: string) {
  const [bySupplierRaw, byMonthRaw] = await Promise.all([
    this.prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { businessId },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 50,
    }),
    this.prisma.purchase.groupBy({
      by: ['date'],
      where: { businessId },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { date: 'desc' },
      take: 24,  // last 24 months
    }),
  ]);

  // resolve supplier names in a single follow-up query
  const supplierIds = bySupplierRaw
    .map((r) => r.supplierId)
    .filter((id): id is string => id !== null);

  const suppliers = await this.prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, name: true },
  });
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

  return {
    bySupplier: bySupplierRaw.map((r) => ({
      name: r.supplierId ? (supplierMap.get(r.supplierId) ?? 'بدون مورد') : 'بدون مورد',
      count: r._count.id,
      total: r._sum.total ?? 0,
    })),
    byMonth: byMonthRaw.map((r) => ({
      month: r.date.toISOString().slice(0, 7),
      count: r._count.id,
      total: r._sum.total ?? 0,
    })),
  };
}
```

**Note on `groupBy({ by: ['date'] })`:** `date` is a `DateTime` field. Prisma
`groupBy` on a DateTime groups by exact value (not by month). If this produces
per-day rows instead of per-month rows, use the following fallback: keep the
original `findMany` but add `take: 500` to cap memory usage, and preserve the
JS month aggregation. STOP and report if you are unsure which behavior Prisma
produces for this schema.

**Verify**: `cd apps/api && npx tsc --noEmit` → exit 0

### Step 6: Run tests and build

```bash
cd apps/api && pnpm test
```

Expected: all existing tests pass. If tests for `purchases.service` or
`customers.service` fail due to the signature change, update the mock call
arguments in those test files.

```bash
cd apps/api && pnpm build
```

Expected: exit 0.

## Test plan

The existing spec files at `apps/api/src/customers/` (if any) and
`apps/api/src/purchases/purchases.service.spec.ts` (not confirmed to exist —
check `ls apps/api/src/purchases/`) should pass without changes to test logic.

If a `customers.service.spec.ts` exists, update any `findAll()` mock calls to
include the pagination argument: `findAll('bizId', { limit: 50, skip: 0 })`.

No new test files are required for this plan. The typing gates (`tsc --noEmit`)
and the build are the primary machine-checkable criteria.

## Done criteria

- [ ] `apps/api/src/common/dto/pagination.dto.ts` exists with `limit` (default 50, max 200) and `skip` (default 0)
- [ ] `customers.service.ts::findAll` accepts `{ limit, skip }` and passes to `findMany({ take, skip })`
- [ ] Same pattern applied to `products`, `suppliers`, `materials` services
- [ ] `purchases.service.ts::summary()` no longer loads all records into memory (uses `groupBy` or has a `take` cap)
- [ ] `cd apps/api && npx tsc --noEmit` exits 0
- [ ] `cd apps/api && pnpm test` exits 0
- [ ] `cd apps/api && pnpm build` exits 0
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row for 013 updated to DONE

## STOP conditions

- `purchases.groupBy({ by: ['date'] })` groups by exact DateTime rather than
  by month — STOP and report before choosing between the groupBy vs. capped
  findMany approach.
- TypeScript errors in files outside the in-scope list.
- `pnpm test` fails on tests that previously passed and the failure is not
  a mock-signature mismatch (those are expected and fixable per Step 6).
- Prisma `groupBy` on `supplierId` fails because `supplierId` is nullable —
  STOP and report; the filter `where: { supplierId: { not: null } }` may be
  needed.

## Maintenance notes

- Mobile app services (`apps/mobile/src/lib/services/`) call these endpoints
  without `limit`/`skip` params. With defaults (`limit=50, skip=0`), existing
  calls get the first 50 records — enough for the MVP. When a "load more" /
  infinite scroll feature is added to the mobile app, pass explicit pagination
  params from the TanStack Query `useInfiniteQuery` hook.
- The `byMonth` groupBy uses `take: 24` (24 months). If multi-year reports are
  needed, remove the `take` cap and add pagination to the summary endpoint.
- The `PaginationDto` `Max(200)` limit is a safety valve, not a business rule.
  Revisit if a screen legitimately needs more than 200 records in one fetch
  (consider cursor-based pagination instead at that point).
