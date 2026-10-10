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
  const clientOptions: unknown[] = [];
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
      if (name.includes('supabase-js')) return { createClient: (_url: string, _key: string, options: unknown) => { clientOptions.push(options); return database; } };
      if (name.includes('bcryptjs')) return require('bcryptjs');
      throw new Error(`Unexpected import: ${name}`);
    },
    Deno: { env: { get: (key: string) => env[key] }, serve: (fn: Handler) => { handler = fn; } },
    Request, Response, URL, TextEncoder, crypto: webcrypto, btoa, atob, console, fetch: fetchMock,
  };
  runInNewContext(compiled, sandbox);
  if (!handler) throw new Error('Edge handler not registered');
  return { handler, database, revoked, user, fetchMock, clientOptions, secret: env.JWT_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY };
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

  it('reports sales profit without fabricating undated cash flow', async () => {
    const { handler, database, user, secret } = edgeApi();
    user.businessId = 'business-1';
    database.rpc.mockImplementation(async (name: string) => name === 'dashboard_summary'
      ? { data: { totalSales: 30, totalPurchases: 100, costOfGoodsSold: 5, operatingExpenses: 2, costEstimated: true, missingCostItems: 1 }, error: null }
      : { data: true, error: null });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalSales: 30, netProfit: 23, cashFlow: null, paymentHistoryIncomplete: true, costEstimated: true, missingCostItems: 1 });
  });

  it('reads payment collections beyond one database page', async () => {
    const { handler, database, user, secret } = edgeApi({ PAYMENT_LEDGER_ENABLED: 'true' });
    user.businessId = 'business-1';
    database.rpc.mockImplementation(async (name: string) => name === 'dashboard_summary' ? { data: {}, error: null } : { data: true, error: null });
    const original = database.from.getMockImplementation()!;
    database.from.mockImplementation((table: string) => {
      if (table !== 'InvoicePayment') return original(table);
      const rows = Array.from({ length: 1201 }, () => ({ amount: 1, occurredAt: '2026-10-05T00:00:00Z' }));
      const query: any = { data: [], error: null };
      for (const method of ['select', 'eq', 'gte', 'lt', 'order']) query[method] = jest.fn(() => query);
      query.is = () => { query.data = []; return query; };
      query.limit = () => query;
      query.range = (start: number, end: number) => { query.data = rows.slice(start, end + 1); return query; };
      return query;
    });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cashCollected: 1201, cashFlow: 1201 });
  });

  it.each([false, true])('dates collections separately and handles legacy history: %s', async (legacy) => {
    const { handler, database, user, secret } = edgeApi({ PAYMENT_LEDGER_ENABLED: 'true' });
    user.businessId = 'business-1';
    database.rpc.mockImplementation(async (name: string, args: any) => name === 'dashboard_summary'
      ? { data: { totalSales: args.p_start.startsWith('2026-09') ? 30 : 0 }, error: null } : { data: true, error: null });
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
    database.rpc.mockImplementation(async (name: string) => name === 'dashboard_summary' ? { data: null, error: { message: 'private database detail' } } : { data: true, error: null });
    const token = signedJwt(secret, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await handler(request('/dashboard/summary', 'GET', undefined, token));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database detail');
  });

  it.each([false, true])('labels Google new-account creation accurately: %s', async isNewUser => {
    const { handler, database, fetchMock, user } = edgeApi({ GOOGLE_CLIENT_ID: 'expected-client' });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sub: 'google-real-test', email: 'anonymous@example.invalid', email_verified: true, aud: 'expected-client' }) });
    if (isNewUser) {
      const original = database.from.getMockImplementation()!;
      database.from.mockImplementation((table: string): any => table === 'User' ? {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { ...user, googleId: 'google-real-test' }, error: null }) }) }),
      } : original(table));
    }
    const response = await handler(request('/auth/google','POST',{ credential: 'synthetic-google-token' }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ isNewUser });
  });

  describe('anonymous behavior collection', () => {
    const event = { id: '11111111-1111-4111-8111-111111111111', deviceId: '22222222-2222-4222-8222-222222222222', sessionId: '33333333-3333-4333-8333-333333333333', event: 'page_viewed', path: '/login', source: 'x', properties: {}, occurredAt: new Date().toISOString() };
    it('stores an anonymous event without looking up the account', async () => {
      const { handler, database } = edgeApi();
      const response = await handler(request('/analytics/events', 'POST', event));
      expect(response.status).toBe(204);
      expect(database.from).not.toHaveBeenCalled();
      expect(database.rpc).toHaveBeenCalledWith('record_product_event', expect.objectContaining({ p_event: 'page_viewed', p_path: '/login', p_properties: {} }));
    });
    it.each([{ properties: { email: 'private@example.invalid' } }, { email: 'private@example.invalid' }, { path: '/login?email=private' }, { event: 'arbitrary_message' }, { properties: { workflow: 'private text' } }, { deviceId: 'real-account-id' }])('rejects identifying or arbitrary input: %j', async patch => {
      const { handler, database } = edgeApi();
      const response = await handler(request('/analytics/events', 'POST', { ...event, ...patch }));
      expect(response.status).toBe(400);
      expect(database.rpc.mock.calls.some(call => call[0] === 'record_product_event')).toBe(false);
    });
    it('does not expose the private analytics summary anonymously', async () => {
      const { handler, database } = edgeApi();
      expect((await handler(request('/admin/analytics'))).status).toBe(401);
      expect(database.rpc.mock.calls.some(call => call[0] === 'product_analytics_summary')).toBe(false);
    });
    it('honors the server kill switch', async () => {
      const { handler, database } = edgeApi({ ANALYTICS_ENABLED: 'false' });
      expect((await handler(request('/analytics/events', 'POST', event))).status).toBe(204);
      expect(database.rpc).not.toHaveBeenCalled();
    });
    it('rate limits collection before writing any event', async () => {
      const { handler, database } = edgeApi(); database.rpc.mockResolvedValue({ data: false, error: null });
      expect((await handler(request('/analytics/events', 'POST', event))).status).toBe(429);
      expect(database.rpc.mock.calls.some(call => call[0] === 'record_product_event')).toBe(false);
    });
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

describe('deleting records', () => {
  function withExpenses(rows: Array<{ id: string; businessId: string }>) {
    const api = edgeApi();
    api.user.businessId = 'business-a';
    const original = api.database.from.getMockImplementation()!;
    api.database.from.mockImplementation((table: string) => {
      if (table !== 'Expense') return original(table);
      const filters: Array<[string, unknown]> = [];
      let deleting = false;
      const run = () => {
        const matches = rows.filter(row => filters.every(([field, value]) => (row as Record<string, unknown>)[field] === value));
        if (deleting) for (const row of matches) rows.splice(rows.indexOf(row), 1);
        return { data: matches, error: null };
      };
      const query: any = {
        delete: () => { deleting = true; return query; },
        eq: (field: string, value: unknown) => { filters.push([field, value]); return query; },
        select: () => query,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      };
      return query;
    });
    const token = signedJwt(api.secret, { sub: api.user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    return { ...api, rows, token };
  }

  it("returns 404 and keeps the record when deleting another business's expense", async () => {
    const { handler, rows, token } = withExpenses([{ id: 'expense-b', businessId: 'business-b' }]);
    const response = await handler(request('/expenses/expense-b', 'DELETE', undefined, token));
    expect(response.status).toBe(404);
    expect(rows).toEqual([{ id: 'expense-b', businessId: 'business-b' }]);
  });

  it('returns 204 and removes the record when deleting your own expense', async () => {
    const { handler, rows, token } = withExpenses([{ id: 'expense-a', businessId: 'business-a' }]);
    const response = await handler(request('/expenses/expense-a', 'DELETE', undefined, token));
    expect(response.status).toBe(204);
    expect(rows).toEqual([]);
  });
});

describe('creating invoices idempotently', () => {
  function invoiceApi() {
    const api = edgeApi();
    api.user.businessId = 'business-a';
    api.database.rpc.mockImplementation(async (name: string) => name === 'create_invoice_with_inventory'
      ? { data: { id: 'invoice-1', number: 7, total: 30, paidAmount: 0, status: 'UNPAID' }, error: null }
      : { data: true, error: null });
    const token = signedJwt(api.secret, { sub: api.user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    return { ...api, token };
  }

  function createInvoice(handler: Handler, token: string, key?: string) {
    const req = request('/invoices', 'POST', { items: [{ name: 'Cake', unitPrice: 15, quantity: 2 }] }, token);
    if (key) req.headers.set('Idempotency-Key', key);
    return handler(req);
  }

  it('passes the Idempotency-Key header to the invoice transaction', async () => {
    const { handler, database, token } = invoiceApi();
    const response = await createInvoice(handler, token, 'checkout-7f3a9c2e');
    expect(response.status).toBe(201);
    expect(database.rpc).toHaveBeenCalledWith('create_invoice_with_inventory',
      expect.objectContaining({ p_idempotency_key: 'checkout-7f3a9c2e' }));
  });

  it('lets the deployed site send the Idempotency-Key header across origins', async () => {
    const { handler } = invoiceApi();
    const response = await handler(new Request('https://project.supabase.co/functions/v1/api/invoices', {
      method: 'OPTIONS',
      headers: { Origin: 'https://daftar1.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, idempotency-key' },
    }));
    const allowed = (response.headers.get('Access-Control-Allow-Headers') ?? '').split(',').map(h => h.trim().toLowerCase());
    expect(allowed).toContain('idempotency-key');
  });

  it('answers a retried key with the original invoice and 200 instead of creating another', async () => {
    const { handler, database, token } = invoiceApi();
    database.rpc.mockImplementation(async (name: string) => name === 'create_invoice_with_inventory'
      ? { data: { id: 'invoice-1', number: 7, total: 30, paidAmount: 0, status: 'UNPAID', replayed: true }, error: null }
      : { data: true, error: null });
    const response = await createInvoice(handler, token, 'checkout-7f3a9c2e');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'invoice-1', number: 7 });
  });

  it('rejects a malformed Idempotency-Key before touching the database', async () => {
    const { handler, database, token } = invoiceApi();
    const response = await createInvoice(handler, token, 'x'.repeat(300));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_IDEMPOTENCY_KEY' });
    expect(database.rpc).not.toHaveBeenCalledWith('create_invoice_with_inventory', expect.anything());
  });
});

describe('review findings 2026-10-03', () => {
  type Result = { data: unknown; error: unknown };
  // A chainable PostgREST stand-in: every filter returns itself, awaiting yields `result`.
  function query(result: Result) {
    const q: any = {};
    for (const m of ['select', 'eq', 'gte', 'lt', 'gt', 'order', 'range', 'limit', 'insert', 'update', 'delete']) q[m] = jest.fn(() => q);
    q.single = jest.fn(async () => result);
    q.maybeSingle = jest.fn(async () => result);
    q.then = (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return q;
  }

  function api(tables: Record<string, Result> = {}, settings: Record<string, string> = {}) {
    const base = edgeApi(settings);
    base.user.businessId = 'business-a';
    const original = base.database.from.getMockImplementation()!;
    const queries: Record<string, any[]> = {};
    base.database.from.mockImplementation((table: string) => {
      if (!(table in tables)) return original(table);
      const q = query(tables[table]);
      (queries[table] ??= []).push(q);
      return q;
    });
    const token = signedJwt(base.secret, { sub: base.user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    return { ...base, token, queries };
  }

  function rpcReturns(database: { rpc: jest.Mock }, name: string, result: Result) {
    database.rpc.mockImplementation(async (called: string) => called === name ? result : { data: true, error: null });
  }

  describe('1. POST to an existing record cannot rewrite it', () => {
    it.each(['/invoices/invoice-1', '/purchases/purchase-1'])('rejects POST %s with 405 before touching the table', async path => {
      const { handler, database, token } = api();
      const response = await handler(request(path, 'POST', { total: 1, paidAmount: 1 }, token));
      expect(response.status).toBe(405);
      expect(database.from).not.toHaveBeenCalledWith('Invoice');
      expect(database.from).not.toHaveBeenCalledWith('Purchase');
    });

    it('refuses to change an invoice idempotency key through PATCH', async () => {
      const { handler, token, queries } = api({ Invoice: { data: { id: 'invoice-1' }, error: null } });
      const response = await handler(request('/invoices/invoice-1', 'PATCH', { idempotencyKey: 'other-key-123' }, token));
      expect(response.status).toBe(400);
      expect(queries.Invoice?.some(q => q.update.mock.calls.length)).toBeFalsy();
    });

    it.each(['total', 'number'])('refuses to change a purchase %s through PATCH', async field => {
      const { handler, token, queries } = api({ Purchase: { data: { id: 'purchase-1' }, error: null } });
      const response = await handler(request('/purchases/purchase-1', 'PATCH', { [field]: 1 }, token));
      expect(response.status).toBe(400);
      expect(queries.Purchase?.some(q => q.update.mock.calls.length)).toBeFalsy();
    });
  });

  describe('2. a database fault while checking the session is not a logout', () => {
    it.each(['User', 'TokenBlacklist'])('answers 503, not 401, when the %s lookup fails', async table => {
      const { handler, token } = api({ [table]: { data: null, error: { message: 'connection reset' } } });
      const response = await handler(request('/auth/me', 'GET', undefined, token));
      expect(response.status).toBe(503);
    });
  });

  describe('3. browsers may cache the CORS preflight', () => {
    it('sends Access-Control-Max-Age on preflight', async () => {
      const { handler } = api();
      const response = await handler(new Request('https://project.supabase.co/functions/v1/api/invoices', {
        method: 'OPTIONS', headers: { Origin: 'https://daftar1.com' },
      }));
      expect(response.headers.get('Access-Control-Max-Age')).toBe('7200');
    });
  });

  describe('4. report totals come from SQL aggregates', () => {
    const summary = { totalSales: 30, totalPurchases: 100, costOfGoodsSold: 5, operatingExpenses: 2,
      invoiceCount: 3, paidInvoicesCount: 1, unpaidInvoicesCount: 2, unpaidInvoicesTotal: 40, unpaidInvoices: [], lowStock: [] };

    it('derives profit and cash flow from the dashboard_summary aggregate', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'dashboard_summary', { data: summary, error: null });
      const response = await handler(request('/dashboard/summary', 'GET', undefined, token));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ totalExpenses: 7, netProfit: 23, cashFlow: null, unpaidInvoicesCount: 2, unpaidInvoicesTotal: 40 });
      expect(database.from).not.toHaveBeenCalledWith('Invoice');
    });

    it('fails the report with 503 when the aggregate fails', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'dashboard_summary', { data: null, error: { message: 'private detail' } });
      const response = await handler(request('/dashboard/summary', 'GET', undefined, token));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('private detail');
    });

    it('builds the purchases summary from the purchases_summary aggregate', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'purchases_summary', { data: { bySupplier: [{ name: 'A', count: 2, total: 9 }], byMonth: [] }, error: null });
      const response = await handler(request('/purchases/summary', 'GET', undefined, token));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ bySupplier: [{ name: 'A', count: 2, total: 9 }], byMonth: [] });
    });

    it('pages stock movements instead of returning every row', async () => {
      const { handler, token, queries } = api({ StockMovement: { data: [], error: null } });
      const response = await handler(request('/inventory/movements?page=2&limit=50', 'GET', undefined, token));
      expect(response.status).toBe(200);
      expect(queries.StockMovement[0].range).toHaveBeenCalledWith(50, 99);
    });
  });

  describe('5. invoice failures that may have saved are retryable server errors', () => {
    it('answers an unclassified invoice transaction error with 500', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'create_invoice_with_inventory', { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
      const response = await handler(request('/invoices', 'POST', { items: [{ name: 'Cake', unitPrice: 15, quantity: 2 }] }, token));
      expect(response.status).toBe(500);
    });

    it('keeps rejected input as a 400', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'create_invoice_with_inventory', { data: null, error: { code: 'P0001', message: 'Invalid invoice item' } });
      const response = await handler(request('/invoices', 'POST', { items: [{ name: 'Cake', unitPrice: 15, quantity: 2 }] }, token));
      expect(response.status).toBe(400);
    });
  });

  describe('6. one idempotency key means one request', () => {
    it('answers 422 when a key is reused for a different invoice', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'create_invoice_with_inventory', { data: null, error: { code: 'P0001', message: 'Idempotency key reused' } });
      const req = request('/invoices', 'POST', { items: [{ name: 'Tea', unitPrice: 5, quantity: 1 }] }, token);
      req.headers.set('Idempotency-Key', 'checkout-7f3a9c2e');
      const response = await handler(req);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    });
  });

  describe('8. deleting an invoice reverses its stock', () => {
    it('deletes through delete_invoice_with_inventory and answers 204', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'delete_invoice_with_inventory', { data: true, error: null });
      const response = await handler(request('/invoices/invoice-1', 'DELETE', undefined, token));
      expect(response.status).toBe(204);
      expect(database.rpc).toHaveBeenCalledWith('delete_invoice_with_inventory', { p_business_id: 'business-a', p_invoice_id: 'invoice-1' });
      expect(database.from).not.toHaveBeenCalledWith('Invoice');
    });

    it("answers 404 for an invoice outside the caller's business", async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'delete_invoice_with_inventory', { data: false, error: null });
      const response = await handler(request('/invoices/invoice-b', 'DELETE', undefined, token));
      expect(response.status).toBe(404);
    });
  });

  describe('9. months follow Riyadh time', () => {
    it('passes Riyadh month boundaries to the report', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'dashboard_summary', { data: {}, error: null });
      await handler(request('/dashboard/summary?month=2026-10', 'GET', undefined, token));
      expect(database.rpc).toHaveBeenCalledWith('dashboard_summary', {
        p_business_id: 'business-a',
        p_start: '2026-09-30T21:00:00.000Z', p_end: '2026-10-31T21:00:00.000Z',
        p_start_date: '2026-10-01', p_end_date: '2026-11-01',
      });
    });

    it('filters invoice lists by the Riyadh month', async () => {
      const { handler, token, queries } = api({ Invoice: { data: [], error: null } });
      await handler(request('/invoices?month=2026-10', 'GET', undefined, token));
      expect(queries.Invoice[0].gte).toHaveBeenCalledWith('createdAt', '2026-09-30T21:00:00.000Z');
      expect(queries.Invoice[0].lt).toHaveBeenCalledWith('createdAt', '2026-10-31T21:00:00.000Z');
    });

    it('filters purchase lists by purchase date, like the dashboard', async () => {
      const { handler, token, queries } = api({ Purchase: { data: [], error: null } });
      await handler(request('/purchases?month=2026-10', 'GET', undefined, token));
      expect(queries.Purchase[0].gte).toHaveBeenCalledWith('date', '2026-10-01');
      expect(queries.Purchase[0].lt).toHaveBeenCalledWith('date', '2026-11-01');
    });
  });

  describe('10. reads report database faults instead of empty data', () => {
    it.each([
      ['/customers', 'Customer'], ['/customers/c-1', 'Customer'], ['/inventory', 'Material'],
      ['/inventory/movements', 'StockMovement'], ['/business', 'Business'],
    ])('GET %s answers 503 when the query fails', async (path, table) => {
      const { handler, token } = api({ [table]: { data: null, error: { code: '08006', message: 'connection failure' } } });
      const response = await handler(request(path, 'GET', undefined, token));
      expect(response.status).toBe(503);
    });

    it('still answers 404 when a single record does not exist', async () => {
      const { handler, token } = api({ Customer: { data: null, error: { code: 'PGRST116', message: 'no rows' } } });
      const response = await handler(request('/customers/missing', 'GET', undefined, token));
      expect(response.status).toBe(404);
    });
  });

  describe('low-priority findings', () => {
    it('checks a password hash even for unknown emails so timing does not reveal accounts', async () => {
      // The spec's `import * as` binding is frozen; spy on the CommonJS module the sandbox loads.
      const compare = jest.spyOn(require('bcryptjs'), 'compare');
      try {
        const { handler } = api({ User: { data: null, error: null } }, { EMAIL_LOGIN_ENABLED: 'true' });
        const response = await handler(request('/auth/email/login', 'POST', { email: 'nobody@example.invalid', password: 'wrong-password' }));
        expect(response.status).toBe(401);
        expect(compare).toHaveBeenCalledTimes(1);
      } finally { compare.mockRestore(); }
    });

    it('adjusts stock through the atomic adjust_material_stock function', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'adjust_material_stock', { data: { id: 'm-1', stockQty: 7 }, error: null });
      const response = await handler(request('/inventory/adjust', 'POST', { materialId: 'm-1', newQty: 7, note: 'جرد' }, token));
      expect(response.status).toBe(200);
      expect(database.rpc).toHaveBeenCalledWith('adjust_material_stock', { p_business_id: 'business-a', p_material_id: 'm-1', p_new_qty: 7, p_note: 'جرد' });
      expect(database.from).not.toHaveBeenCalledWith('Material');
    });

    it('answers 404 when adjusting a material outside the business', async () => {
      const { handler, database, token } = api();
      rpcReturns(database, 'adjust_material_stock', { data: null, error: { code: 'P0001', message: 'Material not found' } });
      const response = await handler(request('/inventory/adjust', 'POST', { materialId: 'm-x', newQty: 7 }, token));
      expect(response.status).toBe(404);
    });

    it('orders invoice items when reading an invoice', async () => {
      const { handler, token, queries } = api({ Invoice: { data: { id: 'invoice-1', items: [] }, error: null } });
      await handler(request('/invoices/invoice-1', 'GET', undefined, token));
      expect(queries.Invoice[0].order).toHaveBeenCalledWith('position', { referencedTable: 'items', ascending: true });
    });
  });
});

describe('database requests rejected by the gateway', () => {
  // A cold-started function occasionally gets 401 from the API gateway on its
  // first concurrent calls, although every call carries the same service key.
  async function databaseFetch() {
    const api = edgeApi();
    await api.handler(request('/dashboard/summary', 'GET', undefined, signedJwt(api.secret, { sub: api.user.id, exp: Math.floor(Date.now() / 1000) + 3600 })));
    const options = api.clientOptions[0] as { global?: { fetch?: (input: string, init?: RequestInit) => Promise<Response> } };
    return { ...api, dbFetch: options.global?.fetch };
  }

  it('retries a request once when the gateway answers 401', async () => {
    const { dbFetch, fetchMock } = await databaseFetch();
    expect(dbFetch).toBeDefined();
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 })).mockResolvedValueOnce(new Response('true', { status: 200 }));
    const response = await dbFetch!('https://project.supabase.co/rest/v1/rpc/consume_auth_rate_limit', { method: 'POST', body: '{}' });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry other failures, which may already have run', async () => {
    const { dbFetch, fetchMock } = await databaseFetch();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    const response = await dbFetch!('https://project.supabase.co/rest/v1/rpc/create_invoice_with_inventory', { method: 'POST', body: '{}' });
    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after one retry', async () => {
    const { dbFetch, fetchMock } = await databaseFetch();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    const response = await dbFetch!('https://project.supabase.co/rest/v1/User', { method: 'GET' });
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('reading a product for editing', () => {
  it('returns the product with its recipe items, which the edit form needs', async () => {
    const api = edgeApi();
    api.user.businessId = 'business-a';
    const original = api.database.from.getMockImplementation()!;
    const selects: string[] = [];
    api.database.from.mockImplementation((table: string) => {
      if (table !== 'Product') return original(table);
      const q: any = {};
      q.select = jest.fn((columns: string) => { selects.push(columns); return q; });
      q.eq = jest.fn(() => q);
      q.single = jest.fn(async () => ({ data: { id: 'p-1', recipeItems: [] }, error: null }));
      return q;
    });
    const token = signedJwt(api.secret, { sub: api.user.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = await api.handler(request('/products/p-1', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(selects[0]).toMatch(/recipeItems:RecipeItem\(\*\)/);
  });
});

describe('platform admin and support', () => {
  type Row = Record<string, unknown>;
  const ADMIN = { id: 'user-admin', email: 'owner@example.invalid', googleId: 'g-1', emailVerified: false, phone: null, businessId: 'business-a', name: 'حسام' };

  // Users are looked up by id; every other table records what was written.
  function adminApi(options: { caller?: Row; target?: Row | null; settings?: Record<string, string> } = {}) {
    const api = edgeApi({ ADMIN_EMAILS: 'Owner@Example.invalid', RESEND_API_KEY: 'test-delivery-key', ...options.settings });
    const caller = { ...ADMIN, ...options.caller };
    const target = options.target === undefined
      ? { id: 'user-target', email: 'customer@example.invalid', googleId: null, emailVerified: true, passwordHash: 'hash', name: 'زبون' }
      : options.target;
    const inserts: Record<string, Row[]> = {};
    api.database.from.mockImplementation((table: string) => {
      const filters: Record<string, unknown> = {};
      const q: any = {};
      for (const m of ['select', 'update', 'gt', 'order', 'limit']) q[m] = jest.fn(() => q);
      q.eq = jest.fn((field: string, value: unknown) => { filters[field] = value; return q; });
      q.insert = jest.fn(async (row: Row) => { (inserts[table] ??= []).push(row); return { error: null }; });
      const lookup = () => {
        if (table === 'TokenBlacklist') return { data: null, error: null };
        if (table === 'User') return { data: filters.id === caller.id ? caller : filters.id === target?.id ? target : null, error: null };
        return { data: null, error: null };
      };
      q.maybeSingle = jest.fn(async () => lookup());
      q.single = jest.fn(async () => lookup());
      q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
      return q;
    });
    const token = signedJwt(api.secret, { sub: caller.id, exp: Math.floor(Date.now() / 1000) + 3600 });
    return { ...api, token, inserts };
  }

  it('hides the admin area from everyone not listed as an admin', async () => {
    const { handler, database, token } = adminApi({ caller: { email: 'someone@example.invalid' } });
    const response = await handler(request('/admin/overview', 'GET', undefined, token));
    expect(response.status).toBe(404);
    expect(database.rpc).not.toHaveBeenCalledWith('admin_overview', expect.anything());
  });

  it('requires a verified email even when the address is on the admin list', async () => {
    const { handler, token } = adminApi({ caller: { googleId: null, emailVerified: false } });
    const response = await handler(request('/admin/overview', 'GET', undefined, token));
    expect(response.status).toBe(404);
  });

  it('shows the platform overview to the admin', async () => {
    const { handler, database, token } = adminApi();
    database.rpc.mockImplementation(async (name: string) => name === 'admin_overview'
      ? { data: { users: 13, businesses: 12 }, error: null } : { data: true, error: null });
    const response = await handler(request('/admin/overview', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ users: 13, businesses: 12 });
  });

  it('tells the web app who is an admin', async () => {
    const admin = adminApi();
    const me = await admin.handler(request('/auth/me', 'GET', undefined, admin.token));
    expect((await me.json()).user).toMatchObject({ isAdmin: true });
    const other = adminApi({ caller: { email: 'someone@example.invalid' } });
    const them = await other.handler(request('/auth/me', 'GET', undefined, other.token));
    expect((await them.json()).user).toMatchObject({ isAdmin: false });
  });

  it('searches users through admin_find_users', async () => {
    const { handler, database, token } = adminApi();
    database.rpc.mockImplementation(async (name: string) => name === 'admin_find_users'
      ? { data: [{ id: 'user-target' }], error: null } : { data: true, error: null });
    const response = await handler(request('/admin/users?q=customer', 'GET', undefined, token));
    expect(response.status).toBe(200);
    expect(database.rpc).toHaveBeenCalledWith('admin_find_users', { p_query: 'customer' });
  });

  it('sends a password reset link to a user and records who sent it', async () => {
    const { handler, token, inserts, fetchMock } = adminApi();
    const response = await handler(request('/admin/users/user-target/password-reset', 'POST', {}, token));
    expect(response.status).toBe(200);
    expect(inserts.PasswordReset?.[0]).toMatchObject({ userId: 'user-target' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ body: expect.stringContaining('customer@example.invalid') }));
    expect(inserts.AdminAuditLog?.[0]).toMatchObject({ adminUserId: 'user-admin', action: 'PASSWORD_RESET_LINK', targetUserId: 'user-target', result: 'SENT' });
  });

  it('refuses a password reset for a Google-only account', async () => {
    const { handler, token, inserts } = adminApi({ target: { id: 'user-target', email: 'g@example.invalid', googleId: 'g-2', emailVerified: false, passwordHash: null } });
    const response = await handler(request('/admin/users/user-target/password-reset', 'POST', {}, token));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'NO_PASSWORD_LOGIN' });
    expect(inserts.PasswordReset).toBeUndefined();
  });

  it('sends a verification link only to an unverified email account', async () => {
    const verified = adminApi();
    const already = await verified.handler(request('/admin/users/user-target/verification-email', 'POST', {}, verified.token));
    expect(already.status).toBe(409);
    expect(await already.json()).toMatchObject({ code: 'ALREADY_VERIFIED' });

    const pending = adminApi({ target: { id: 'user-target', email: 'new@example.invalid', googleId: null, emailVerified: false, passwordHash: 'hash' } });
    const sent = await pending.handler(request('/admin/users/user-target/verification-email', 'POST', {}, pending.token));
    expect(sent.status).toBe(200);
    expect(pending.inserts.EmailVerification?.[0]).toMatchObject({ userId: 'user-target' });
    expect(pending.inserts.AdminAuditLog?.[0]).toMatchObject({ action: 'VERIFICATION_LINK', result: 'SENT' });
  });

  it('answers 404 for an unknown target user', async () => {
    const { handler, token } = adminApi({ target: null });
    const response = await handler(request('/admin/users/nobody/password-reset', 'POST', {}, token));
    expect(response.status).toBe(404);
  });

  it('records server errors without personal data for the overview', async () => {
    const { handler, database, token, inserts } = adminApi({ caller: { email: 'someone@example.invalid' } });
    database.rpc.mockImplementation(async (name: string) => name === 'dashboard_summary'
      ? { data: null, error: { message: 'boom' } } : { data: true, error: null });
    await handler(request('/invoices/abc123?month=2026-10', 'GET', undefined, token));
    const response = await handler(request('/dashboard/summary', 'GET', undefined, token));
    expect(response.status).toBe(503);
    expect(inserts.ApiErrorEvent).toEqual([{ method: 'GET', path: '/dashboard/summary', status: 503 }]);
  });

  it('stores ids in error paths as placeholders', async () => {
    const { handler, token, inserts, database } = adminApi({ caller: { email: 'someone@example.invalid' } });
    database.rpc.mockImplementation(async (name: string) => name === 'delete_invoice_with_inventory'
      ? { data: null, error: { code: 'XX', message: 'boom' } } : { data: true, error: null });
    await handler(request('/invoices/inv_secret_123', 'DELETE', undefined, token));
    expect(inserts.ApiErrorEvent?.[0]).toEqual({ method: 'DELETE', path: '/invoices/:id', status: 500 });
  });
});
