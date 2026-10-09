import { createHmac, webcrypto } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';

type Handler = (request: Request) => Promise<Response>;

const source = readFileSync(resolve(__dirname, '../../../../supabase/functions/api/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'index.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function edgeApi(settings: Record<string, string> = {}) {
  let handler: Handler | undefined;
  const revoked = new Set<string>();
  const user: { id: string; phone: string | null; email: string; googleId: string | null; businessId: string | null; passwordHash?: string; emailVerified?: boolean } = {
    id: 'user-1', phone: null, email: 'audit@example.invalid', googleId: null, businessId: null,
  };
  const database = {
    rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    from: jest.fn((table: string) => {
      if (table === 'TokenBlacklist') {
        return {
          select: () => ({ eq: (_field: string, jti: string) => ({ maybeSingle: async () => ({
            data: revoked.has(jti) ? { jti } : null,
          }) }) }),
          upsert: async (row: { jti: string }) => { revoked.add(row.jti); return { error: null }; },
        };
      }
      if (table === 'User') {
        return {
          update: () => ({ eq: async () => ({ error: null }) }),
          select: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: user }),
          single: async () => ({ data: user }),
          }) }),
        };
      }
      if (table === 'EmailVerification') {
        return {
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
          insert: async () => ({ error: null }),
        };
      }
      throw new Error('Database failure');
    }),
  };
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key-with-enough-entropy',
    ...settings,
  };
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sub: 'google-user', email: 'audit@example.invalid', email_verified: 'true', aud: 'wrong-client' }),
  });
  const sandbox = {
    exports: {},
    require: (name: string) => {
      if (name.includes('supabase-js')) return { createClient: () => database };
      if (name.includes('bcryptjs')) return require('bcryptjs');
      throw new Error(`Unexpected import: ${name}`);
    },
    Deno: { env: { get: (key: string) => env[key] }, serve: (fn: Handler) => { handler = fn; } },
    Request, Response, URL, TextEncoder, crypto: webcrypto, btoa, atob, console, fetch: fetchMock,
  };
  runInNewContext(compiled, sandbox);
  if (!handler) throw new Error('Edge handler not registered');
  return { handler, database, revoked, user, fetchMock, secret: env.JWT_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY };
}

function request(path: string, method = 'GET', body?: unknown, bearer?: string): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return new Request(`https://project.supabase.co/functions/v1/api${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function signedJwt(secret: string, claims: Record<string, unknown>, includeJti = true): string {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...(includeJti ? { jti: 'test-token' } : {}), ...claims })).toString('base64url');
  const data = `${head}.${payload}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}

describe('deployed Supabase API security', () => {
  it('returns the atomic paid invoice without a second payment write', async () => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    database.rpc.mockImplementation(async (name: string) => name === 'create_invoice_with_inventory'
      ? { data: { id: 'invoice-1', total: 30, paidAmount: 30, status: 'PAID' }, error: null }
      : { data: true, error: null });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/invoices', 'POST', {
      status: 'PAID', items: [{ name: 'Cake', unitPrice: 15, quantity: 2 }],
    }, token));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ total: 30, paidAmount: 30 });
    expect(database.from).not.toHaveBeenCalledWith('Invoice');
  });

  it('DSH-02: reports sales profit without fabricating undated cash flow', async () => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    const original = database.from.getMockImplementation()!;
    const rows: Record<string, unknown[]> = {
      Invoice: [{ total: 30, paidAmount: 30, status: 'PAID' }],
      Purchase: [{ total: 100 }], Expense: [{ amount: 2 }], Material: [],
      StockMovement: [
        { qty: -0.4, costAmount: 4, material: { unitPrice: 999 } },
        { qty: -0.1, costAmount: null, material: { unitPrice: 10 } },
      ],
    };
    database.from.mockImplementation((table: string) => {
      if (!(table in rows)) return original(table);
      const query: any = { data: rows[table], error: null };
      for (const method of ['select', 'eq', 'gte', 'lt', 'gt', 'order', 'range']) query[method] = jest.fn(() => query);
      return query;
    });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      totalSales: 30, totalPurchases: 100, costOfGoodsSold: 5,
      operatingExpenses: 2, totalExpenses: 7, netProfit: 23, cashFlow: null, paymentHistoryIncomplete: true,
    });
  });

  it('sums report rows beyond a single database page', async () => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    const original = database.from.getMockImplementation()!;
    database.from.mockImplementation((table: string) => {
      if (['User', 'TokenBlacklist'].includes(table)) return original(table);
      const rows = table === 'Invoice' ? Array.from({ length: 1201 }, () => ({ total: 1, status: 'UNPAID' })) : [];
      const query: any = { data: [], error: null };
      for (const method of ['select', 'eq', 'gte', 'lt', 'gt', 'order']) query[method] = jest.fn(() => query);
      query.range = (start: number, end: number) => { query.data = rows.slice(start, end + 1); return query; };
      return query;
    });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalSales: 1201, netProfit: 1201, unpaidInvoicesCount: 1201 });
  });

  it.each([0, 10, 30])('keeps October sales profit unchanged when later collection becomes %s', async (paidAmount) => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    const original = database.from.getMockImplementation()!;
    const rows: Record<string, unknown[]> = {
      Invoice: [{ id: 'sale', total: 30, paidAmount, status: paidAmount === 30 ? 'PAID' : paidAmount ? 'PARTIAL' : 'UNPAID', items: [{ product: null }] }],
      Purchase: [], Expense: [{ amount: 2 }], Material: [],
      StockMovement: [{ qty: -1, costAmount: 4 }],
    };
    database.from.mockImplementation((table: string) => {
      if (!(table in rows)) return original(table);
      const query: any = { data: rows[table], error: null };
      for (const method of ['select', 'eq', 'gte', 'lt', 'gt', 'order', 'range']) query[method] = jest.fn(() => query);
      return query;
    });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalSales: 30, netProfit: 24, cashFlow: null, missingCostItems: 1 });
  });

  it.each([false, true])('dates collections separately and handles legacy history: %s', async (legacy) => {
    const { handler, database, user, secret } = edgeApi({ PAYMENT_LEDGER_ENABLED: 'true' });
    user.businessId = 'business-1';
    const original = database.from.getMockImplementation()!;
    const rows: Record<string, Record<string, unknown>[]> = {
      Invoice: [{ id: 'old', total: 30, paidAmount: 10, status: 'PARTIAL', createdAt: '2026-10-10T00:00:00Z' }],
      InvoicePayment: [{ id: 'p', amount: 10, occurredAt: '2026-11-02T00:00:00Z' }, ...(legacy ? [{ id: 'legacy', amount: 20, occurredAt: null }] : [])],
      Purchase: [], Expense: [], Material: [], StockMovement: [],
    };
    database.from.mockImplementation((table: string) => {
      if (!(table in rows)) return original(table);
      let data = rows[table];
      const query: any = {
        select: () => query, eq: () => query, gt: () => query, order: () => query,
        range: (start: number, end: number) => { data = data.slice(start, end + 1); return query; },
        gte: (field: string, value: string) => { data = data.filter(row => row[field] != null && String(row[field]) >= value); return query; },
        lt: (field: string, value: string) => { data = data.filter(row => row[field] != null && String(row[field]) < value); return query; },
        is: (field: string, value: unknown) => { data = data.filter(row => row[field] === value); return query; },
        limit: (limit: number) => { data = data.slice(0, limit); return query; },
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const october = await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
    expect(await october.json()).toMatchObject({ totalSales: 30, netProfit: 30, cashCollected: legacy ? null : 0 });
    const november = await handler(request('/dashboard/summary?month=2026-11', 'GET', undefined, token));
    expect(await november.json()).toMatchObject({ totalSales: 0, netProfit: 0, cashCollected: legacy ? null : 10, cashFlow: legacy ? null : 10 });
  });

  it('fails the report explicitly when a database query fails instead of showing zero balances', async () => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    const original = database.from.getMockImplementation()!;
    database.from.mockImplementation((table: string) => {
      if (['User', 'TokenBlacklist'].includes(table)) return original(table);
      const query: any = { data: null, error: { message: 'private database detail' } };
      for (const method of ['select', 'eq', 'gte', 'lt', 'gt', 'order', 'range']) query[method] = jest.fn(() => query);
      return query;
    });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary', 'GET', undefined, token));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database detail');
  });

  it('routes both the production and candidate function prefixes', async () => {
    const { handler } = edgeApi();
    const candidate = await handler(new Request('https://project.supabase.co/functions/v1/api-candidate/health'));
    const production = await handler(request('/health'));

    expect(candidate.status).toBe(200);
    expect(production.status).toBe(200);
  });

  it('keeps phone OTP disabled unless explicitly enabled on the server', async () => {
    const { handler, database } = edgeApi({ GOOGLE_CLIENT_ID: '', EMAIL_LOGIN_ENABLED: 'true' });
    const response = await handler(request('/auth/otp/request', 'POST', { phone: '0500000001' }));
    const verify = await handler(request('/auth/otp/verify', 'POST', { phone: '0500000001', code: '123456' }));

    expect(response.status).toBe(503);
    expect(verify.status).toBe(503);
    expect(await response.text()).not.toMatch(/devCode|123456/);
    expect(database.from).not.toHaveBeenCalled();
    expect(database.rpc).toHaveBeenCalledTimes(2); // global IP limit only; no SMS budget/provider calls
  });

  it('rejects a Google token issued for another client', async () => {
    const { handler, database, fetchMock } = edgeApi({ GOOGLE_CLIENT_ID: 'expected-client' });
    const response = await handler(request('/auth/google', 'POST', { credential: 'wrong-audience-token' }));

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(database.from).not.toHaveBeenCalled();
  });

  it('blocks production demo login before writing records', async () => {
    const { handler, database } = edgeApi();
    const response = await handler(request('/auth/demo', 'POST', { phone: '0500000001' }));

    expect(response.status).toBe(404);
    expect(database.from).not.toHaveBeenCalled();
  });

  it.each(['/auth/email/register', '/auth/email/login', '/auth/email/verify', '/auth/password/forgot', '/auth/password/reset'])('keeps %s disabled by default without database access', async (path) => {
    const { handler, database, fetchMock } = edgeApi();
    const response = await handler(request(path, 'POST', {}));
    expect(response.status).toBe(404);
    expect(database.from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when email delivery or Google audience is unconfigured', async () => {
    const { handler, database } = edgeApi({ GOOGLE_CLIENT_ID: '', EMAIL_LOGIN_ENABLED: 'true' });
    const registration = await handler(request('/auth/email/register', 'POST', {
      email: 'audit@example.invalid', password: 'safe-password',
    }));
    const google = await handler(request('/auth/google', 'POST', { credential: 'untrusted-token' }));

    expect(registration.status).toBe(503);
    expect(google.status).toBe(503);
    expect(database.from).not.toHaveBeenCalled();
  });

  it('restricts browser preflight to the deployed site', async () => {
    const { handler } = edgeApi();
    const response = await handler(new Request('https://project.supabase.co/functions/v1/api/auth/me', {
      method: 'OPTIONS', headers: { Origin: 'https://untrusted.example.invalid' },
    }));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://daftar-ead.pages.dev');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('rejects a protected route without a bearer token', async () => {
    const { handler, database } = edgeApi();
    const response = await handler(request('/dashboard/summary'));

    expect(response.status).toBe(401);
    expect(database.from).not.toHaveBeenCalled();
  });

  it('rejects legacy tokens that have no revocable identifier', async () => {
    const { handler, database, secret } = edgeApi();
    const token = signedJwt(secret, {
      sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600,
    }, false);
    const response = await handler(request('/dashboard/summary', 'GET', undefined, token));

    expect(response.status).toBe(401);
    expect(database.from).not.toHaveBeenCalled();
  });

  it('runs global and per-identity shared rate limits before trying email login', async () => {
    const { handler, database } = edgeApi({ EMAIL_LOGIN_ENABLED: 'true' });
    const response = await handler(request('/auth/email/login', 'POST', {
      email: 'audit@example.invalid', password: 'wrong-password',
    }));

    expect(response.status).toBe(401);
    expect(database.rpc).toHaveBeenCalledTimes(3);
    expect(database.rpc).toHaveBeenCalledWith('consume_auth_rate_limit',
      expect.objectContaining({ p_limit: 100, p_window_seconds: 60 }));
    expect(database.rpc).toHaveBeenCalledWith('consume_auth_rate_limit',
      expect.objectContaining({ p_limit: 10, p_window_seconds: 60 }));
  });

  it('stops email login when the shared rate limit is exceeded', async () => {
    const { handler, database } = edgeApi({ EMAIL_LOGIN_ENABLED: 'true' });
    database.rpc.mockResolvedValue({ data: false, error: null });
    const response = await handler(request('/auth/email/login', 'POST', {
      email: 'audit@example.invalid', password: 'wrong-password',
    }));

    expect(response.status).toBe(429);
    expect(database.from).not.toHaveBeenCalled();
  });

  it('issues a token only after a verified account passes password checking', async () => {
    const { handler, user } = edgeApi({ EMAIL_LOGIN_ENABLED: 'true' });
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    user.emailVerified = true;

    const response = await handler(request('/auth/email/login', 'POST', {
      email: user.email, password: 'correct-password',
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.accessToken).toMatch(/^eyJ/);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('sends verification without returning the token to the registrant', async () => {
    const { handler, user, fetchMock } = edgeApi({ RESEND_API_KEY: 'test-delivery-key', EMAIL_LOGIN_ENABLED: 'true' });
    user.emailVerified = false;

    const response = await handler(request('/auth/email/register', 'POST', {
      email: user.email, password: 'correct-password',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.any(Object));
  });

  it('rejects the same JWT after logout adds its identifier to the blacklist', async () => {
    const { handler, revoked, secret } = edgeApi();
    const token = signedJwt(secret, {
      sub: 'user-1', jti: 'token-id', exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const before = await handler(request('/dashboard/summary', 'GET', undefined, token));
    const logout = await handler(request('/auth/logout', 'POST', {}, token));
    const after = await handler(request('/dashboard/summary', 'GET', undefined, token));

    expect(before.status).toBe(200);
    expect(logout.status).toBe(200);
    expect(revoked.has('token-id')).toBe(true);
    expect(after.status).toBe(401);
  });

  it('rejects attempts to move a record into another tenant', async () => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/customers/customer-1', 'PATCH', {
      businessId: 'business-2', name: 'Cross-tenant edit',
    }, token));

    expect(response.status).toBe(400);
    expect(database.from).not.toHaveBeenCalledWith('Customer');
  });

  it('does not expose credential fields in the current-user response', async () => {
    const { handler, user, secret } = edgeApi();
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/auth/me', 'GET', undefined, token));

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('hides internal exception messages from clients', async () => {
    const { handler, database, secret } = edgeApi();
    database.from.mockImplementation(() => { throw new Error('private database detail'); });
    const token = signedJwt(secret, { sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary', 'GET', undefined, token));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database detail');
  });
});
