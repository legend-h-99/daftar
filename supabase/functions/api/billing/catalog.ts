/** Server-owned prices in halalas. Never accept an amount from the browser. */
export const BILLING_PRODUCTS = {
  basic_monthly: { amount: 2900, kind: 'subscription', plan: 'basic', months: 1, ocrPages: 10 },
  basic_annual: { amount: 29000, kind: 'subscription', plan: 'basic', months: 12, ocrPages: 10 },
  growth_monthly: { amount: 4900, kind: 'subscription', plan: 'growth', months: 1, ocrPages: 30 },
  growth_annual: { amount: 49000, kind: 'subscription', plan: 'growth', months: 12, ocrPages: 30 },
  ocr_50: { amount: 1900, kind: 'credit', plan: null, months: 12, ocrPages: 50 },
} as const;

export type BillingSku = keyof typeof BILLING_PRODUCTS;

export function checkoutQuote(sku: unknown, taxRate: 0 | 15) {
  if (typeof sku !== 'string' || !Object.prototype.hasOwnProperty.call(BILLING_PRODUCTS, sku)) {
    throw new Error('Invalid billing product');
  }
  if (taxRate !== 0 && taxRate !== 15) throw new Error('Tax configuration required');
  const product = BILLING_PRODUCTS[sku as BillingSku];
  const tax = Math.round(product.amount * taxRate / 100);
  return { sku: sku as BillingSku, currency: 'SAR' as const, subtotal: product.amount, tax, amount: product.amount + tax };
}

export interface PendingOrder {
  id: string;
  amount: number;
  currency: 'SAR';
  providerPaymentId: string;
  mode: 'test' | 'live';
}

/** Input must be retrieved and normalized by the chosen provider adapter,
 * never copied directly from a browser redirect or unauthenticated webhook. */
export interface RetrievedPayment {
  id: string;
  orderId: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  mode: 'test' | 'live';
}

export function paymentMatchesOrder(order: PendingOrder, payment: RetrievedPayment): boolean {
  return Number.isSafeInteger(order.amount) && order.amount > 0 &&
    payment.status === 'paid' && payment.id === order.providerPaymentId &&
    payment.orderId === order.id && payment.amount === order.amount &&
    payment.currency === order.currency && payment.mode === order.mode;
}
