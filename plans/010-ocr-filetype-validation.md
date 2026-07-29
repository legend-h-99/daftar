# Plan 010: Validate OCR image type before passing to the provider

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```
> git diff --stat a82de24..HEAD -- apps/api/src/purchases/dto/scan-invoice.dto.ts
> ```
> Compare the "Current state" excerpt against the live file before editing.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / correctness
- **Planned at**: commit `a82de24`, 2026-07-09

## Why this matters

`POST /purchases/scan` accepts a raw base64 string (`imageBase64`) and passes
it directly to the OCR provider with no format validation. When a real OCR
provider is wired up (replacing the current mock), malformed or non-image data
will cause unpredictable behaviour: provider-side errors, processing charges
for garbage input, or in pathological cases, issues with binary content
parsers. Adding a lightweight prefix check at the DTO layer is cheap, catches
the most common mistakes (wrong encoding, wrong field), and produces a clear
4xx error instead of a cryptic 5xx from the provider.

The current mock provider ignores `imageBase64` entirely, so this validation
is forward-looking — it costs nothing now and prevents a class of provider
errors later.

## Current state

### `apps/api/src/purchases/dto/scan-invoice.dto.ts`

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ScanInvoiceDto {
  /**
   * The photographed purchase invoice as a base64 data string. Optional for
   * the mock provider (which never reads it); required by real providers.
   * ~7MB cap keeps oversized uploads out of the JSON body.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)
  imageBase64?: string;
}
```

There is no format check. Any string up to 10 MB passes validation.

### `apps/api/src/purchases/purchases.service.ts` lines 27–34

```ts
  async scan(businessId: string, imageBase64?: string) {
    const materials = await this.prisma.material.findMany({
      where: { businessId },
      select: { id: true, name: true, unit: true, unitPrice: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.ocr.extractPurchaseDraft(imageBase64, { materials });
  }
```

`imageBase64` is forwarded as-is.

### Conventions

- DTOs live in `apps/api/src/<module>/dto/`.
- Class-validator decorators are used for all DTO validation — see other DTOs
  such as `apps/api/src/invoices/dto/find-invoices-query.dto.ts` for import style.
- Custom class-validator decorators are used elsewhere in the project if they
  exist; if not, use `@Matches()` from `class-validator`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm --filter api exec tsc --noEmit` | exit 0 |
| Tests | `pnpm --filter api test` | all pass |

## Scope

**In scope**:
- `apps/api/src/purchases/dto/scan-invoice.dto.ts` — add format validator

**Out of scope** (do NOT touch):
- `apps/api/src/purchases/purchases.service.ts` — no service change needed
- `apps/api/src/purchases/purchases.controller.ts` — no controller change needed
- Any other file

## Git workflow

- Branch: `advisor/010-ocr-filetype-validation`
- Commit: `fix(api): validate OCR imageBase64 format before passing to provider`
- Do NOT push or open a PR.

## Steps

### Step 1: Add a `@Matches` format check on `imageBase64`

Open `apps/api/src/purchases/dto/scan-invoice.dto.ts`.

The accepted formats for `imageBase64` are:

| Format | Raw base64 prefix | Data URI prefix |
|--------|-------------------|-----------------|
| JPEG | `/9j/` | `data:image/jpeg;base64,/9j/` |
| PNG | `iVBOR` | `data:image/png;base64,iVBOR` |
| PDF | `JVBERi` | `data:application/pdf;base64,JVBERi` |

Add a `@Matches` decorator that accepts both raw base64 and data-URI forms:

```ts
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Accepts JPEG, PNG, or PDF — as raw base64 or as a data URI.
const IMAGE_BASE64_REGEX =
  /^(\/9j\/|iVBOR|JVBERi|data:(image\/(jpeg|png)|application\/pdf);base64,(\/9j\/|iVBOR|JVBERi))/;

export class ScanInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)
  @Matches(IMAGE_BASE64_REGEX, {
    message: 'imageBase64 must be a valid JPEG, PNG, or PDF in base64 or data-URI format',
  })
  imageBase64?: string;
}
```

Key points:
- The regex is anchored at the start (`^`) to check only the prefix.
- `@IsOptional()` means class-validator skips ALL validators (including
  `@Matches`) when `imageBase64` is absent from the request body — the mock
  flow continues to work unchanged.
- The decorator order matters: `@IsString()` must come before `@Matches()`
  so that type coercion happens first. Keep the order as shown above.
- The named constant `IMAGE_BASE64_REGEX` makes the intent readable; do not
  inline the regex directly into `@Matches(...)`.

**Verify**:
```
grep 'Matches' apps/api/src/purchases/dto/scan-invoice.dto.ts
```
→ one match.

### Step 2: Typecheck and test

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter api test
```

**Verify**: both exit 0. Existing tests are unaffected because no test sends
an `imageBase64` value that would fail the new regex (the mock scan tests do
not send a body, or send `undefined`).

## Test plan

No new spec file is needed. The DTO validation is exercised automatically by
NestJS's `ValidationPipe` in integration. If the project later adds e2e tests
for the scan endpoint, the following cases should be covered:

- `imageBase64` absent → 200 (mock returns draft)
- `imageBase64 = '/9j/AAAA...'` (JPEG prefix) → 200
- `imageBase64 = 'SGVsbG8gV29ybGQ='` (base64 for "Hello World", not an image) → 400
- `imageBase64 = 'data:image/jpeg;base64,/9j/AAAA...'` (data URI form) → 200

## Done criteria

- [ ] `grep 'Matches' apps/api/src/purchases/dto/scan-invoice.dto.ts` → found
- [ ] `grep 'IMAGE_BASE64_REGEX' apps/api/src/purchases/dto/scan-invoice.dto.ts` → found
- [ ] `pnpm --filter api exec tsc --noEmit` exits 0
- [ ] `pnpm --filter api test` exits 0 (all existing tests pass)
- [ ] Only `apps/api/src/purchases/dto/scan-invoice.dto.ts` is modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back if:

- `scan-invoice.dto.ts` does not match the "Current state" excerpt (it may have
  been extended by someone else — check whether a format validator already exists
  before adding another one).
- `tsc --noEmit` fails after the edit with an error about the regex or the
  `Matches` import.
- The existing API tests fail after the change — report which test fails and the
  error; do not modify test files in this plan.

## Maintenance notes

- When a real OCR provider is integrated, revisit whether it accepts data URIs,
  raw base64, or both, and update `IMAGE_BASE64_REGEX` accordingly. The mock
  provider ignores the value so the format currently doesn't matter in practice.
- If PDF scanning is not a planned feature, the `JVBERi` / `application\/pdf`
  branches can be removed from the regex to reduce the attack surface.
- The `MaxLength(10_000_000)` cap (≈7.5 MB of raw binary before base64 overhead)
  was set before this plan. If the provider supports larger images, raise it;
  if it has a lower limit, lower it and keep both caps in sync.
