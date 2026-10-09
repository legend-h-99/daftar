// Integration checks against a disposable Supabase preview branch only.
// Seed two verified users named <run>-a/b@example.invalid in <run>-a/b businesses.
// Pass a mode-0600 seed JSON {run,password}; never use an existing user's account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const seed = JSON.parse(await fs.readFile(process.env.DAFTAR_QA_SEED_FILE, 'utf8'));
const base = process.env.DAFTAR_QA_API;
assert(base === 'https://ymbkhhsberlweckijuzm.supabase.co/functions/v1/api', 'Only the verified preview branch is allowed');
const results = [];
const timings = [];
async function call(path, { method = 'GET', body, token, expected = 200 } = {}) {
  const start = performance.now();
  const response = await fetch(base + path, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  const duration = Math.round(performance.now() - start);
  results.push({ method, path, status: response.status, expected, duration, passed: response.status === expected });
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
const close = (actual, expected) => assert(Math.abs(Number(actual) - expected) < 1e-6, `${actual} != ${expected}`);
try {
  const a = await call('/auth/email/login', { method: 'POST', body: { email: `${seed.run}-a@example.invalid`, password: seed.password } });
  const b = await call('/auth/email/login', { method: 'POST', body: { email: `${seed.run}-b@example.invalid`, password: seed.password } });
  const token = a.accessToken;
  const tokenB = b.accessToken;
  assert(token && tokenB);
  await fs.writeFile('/tmp/daftar-release-tokens.json', JSON.stringify({ a: token, b: tokenB }), { mode: 0o600 });
  await call('/customers', { expected: 401 });
  await call('/customers', { token: token + 'corrupt', expected: 401 });
  const customer = await call('/customers', { method: 'POST', token, body: { name: 'Release QA customer' }, expected: 201 });
  await call(`/customers/${customer.id}`, { token: tokenB, expected: 404 });
  await call(`/customers/${customer.id}`, { method: 'PATCH', token: tokenB, body: { name: 'Cross tenant' }, expected: 404 });
  await call(`/customers/${customer.id}`, { method: 'PATCH', token, body: { businessId: `${seed.run}-b` }, expected: 400 });
  const otherCustomers = await call('/customers', { token: tokenB });
  assert(!otherCustomers.some(c => c.id === customer.id));

  const purchase = await call('/purchases', { method: 'POST', token, expected: 201, body: {
    supplierName: 'Release QA supplier', date: '2026-10-02', items: [{ name: 'Release QA flour', unit: 'KG', quantity: 10, unitPrice: 10 }],
  } });
  close(purchase.total, 100);
  let materials = await call('/materials', { token });
  const flour = materials.find(m => m.name === 'Release QA flour');
  assert(flour); close(flour.stockQty, 10); close(flour.unitPrice, 10);
  await call('/purchases', { method: 'POST', token: tokenB, expected: 400, body: {
    items: [{ materialId: flour.id, name: flour.name, unit: 'KG', quantity: 1, unitPrice: 10 }],
  } });
  const product = await call('/products', { method: 'POST', token, expected: 201, body: {
    name: 'Release QA cake', profitMargin: 30, overheadCost: 0,
    recipeItems: [{ materialId: flour.id, name: flour.name, unit: 'KG', unitPrice: 10, quantityUsed: 0.2, type: 'RAW' }],
  } });
  close(product.totalCost, 2);
  const invoice = await call('/invoices', { method: 'POST', token, expected: 201, body: {
    customerId: customer.id, status: 'UNPAID', items: [{ productId: product.id, name: product.name, unitPrice: 15, quantity: 2 }],
  } });
  close(invoice.total, 30);
  materials = await call('/materials', { token });
  close(materials.find(m => m.id === flour.id).stockQty, 9.6);
  await call(`/invoices/${invoice.id}`, { token: tokenB, expected: 404 });
  await call('/invoices', { method: 'POST', token, expected: 409, body: {
    items: [{ productId: product.id, name: product.name, unitPrice: 15, quantity: 1000 }],
  } });
  close((await call('/materials', { token })).find(m => m.id === flour.id).stockQty, 9.6);
  assert.equal((await call('/invoices', { token })).length, 1, 'failed invoice must roll back');
  await call(`/invoices/${invoice.id}`, { method: 'PATCH', token, body: { status: 'PARTIAL', paidAmount: 10 } });
  let summary = await call('/dashboard/summary?month=2026-10', { token });
  close(summary.totalSales, 10); close(summary.unpaidInvoicesTotal, 20);
  await call(`/invoices/${invoice.id}`, { method: 'PATCH', token, body: { status: 'PARTIAL', paidAmount: 31 }, expected: 400 });
  await call(`/invoices/${invoice.id}`, { method: 'PATCH', token, body: { status: 'PAID' } });
  const expense = await call('/expenses', { method: 'POST', token, expected: 201, body: { category: 'OTHER', amount: 2, date: '2026-10-02', note: 'Release QA expense' } });
  await call('/expenses', { method: 'POST', token, expected: 400, body: { category: 'OTHER', amount: -1, date: '2026-10-02' } });
  await call(`/expenses/${expense.id}`, { token: tokenB, expected: 404 });
  summary = await call('/dashboard/summary?month=2026-10', { token });
  close(summary.totalSales, 30); close(summary.totalPurchases, 100);
  close(summary.costOfGoodsSold, 4); close(summary.operatingExpenses, 2); close(summary.netProfit, 24); close(summary.cashFlow, -72);
  close(summary.unpaidInvoicesTotal, 0);
  const summaryB = await call('/dashboard/summary?month=2026-10', { token: tokenB });
  close(summaryB.totalSales, 0); close(summaryB.totalPurchases, 0); close(summaryB.netProfit, 0);
  const moves = await call('/inventory/movements', { token });
  assert(moves.some(m => m.type === 'SALE' && Math.abs(m.qty + 0.4) < 1e-6));
  // A short bounded database-backed concurrency check, below the API's rate cap.
  await Promise.all(Array.from({ length: 5 }, async () => {
    const start = performance.now();
    await call('/dashboard/summary?month=2026-10', { token });
    timings.push(Math.round(performance.now() - start));
  }));
  const paidInvoice = await call('/invoices', { method: 'POST', token, expected: 201, body: {
    status: 'PAID', items: [{ name: 'Release QA paid service', unitPrice: 15, quantity: 2 }],
  } });
  close(paidInvoice.total, 30); close(paidInvoice.paidAmount, 30);
  summary = await call('/dashboard/summary?month=2026-10', { token });
  close(summary.totalSales, 60); close(summary.netProfit, 54); close(summary.cashFlow, -42);
  await call('/auth/logout', { method: 'POST', body: {}, token });
  await call('/customers', { token, expected: 401 });
  console.log(JSON.stringify({ passed: true, requests: results.length, concurrencySampleMs: timings }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await fs.writeFile(process.env.DAFTAR_QA_RESULT_FILE || '/tmp/daftar-release-stage.json', JSON.stringify({ results, timings, passed: !process.exitCode }, null, 2));
}
