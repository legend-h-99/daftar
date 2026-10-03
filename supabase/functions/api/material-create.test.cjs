const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = createRequire(require('node:path').resolve(__dirname, '../../../apps/web/package.json'))('typescript')

const source = fs.readFileSync(process.env.MATERIAL_API_SOURCE || `${__dirname}/index.ts`, 'utf8')
  .replace(/^import .*$/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

function harness(error = null) {
  const calls = []
  const client = { rpc: async (name, args) => {
    calls.push({ name, args })
    return { data: { id: args.p_material_id, stockQty: args.p_body.initialQty ?? 0, unitPrice: args.p_body.purchasePrice / args.p_body.purchaseQty }, error }
  } }
  const context = vm.createContext({
    createClient: () => client, Deno: { env: { get: () => 'test' }, serve: () => {} },
    crypto: require('node:crypto').webcrypto, Response, Request, URL, TextEncoder, TextDecoder,
    console: { error: () => {} }, setTimeout, clearTimeout, atob, btoa,
  })
  vm.runInContext(js, context)
  return { calls, post: body => context.handleCrud(new Request('https://test/materials', {
    method: 'POST', body: JSON.stringify(body),
  }), { businessId: 'test-business' }, 'Material') }
}

const screenshot = { name: ' تيشيرت ', unit: 'PIECE', purchasePrice: 720, purchaseQty: 60, initialQty: 60, vatRate: 0, reorderLevel: 10 }

test('inventory form reaches atomic creation with opening stock and cost', async () => {
  const h = harness()
  const response = await h.post(screenshot)
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { id: h.calls[0].args.p_material_id, stockQty: 60, unitPrice: 12 })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].name, 'create_material_with_opening_balance')
  assert.equal(h.calls[0].args.p_business_id, 'test-business')
  assert.equal(h.calls[0].args.p_body.name, 'تيشيرت')
})

test('zero opening stock and omitted optional fields remain valid', async () => {
  const h = harness()
  assert.equal((await h.post({ name: 'صنف', unit: 'KG', purchasePrice: 0, purchaseQty: 1 })).status, 201)
})

test('invalid quantities, units and protected fields never reach the database', async () => {
  for (const patch of [{ purchaseQty: 0 }, { initialQty: -1 }, { unit: 'INVALID' }, { vatRate: 101 }, { name: ' ' }, { stockQty: 60 }, { businessId: 'other' }, { reorderLevel: -1 }]) {
    const h = harness()
    assert.equal((await h.post({ ...screenshot, ...patch })).status, 400)
    assert.equal(h.calls.length, 0)
  }
})

test('database failure gives an Arabic error without internal details', async () => {
  const h = harness({ code: '23502', message: 'private database detail' })
  const response = await h.post(screenshot)
  assert.equal(response.status, 500)
  const body = await response.text()
  assert.match(body, /تعذر حفظ الصنف/)
  assert.doesNotMatch(body, /private database detail/)
})
