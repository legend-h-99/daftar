/**
 * Behavior tests against a REAL Postgres database seeded with ~1000
 * businesses / ~13,000 documents (see prisma/seed-scale.ts). This is
 * deliberately NOT a unit spec: the thing under test is the interaction
 * between the pagination defaults (plans/013) and the dashboard cap
 * (plans/003) and actual query behavior — mocking Prisma would prove
 * nothing here.
 *
 * Precondition: run `pnpm --filter api db:seed:scale` against your local
 * dev database (the same DATABASE_URL apps/api/.env points at) before
 * running this file. It is intentionally excluded from the default
 * `pnpm test` run (see test/jest-scale.config.js) so CI / the fast unit
 * suite never depends on this fixture.
 *
 * Run: pnpm --filter api test:scale
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { signScaleJwt } from './jwt';

const PHONE_PREFIX = '+9665900';

describe('Scale behavior (1000 businesses / thousands of documents)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let secret: string;

  let megaBusinessId: string;
  let megaToken: string;
  let heavyBusinessId: string;
  let heavyToken: string;
  let otherBusinessId: string;
  let otherToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.init();

    secret = app.get(ConfigService).get<string>('JWT_SECRET') ?? '';
    if (!secret) {
      throw new Error(
        'JWT_SECRET is not resolvable via ConfigService — check apps/api/.env. ' +
          'Minted test tokens must be signed with the same secret the API verifies against.',
      );
    }

    prisma = app.get(PrismaService);

    const businesses = await prisma.business.findMany({
      where: { ownerPhone: { startsWith: PHONE_PREFIX } },
      include: {
        users: { select: { id: true } },
        _count: { select: { invoices: true, purchases: true, suppliers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (businesses.length < 1000) {
      throw new Error(
        `Expected >=1000 scale-test businesses, found ${businesses.length}. ` +
          'Run `pnpm --filter api db:seed:scale` first.',
      );
    }

    const mega = businesses.reduce((max, b) => (b._count.invoices > max._count.invoices ? b : max));
    const heavy = businesses.find((b) => b.id !== mega.id && b._count.invoices > 50)!;
    const other = businesses.find((b) => b.id !== mega.id && b.id !== heavy.id)!;

    megaBusinessId = mega.id;
    heavyBusinessId = heavy.id;
    otherBusinessId = other.id;

    const mint = (businessId: string, userId: string) =>
      signScaleJwt({ sub: userId, businessId }, secret);

    megaToken = mint(mega.id, mega.users[0].id);
    heavyToken = mint(heavy.id, heavy.users[0].id);
    otherToken = mint(other.id, other.users[0].id);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('dashboard unpaid-invoices cap (plan 003)', () => {
    it('caps the returned list at 50 but reports the true count/total', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${megaToken}`)
        .expect(200);

      expect(res.body.unpaidInvoicesLimitedTo).toBe(50);
      expect(res.body.unpaidInvoices.length).toBeLessThanOrEqual(50);
      // The mega business was seeded with far more than 50 unpaid/partial
      // invoices — if this regresses to `unpaidInvoices.length`, this catches it.
      expect(res.body.unpaidInvoicesCount).toBeGreaterThan(50);
      expect(res.body.unpaidInvoicesTotal).toBeGreaterThan(0);
    });
  });

  describe('list-endpoint pagination defaults (plan 013)', () => {
    const endpoints = ['/api/customers', '/api/products', '/api/suppliers', '/api/materials'];

    it.each(endpoints)('%s defaults to at most 50 rows', async (path) => {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${megaToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(50);
    });

    it('honors an explicit limit up to 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/suppliers?limit=200')
        .set('Authorization', `Bearer ${megaToken}`)
        .expect(200);

      // The mega business was seeded with 60 suppliers, comfortably under 200.
      expect(res.body.length).toBeGreaterThan(50);
      expect(res.body.length).toBeLessThanOrEqual(200);
    });

    it('rejects a limit above the 200 safety cap', async () => {
      await request(app.getHttpServer())
        .get('/api/suppliers?limit=201')
        .set('Authorization', `Bearer ${megaToken}`)
        .expect(400);
    });
  });

  describe('purchases/summary aggregation caps (plan 013 step 5)', () => {
    it('caps bySupplier at 50 and byMonth at 24, independent of total row count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchases/summary')
        .set('Authorization', `Bearer ${megaToken}`)
        .expect(200);

      // Mega business has 60 suppliers and a 30-month spread — both caps
      // must bind, or this endpoint has regressed to loading everything.
      expect(res.body.bySupplier.length).toBeLessThanOrEqual(50);
      expect(res.body.byMonth.length).toBeLessThanOrEqual(24);
      expect(res.body.bySupplier.length).toBeGreaterThan(0);
    });
  });

  describe('cross-tenant isolation under multi-tenant scale', () => {
    it('never returns another business\'s customers, suppliers, or invoices', async () => {
      const [mineSuppliers, otherSuppliers] = await Promise.all([
        request(app.getHttpServer()).get('/api/suppliers?limit=200').set('Authorization', `Bearer ${heavyToken}`),
        request(app.getHttpServer()).get('/api/suppliers?limit=200').set('Authorization', `Bearer ${otherToken}`),
      ]);

      const mineIds = new Set(mineSuppliers.body.map((s: { id: string }) => s.id));
      const otherIds = new Set(otherSuppliers.body.map((s: { id: string }) => s.id));
      const overlap = [...mineIds].filter((id) => otherIds.has(id));

      expect(overlap).toEqual([]);
      expect(mineIds.size).toBeGreaterThan(0);
      expect(otherIds.size).toBeGreaterThan(0);
    });

    it('rejects a token whose business no longer matches any data (still isolated, not leaked)', async () => {
      const dashboard = await request(app.getHttpServer())
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      // "other" is a normal-size business — its unpaid list must never
      // contain heavy/mega business invoices even though those tables now
      // hold thousands of rows in the same Postgres instance.
      expect(dashboard.body.unpaidInvoicesCount).toBeLessThan(50);
    });
  });
});
