const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = createRequire(require('node:path').resolve(__dirname, '../../../apps/web/package.json'))('typescript')

const source = fs.readFileSync(`${__dirname}/index.ts`, 'utf8').replace(/^import .*$/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

const EDGE_SECRET = 'e'.repeat(32)

// A chainable stand-in for the Supabase query builder. `answer(table, ops)` decides the result
// when the chain is awaited or ends in single()/maybeSingle().
function builder(table, answer) {
  const ops = []
  const chain = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') { const result = answer(table, ops); return result.then.bind(result) }
      if (prop === 'single' || prop === 'maybeSingle') return () => answer(table, [...ops, [prop]])
      return (...args) => { ops.push([prop, ...args]); return chain }
    },
  })
  return chain
}

// The minute windows always pass here, so each test sees only the hourly caps. Each hourly key
// keeps a plain count, as if every request fell inside the same hour.
function harness({ answer = async () => ({ data: null, error: null }) } = {}) {
  const hourly = new Map()
  const provider = []
  const client = {
    rpc: async (name, args) => {
      if (name === 'consume_external_usage_budget') return { data: true, error: null }
      if (name !== 'consume_auth_rate_limit') throw new Error(`unexpected rpc ${name}`)
      if (args.p_window_seconds === 60) return { data: true, error: null }
      assert.equal(args.p_window_seconds, 3600)
      const used = (hourly.get(args.p_key) ?? 0) + 1
      hourly.set(args.p_key, used)
      return { data: used <= args.p_limit, error: null }
    },
    from: table => builder(table, answer),
  }
  const env = {
    SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', JWT_SECRET: 'jwt-secret',
    PHONE_LOGIN_ENABLED: 'true', AUTHENTICA_API_KEY: 'key', EDGE_SHARED_SECRET: EDGE_SECRET,
  }
  const context = vm.createContext({
    createClient: () => client, Deno: { env: { get: key => env[key] }, serve: () => {} },
    bcrypt: { hash: async () => 'hashed', compare: async () => false },
    fetch: async (url, init) => {
      provider.push({ url: String(url), body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ success: true, status: false }), { status: 200 })
    },
    crypto: require('node:crypto').webcrypto, Response, Request, URL, Headers, TextEncoder, TextDecoder, AbortSignal,
    console: { error: () => {}, warn: () => {} }, setTimeout, clearTimeout, atob, btoa,
  })
  vm.runInContext(js, context)
  const post = (path, body, ip = null) => context.handleRequest(new Request(`https://test${path}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: ip ? { 'cf-connecting-ip': ip, 'x-daftar-edge-secret': EDGE_SECRET } : {},
  }))
  return { context, provider, post }
}

test('one number gets five codes an hour, so it cannot drain the shared SMS budget', async () => {
  const h = harness()
  for (let i = 0; i < 5; i++) {
    assert.equal((await h.post('/auth/otp/request', { phone: '0512345678' })).status, 200)
  }
  const refused = await h.post('/auth/otp/request', { phone: '+966512345678' })
  assert.equal(refused.status, 429)
  assert.equal((await refused.json()).code, 'RATE_LIMITED')
  assert.equal(h.provider.length, 5, 'the sixth request never reaches the SMS provider')
  // Another number is unaffected.
  assert.equal((await h.post('/auth/otp/request', { phone: '0598765432' })).status, 200)
})

test('one address gets twenty codes an hour across different numbers', async () => {
  const h = harness()
  for (let i = 0; i < 20; i++) {
    const phone = `05${String(10000000 + i)}`
    assert.equal((await h.post('/auth/otp/request', { phone }, '203.0.113.7')).status, 200)
  }
  assert.equal((await h.post('/auth/otp/request', { phone: '0599999999' }, '203.0.113.7')).status, 429)
  assert.equal((await h.post('/auth/otp/request', { phone: '0599999999' }, '203.0.113.8')).status, 200)
  assert.equal(h.provider.length, 21)
})

test('code guesses for one number stop after fifteen an hour', async () => {
  const h = harness()
  for (let i = 0; i < 15; i++) {
    assert.equal((await h.post('/auth/otp/verify', { phone: '0512345678', code: String(100000 + i) })).status, 401)
  }
  assert.equal((await h.post('/auth/otp/verify', { phone: '0512345678', code: '999999' })).status, 429)
  assert.equal(h.provider.length, 15, 'the sixteenth guess never reaches the provider')
})

test('a reset link that another request already claimed does not change the password', async () => {
  const writes = []
  const h = harness({
    answer: async (table, ops) => {
      const update = ops.find(([op]) => op === 'update')
      if (update) writes.push({ table, values: update[1] })
      if (table === 'PasswordReset' && !update) return { data: { id: 'reset_1', userId: 'user_1' }, error: null }
      // The claim matches no row: a concurrent request consumed the link first.
      if (table === 'PasswordReset' && update) return { data: null, error: null }
      return { data: { id: 'user_1' }, error: null }
    },
  })
  const response = await h.context.authPasswordReset({ token: 'a'.repeat(64), password: 'new-password-1' })
  assert.equal(response.status, 400)
  assert.deepEqual(writes.map(w => w.table), ['PasswordReset'], 'the User row is never updated')
})

test('a claimed reset link sets the password once', async () => {
  const writes = []
  const h = harness({
    answer: async (table, ops) => {
      const update = ops.find(([op]) => op === 'update')
      if (update) writes.push({ table, values: update[1] })
      if (table === 'PasswordReset') return { data: { id: 'reset_1', userId: 'user_1' }, error: null }
      return { data: { id: 'user_1', email: 'a@example.com', phone: null, name: null, businessId: null }, error: null }
    },
  })
  const response = await h.context.authPasswordReset({ token: 'a'.repeat(64), password: 'new-password-1' })
  assert.equal(response.status, 200)
  assert.deepEqual(writes.map(w => w.table), ['PasswordReset', 'User'], 'the link is claimed before the password changes')
  assert.equal(writes[1].values.passwordHash, 'hashed')
})
