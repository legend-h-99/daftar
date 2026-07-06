# دفتر (Daftar) — Web

Arabic-only, mobile-first frontend for دفتر — a simple accounting MVP for
Saudi small home-businesses (food/coffee/sweets sellers). Built with
Next.js (App Router), TypeScript, and TailwindCSS.

## Stack

- Next.js 15 (App Router, client components + `useEffect` data fetching —
  no server-side fetch against the API at build/render time, since auth is
  a client-held JWT).
- TypeScript (strict mode).
- TailwindCSS, RTL via `dir="rtl"` on `<html>`.
- `next/font/google` — Tajawal.
- `lucide-react` for icons.

## Requirements

- Node.js >= 20
- pnpm (this app lives inside the `daftar` pnpm workspace)
- The دفتر NestJS API running (see `apps/api`), or any server matching the
  contract described in the project root.

## Setup

From the **workspace root** (`daftar/`):

```bash
pnpm install
```

Then create your local env file inside `apps/web`:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` if your API isn't running on the default:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Development

From the workspace root:

```bash
pnpm --filter web dev
```

Or from `apps/web`:

```bash
pnpm dev
```

The app runs on http://localhost:3000.

## Build

```bash
pnpm --filter web build
pnpm --filter web start
```

## Auth model

The API issues a JWT on `/auth/otp/verify`. It's stored in
`localStorage` (see `lib/auth.ts`) and attached to every request via the
`apiFetch` wrapper in `lib/api.ts`. Authenticated routes live under the
`app/(app)` route group, guarded client-side by a `useEffect` redirect to
`/login` when no token is present or `/auth/me` fails.

## Project structure

```
app/
  login/              phone number entry
  otp/                6-digit OTP verification (shows mock devCode)
  onboarding/         business profile setup (name, city, VAT)
  (app)/              authenticated route group (top bar + bottom nav)
    dashboard/        المبيعات / المصاريف / صافي الربح + لي عند الزباين
    products/         product list + حاسبة تكلفة المنتج (new/edit)
    invoices/         invoice list, create, detail (PDF + WhatsApp share)
    expenses/         monthly expense list + add form
components/           shared UI (BottomNav, TopBar, StatCard, StatusBadge,
                       RecipeItemTable, ProductForm, EmptyState)
lib/                  api.ts, auth.ts, format.ts, calc.ts, types.ts,
                       business-context.tsx
```

## Notes

- All cost/pricing formulas in `lib/calc.ts` mirror the backend's
  `POST /products/calculate` exactly, so the recipe calculator updates
  live as the user types and matches what gets saved on submit.
- Currency is always formatted with `formatSAR()` from `lib/format.ts`
  (e.g. `1,250.00 ر.س`).
