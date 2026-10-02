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
