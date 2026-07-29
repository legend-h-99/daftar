# دفتر (Daftar)

Arabic-only, mobile-first accounting MVP for Saudi small businesses (home-based
food/coffee/sweets sellers). Monorepo with a NestJS + Prisma + PostgreSQL API
and a Next.js (App Router) frontend.

```
apps/api   NestJS backend  — REST API under /api, JWT auth, Prisma/PostgreSQL
apps/web   Next.js frontend — Arabic RTL, mobile-first, Tailwind
```

## Quick start

Requires Node 20+, pnpm, and a PostgreSQL instance (e.g. `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`).

```bash
# from repo root
pnpm install

# backend
cp apps/api/.env.example apps/api/.env   # edit DATABASE_URL / JWT_SECRET
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed        # demo business "مطبخ أم سلطان", phone +966500000001
pnpm start:dev             # http://localhost:3001/api

# frontend (separate terminal)
cd apps/web
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:3001/api
pnpm dev                    # http://localhost:3000
```

Login with the seeded phone `0500000001`. The OTP flow is mocked — no real SMS
is sent; the API returns the code directly (`devCode`) and the frontend
displays it on the OTP screen behind a "وضع تجريبي" badge.

## What's implemented

1. **Auth** — phone + OTP (mock, dev code shown in UI), JWT sessions.
2. **Business profile** — name, city, VAT toggle + VAT number.
3. **Recipe cost calculator** (`/products/new`) — add raw-material and
   packaging line items (name, unit, unit price, quantity used); cost and
   suggested selling price recompute live as you type, and again
   server-side on save (client math never trusted). The formulas mirror the
   real costing spreadsheets these merchants already use:
   - `lineCost = unitPrice × quantityUsed`
   - `totalCost = Σraw + Σpackaging + overheadCost`
   - `sellingPrice = totalCost / (1 − profitMargin/100)` — margin is % of
     the *selling price*, not a cost markup.
4. **Invoicing** — pick/add a customer, add product lines, live subtotal/VAT
   (15%, only if the business is VAT-registered)/total, PDF download, and a
   WhatsApp share button (`wa.me` deep link).
5. **Expenses** — amount, category, date, note; filterable by month.
6. **Dashboard** — this month's sales / expenses / net profit, and a "لي
   عند" (what customers still owe you) list of unpaid invoices.

## Known MVP limitations (intentional, called out in code)

- OTP is mocked — swap `AuthService` in `apps/api/src/auth` for a real SMS
  provider before going to production.
- Invoice PDFs are generated with `pdfkit` without a bundled Arabic TTF —
  see the comment in `apps/api/src/invoices/invoices.service.ts` for where
  to plug in a proper Arabic font (e.g. Amiri/Cairo) for production-quality
  PDF text shaping.
- No payment gateway — "مدفوعة" is a manual status toggle, not a real
  collection flow.

## Free hosted deployment: Koyeb

`Dockerfile.koyeb` runs both the Next.js web app and the NestJS API in one
container, which fits Koyeb's single free web service model:

- public web service: Next.js on port `3000`
- internal API: NestJS on port `3001`
- browser calls stay same-origin through `/api-proxy`

Required GitHub Actions secrets:

- `KOYEB_API_TOKEN`
- `DATABASE_URL`
- `JWT_SECRET`

Then run the `Deploy to Koyeb` workflow from GitHub Actions.
