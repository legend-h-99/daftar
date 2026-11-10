// All network calls are intercepted; this never creates production records.
import { chromium } from 'playwright';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(process.env.QA_STATIC_DIR || '.next-first-expense');
const origin = 'https://daftar1.com';
const output = path.resolve('../../outputs/activation-review-2026-10-16');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
 for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('daftar_session', '1'));
  const events = [], errors = []; let expenses = 0;
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/plain', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  await context.route('**/*', async route => {
   const req = route.request(), url = new URL(req.url());
   if (url.origin !== origin) return route.fulfill({ status: 204 });
   if (url.pathname === '/api-proxy/analytics/events') { events.push(JSON.parse(req.postData())); return route.fulfill({ status: 204 }); }
   if (url.pathname === '/api-proxy/onboarding') return route.fulfill({ json: { sessionAuthenticated: true, business: { id: 'fixture', name: 'متجر التجربة' } } });
   if (url.pathname === '/api-proxy/expenses' && req.method() === 'POST') { expenses++; return route.fulfill({ status: 201, json: { id: 'fixture-expense' } }); }
   if (url.pathname === '/api-proxy/auth/me') return route.fulfill({ json: { user: { id: 'fixture', businessId: 'fixture' }, business: { id: 'fixture', name: 'متجر التجربة' } } });
   if (url.pathname.startsWith('/api-proxy/')) return route.fulfill({ status: 503, json: { message: 'Fixture outside tested flow' } });
   try {
    let file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) throw new Error('Outside root');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: await readFile(file) });
   } catch { return route.fulfill({ status: 404 }); }
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/onboarding/', { waitUntil: 'networkidle' });
  await page.getByLabel('اسم المحل').fill('متجر التجربة');
  await page.getByRole('button', { name: 'التالي', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ والمتابعة' }).click();
  const cta = page.getByRole('button', { name: 'سجّل أول مصروف', exact: true }); await cta.waitFor();
  await page.screenshot({ path: path.join(output, `first-expense-${width}.png`) });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await cta.click(); await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.getByText('أدخل مبلغًا أكبر من صفر').waitFor(); assert.equal(expenses, 0);
  await page.getByLabel('المبلغ', { exact: true }).fill('25.50');
  await page.screenshot({ path: path.join(output, `first-expense-form-${width}.png`) });
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.waitForURL(url => /\/dashboard\/?$/.test(url.pathname));
  await page.waitForLoadState('networkidle');
  assert.equal(expenses, 1);
  for (const event of ['first_expense_prompt_viewed', 'first_expense_prompt_clicked', 'first_expense_completed']) assert.equal(events.filter(e => e.event === event).length, 1);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, `browser-${width}.json`), JSON.stringify({ width, expenses, events: events.map(e => e.event), errors }, null, 2));
  await context.close();
 }
 console.log('Mobile and desktop onboarding → first expense → dashboard passed; no production requests.');
} finally { await browser.close(); }
