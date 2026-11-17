const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = createRequire(require('node:path').resolve(__dirname, '../../../apps/web/package.json'))('typescript')

const source = fs.readFileSync(`${__dirname}/index.ts`, 'utf8').replace(/^import .*$/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

const IMAGE = `data:image/jpeg;base64,${Buffer.alloc(3000, 7).toString('base64')}`
const MATERIALS = [
  { id: 'mat_flour', name: 'طحين', unit: 'KG' },
  { id: 'mat_eggs', name: 'بيض', unit: 'PIECE' },
]

function toolAnswer(input) {
  return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'record_purchase_draft', input }] }), { status: 200 })
}

function harness({
  env = {}, remaining = 2, budget = true, provider = async () => toolAnswer({ readable: true, items: [] }),
} = {}) {
  const rpcs = []
  const requests = []
  const client = {
    rpc: async (name, args) => {
      rpcs.push({ name, args })
      if (name === 'consume_auth_rate_limit') return { data: true, error: null }
      if (name === 'reserve_invoice_scan') return { data: remaining, error: null }
      if (name === 'release_invoice_scan') return { data: null, error: null }
      if (name === 'consume_external_usage_budget') return { data: budget, error: null }
      throw new Error(`unexpected rpc ${name}`)
    },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: MATERIALS, error: null }) }
      return chain
    },
  }
  const values = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', SCAN_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key', ...env }
  const context = vm.createContext({
    createClient: () => client, Deno: { env: { get: key => values[key] }, serve: () => {} },
    fetch: async (url, init) => { requests.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) }); return provider() },
    crypto: require('node:crypto').webcrypto, Response, Request, URL, Headers, TextEncoder, TextDecoder, AbortSignal,
    console: { error: () => {}, warn: () => {} }, setTimeout, clearTimeout, atob, btoa,
  })
  vm.runInContext(js, context)
  const scan = (body = { imageBase64: IMAGE }) => context.handleInvoiceScan(
    new Request('https://test/purchases/scan', { method: 'POST', body: JSON.stringify(body) }),
    { sub: 'user_1', businessId: 'biz_1' },
  )
  return { scan, rpcs, requests, names: () => rpcs.map(r => r.name) }
}

test('scanning stays off until it is enabled and keyed', async () => {
  for (const env of [{ SCAN_ENABLED: 'false' }, { ANTHROPIC_API_KEY: '' }]) {
    const h = harness({ env })
    assert.equal((await h.scan()).status, 501)
    assert.equal(h.requests.length, 0)
  }
})

test('a readable invoice comes back as a sanitized draft that matches known materials', async () => {
  const h = harness({
    provider: async () => toolAnswer({
      readable: true,
      supplierName: '  مؤسسة   التموين\n',
      date: '2026-11-10',
      total: 57.5,
      items: [
        { name: 'طحين فاخر', materialId: 'mat_flour', unit: 'PIECE', quantity: 10, unitPrice: 3.5, confidence: 0.94 },
        { name: 'سكر', materialId: 'mat_from_another_business', unit: 'KG', quantity: 5, unitPrice: 4.5, confidence: 1.7 },
        { name: 'كرتون', unit: 'BOX', quantity: 2, unitPrice: 1.5, confidence: 0.4 },
        { name: 'سطر بلا سعر', unit: 'KG', quantity: 1, unitPrice: 0, confidence: 0.9 },
        { name: '', unit: 'KG', quantity: 1, unitPrice: 2, confidence: 0.9 },
      ],
    }),
  })
  const response = await h.scan()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  const draft = await response.json()
  assert.equal(draft.supplierName, 'مؤسسة التموين')
  assert.equal(draft.date, '2026-11-10')
  assert.equal(draft.total, 57.5)
  assert.equal(draft.provider, 'anthropic')
  assert.equal(draft.remaining, 2)
  assert.deepEqual(draft.items, [
    { materialId: 'mat_flour', name: 'طحين فاخر', unit: 'KG', quantity: 10, unitPrice: 3.5, confidence: 0.94 },
    { name: 'سكر', unit: 'KG', quantity: 5, unitPrice: 4.5, confidence: 1 },
    { name: 'كرتون', unit: 'PIECE', quantity: 2, unitPrice: 1.5, confidence: 0.4 },
  ])
  assert.deepEqual(h.names(), ['consume_auth_rate_limit', 'reserve_invoice_scan', 'consume_external_usage_budget'])
  assert.match(h.rpcs[1].args.p_period, /^\d{4}-\d{2}$/)
  assert.equal(h.rpcs[1].args.p_business_id, 'biz_1')
})

test('the provider receives the image and material names, and nothing about the account', async () => {
  const h = harness({ provider: async () => toolAnswer({ readable: true, items: [{ name: 'بيض', unit: 'PIECE', quantity: 30, unitPrice: 0.5, confidence: 0.9 }] }) })
  await h.scan()
  assert.equal(h.requests.length, 1)
  const { url, headers, body } = h.requests[0]
  assert.equal(url, 'https://api.anthropic.com/v1/messages')
  assert.equal(headers['x-api-key'], 'test-key')
  assert.deepEqual(body.tool_choice, { type: 'tool', name: 'record_purchase_draft' })
  const [image, text] = body.messages[0].content
  assert.equal(image.source.media_type, 'image/jpeg')
  assert.match(text.text, /mat_flour \| طحين \| KG/)
  assert.doesNotMatch(JSON.stringify(body), /user_1|biz_1/)
})

test('a used-up month refuses before calling the provider', async () => {
  const h = harness({ remaining: null })
  const response = await h.scan()
  assert.equal(response.status, 429)
  assert.equal((await response.json()).code, 'SCAN_QUOTA_EXCEEDED')
  assert.equal(h.requests.length, 0)
})

test('the shared daily cap refuses and gives the page back', async () => {
  const h = harness({ budget: false })
  assert.equal((await h.scan()).status, 503)
  assert.equal(h.requests.length, 0)
  assert.ok(h.names().includes('release_invoice_scan'))
})

test('a provider failure gives the page back', async () => {
  for (const provider of [async () => new Response('{}', { status: 529 }), async () => { throw new Error('timeout') }]) {
    const h = harness({ provider })
    const response = await h.scan()
    assert.equal(response.status, 502)
    assert.equal((await response.json()).code, 'SCAN_FAILED')
    assert.equal(h.names().at(-1), 'release_invoice_scan')
  }
})

test('an unreadable photo is reported and still counts', async () => {
  for (const input of [{ readable: false, items: [] }, { readable: true, items: [{ name: 'x', unit: 'KG', quantity: -1, unitPrice: 2, confidence: 1 }] }]) {
    const h = harness({ provider: async () => toolAnswer(input) })
    const response = await h.scan()
    assert.equal(response.status, 422)
    assert.equal((await response.json()).code, 'SCAN_UNREADABLE')
    assert.ok(!h.names().includes('release_invoice_scan'))
  }
})

test('bad images never reserve a page', async () => {
  const bad = [
    {}, { imageBase64: 42 }, { imageBase64: 'https://example.com/a.jpg' },
    { imageBase64: IMAGE.replace('image/jpeg', 'image/gif') },
    { imageBase64: 'data:image/png;base64,AAAA' },
    { imageBase64: `${IMAGE}<script>` },
  ]
  for (const body of bad) {
    const h = harness()
    const response = await h.scan(body)
    assert.equal(response.status, 400)
    assert.ok(!h.names().includes('reserve_invoice_scan'))
  }
})

test('dates that are not plausible Gregorian invoice dates are dropped', async () => {
  for (const date of ['1447-05-10', '2026-02-30', '2099-01-01', '10/11/2026']) {
    const h = harness({ provider: async () => toolAnswer({ readable: true, date, items: [{ name: 'بيض', unit: 'PIECE', quantity: 1, unitPrice: 1, confidence: 1 }] }) })
    const draft = await (await h.scan()).json()
    assert.equal(draft.date, undefined, date)
  }
})
