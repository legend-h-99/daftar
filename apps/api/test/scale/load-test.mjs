#!/usr/bin/env node
/**
 * Concurrent multi-tenant load test against a REAL running dev API.
 *
 * This is the "does it actually stay fast" complement to scale.e2e-spec.ts
 * (which only checks correctness of the caps from plans/003 and plans/013).
 * It fires concurrent requests across many *different* businesses' tokens —
 * not the same business repeatedly — so Postgres can't just serve everything
 * from one hot cache entry, which is closer to real multi-tenant traffic.
 *
 * Precondition:
 *   1. `pnpm --filter api db:seed:scale` has been run against the DB
 *      pointed at by apps/api/.env's DATABASE_URL.
 *   2. `pnpm --filter api start:dev` (or start) is running locally.
 *
 * Usage:
 *   pnpm --filter api test:load                # defaults: localhost:3001, 10s, 20 conns
 *   pnpm --filter api test:load -- --url http://localhost:3001 --duration 20 --connections 50
 */
import autocannon from 'autocannon';
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import 'dotenv/config';

const PHONE_PREFIX = '+9665900';
const SAMPLE_BUSINESSES = 50; // distinct tenants to spread load across

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const full = { ...payload, exp: Math.floor(Date.now() / 1000) + 3600 };
  const eh = base64url(JSON.stringify(header));
  const ep = base64url(JSON.stringify(full));
  const sig = base64url(createHmac('sha256', secret).update(`${eh}.${ep}`).digest());
  return `${eh}.${ep}.${sig}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i === -1 ? fallback : args[i + 1];
  };
  return {
    url: get('--url', 'http://127.0.0.1:3001'),
    duration: Number(get('--duration', '10')),
    connections: Number(get('--connections', '20')),
    p95ThresholdMs: Number(get('--p95-threshold-ms', '300')),
  };
}

async function main() {
  const { url, duration, connections, p95ThresholdMs } = parseArgs();
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set — this must run with the same env as the API.');

  const prisma = new PrismaClient();
  const businesses = await prisma.business.findMany({
    where: { ownerPhone: { startsWith: PHONE_PREFIX } },
    include: { users: { select: { id: true }, take: 1 } },
    take: SAMPLE_BUSINESSES,
  });
  await prisma.$disconnect();

  if (businesses.length === 0) {
    throw new Error('No scale-test businesses found. Run `pnpm --filter api db:seed:scale` first.');
  }

  const requests = businesses.flatMap((b) => {
    const token = signJwt({ sub: b.users[0].id, businessId: b.id }, secret);
    const headers = { Authorization: `Bearer ${token}` };
    return [
      { method: 'GET', path: '/api/dashboard/summary', headers },
      { method: 'GET', path: '/api/customers', headers },
      { method: 'GET', path: '/api/purchases/summary', headers },
    ];
  });

  console.log(
    `Load-testing ${url} with ${businesses.length} distinct tenants, ` +
      `${connections} connections, ${duration}s...`,
  );

  const result = await autocannon({
    url,
    connections,
    duration,
    requests,
  });

  autocannon.printResult(result);

  const p95 = result.latency.p97_5 ?? result.latency.p99; // autocannon doesn't always expose p95 directly
  console.log(`\np95-ish latency: ${p95}ms (threshold: ${p95ThresholdMs}ms)`);
  console.log(`errors: ${result.errors}, timeouts: ${result.timeouts}, non-2xx: ${result.non2xx}`);

  const failed = result.errors > 0 || result.non2xx > 0 || p95 > p95ThresholdMs;
  if (failed) {
    console.error('\nLOAD TEST FAILED — see thresholds above.');
    process.exitCode = 1;
  } else {
    console.log('\nLOAD TEST PASSED.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
