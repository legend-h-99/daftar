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

  it('routes both the production and candidate function prefixes', async () => {
    const { handler } = edgeApi();
    const candidate = await handler(new Request('https://project.supabase.co/functions/v1/api-candidate/health'));
    const production = await handler(request('/health'));

    expect(candidate.status).toBe(200);
    expect(production.status).toBe(200);
  });

  it('keeps phone OTP disabled unless explicitly enabled on the server', async () => {
    const { handler, database } = edgeApi({ GOOGLE_CLIENT_ID: '' });
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

  it('fails closed when email delivery or Google audience is unconfigured', async () => {
    const { handler, database } = edgeApi({ GOOGLE_CLIENT_ID: '' });
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
    const { handler, database } = edgeApi();
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
    const { handler, database } = edgeApi();
    database.rpc.mockResolvedValue({ data: false, error: null });
    const response = await handler(request('/auth/email/login', 'POST', {
      email: 'audit@example.invalid', password: 'wrong-password',
    }));

    expect(response.status).toBe(429);
    expect(database.from).not.toHaveBeenCalled();
  });

  it('issues a token only after a verified account passes password checking', async () => {
    const { handler, user } = edgeApi();
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
    const { handler, user, fetchMock } = edgeApi({ RESEND_API_KEY: 'test-delivery-key' });
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
      expect(await response.json()).toMatchObject({ totalExpenses: 7, netProfit: 23, cashFlow: -72, unpaidInvoicesCount: 2, unpaidInvoicesTotal: 40 });
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
        const { handler } = api({ User: { data: null, error: null } });
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
