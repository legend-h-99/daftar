import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(resolve(__dirname, '../../../../supabase/functions/api/billing/catalog.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {} as Record<string, any> };
runInNewContext(compiled, sandbox);
const { checkoutQuote, paymentMatchesOrder } = sandbox.exports;

describe('billing trust boundary', () => {
  it.each([['basic_monthly', 2900], ['basic_annual', 29000], ['growth_monthly', 4900], ['growth_annual', 49000], ['ocr_50', 1900]])('prices %s on the server', (sku, amount) => {
    expect(checkoutQuote(sku, 0)).toMatchObject({ amount, currency: 'SAR' });
  });
  it('adds configured VAT in integer halalas', () => {
    expect(checkoutQuote('basic_monthly', 15)).toMatchObject({ subtotal: 2900, tax: 435, amount: 3335 });
  });
  it.each(['free', '__proto__', 'constructor', { sku: 'basic_monthly', amount: 1 }])('rejects invalid products', sku => {
    expect(() => checkoutQuote(sku, 0)).toThrow();
  });
  const order = { id: 'order-1', amount: 2900, currency: 'SAR', providerPaymentId: 'payment-1', mode: 'test' };
  const paid = { id: 'payment-1', orderId: 'order-1', status: 'paid', amount: 2900, currency: 'SAR', mode: 'test' };
  it('accepts a paid transaction matching all order fields', () => {
    expect(paymentMatchesOrder(order, paid)).toBe(true);
  });
  it.each([{ amount: 1 }, { currency: 'USD' }, { status: 'pending' }, { status: 'failed' }, { status: 'refunded' }, { mode: 'live' }, { orderId: 'other-order' }, { id: 'other-payment' }])('rejects a mismatched transaction', patch => {
    expect(paymentMatchesOrder(order, { ...paid, ...patch })).toBe(false);
  });
});
