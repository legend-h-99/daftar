# Daftar API

NestJS + Prisma + PostgreSQL backend for the Daftar accounting SaaS MVP —
built for Saudi home-based food/coffee/sweets sellers (recipe cost
calculator, invoices, expenses, dashboard).

All routes are served under the `/api` prefix.

## 1. Environment setup

Copy the example env file and fill in real values:

```bash
cd apps/api
cp .env.example .env
```

Variables:

- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — secret used to sign auth JWTs (30-day expiry).
- `CORS_ORIGIN` — comma-separated list of allowed frontend origins (e.g. `http://localhost:3000`).
- `PORT` — port the API listens on (default `3001`).

## 2. Install dependencies

Run from the **workspace root** (`/Users/hossam/t/daftar`) so pnpm can link
the whole monorepo:

```bash
pnpm install
```

## 3. Generate the Prisma client

From `apps/api` (does not require a live database):

```bash
cd apps/api
npx prisma generate
```

## 4. Run migrations (requires a running PostgreSQL instance)

```bash
npx prisma migrate dev
```

## 5. Seed demo data

```bash
npx prisma db seed
```

This creates a demo business ("مطبخ أم سلطان") with owner phone
`+966500000001` and two demo products (كبسة دجاج، سينابون) with realistic
recipe costing data. Use that phone number with the mock OTP flow below to
log in and immediately see data.

## 6. Run the dev server

From the workspace root:

```bash
pnpm dev:api
```

or directly:

```bash
cd apps/api
pnpm start:dev
```

## Mock authentication flow (no real SMS provider)

This MVP does not integrate a real SMS gateway. `POST /api/auth/otp/request`
always returns the generated code as `devCode` in the JSON response so the
frontend can display/auto-fill it during development and pilots:

```bash
curl -X POST http://localhost:3001/api/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"+966500000001"}'
# => { "sent": true, "devCode": "123456" }

curl -X POST http://localhost:3001/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+966500000001","code":"123456"}'
# => { "accessToken": "...", "user": {...}, "hasBusiness": true }
```

Before going to production, wire `AuthService.requestOtp` in
`src/auth/auth.service.ts` up to a real SMS gateway (e.g. Unifonic, Taqnyat)
and stop returning `devCode`.

## Notes on the invoice PDF

`GET /api/invoices/:id/pdf` renders a simple PDF with `pdfkit` using the
built-in Helvetica font, which does not shape Arabic script. For production,
drop an Arabic-capable Unicode TTF (e.g. Amiri or Cairo) into the project and
load it via `doc.font('<path>.ttf')` in `src/invoices/invoices.service.ts`
(see the comment in `generatePdf`) — Arabic text is still written correctly
as UTF-8, it just won't render with proper Arabic glyph shaping without that
font file.

## Project structure

```
src/
  auth/          phone+OTP mock auth, JWT issuing/verification
  business/       business (tenant) onboarding & settings
  materials/      reusable raw-material master list
  products/       recipe cost calculator (products + recipe items)
  customers/      customer directory
  invoices/       invoices, line items, sequential numbering, PDF export
  expenses/       business expenses
  dashboard/      monthly summary (sales, expenses, net profit, unpaid invoices)
  common/         shared guards, decorators, filters, types, utils
  prisma/         PrismaService/PrismaModule
prisma/
  schema.prisma
  seed.ts
```
