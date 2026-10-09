/** Published plan proposal. Billing and quota enforcement are not enabled yet. */
export const PRICING_PLANS = [
  { id: "free", name: "البداية", monthly: 0, annual: 0, invoices: 10, products: 5, ocrPages: 3 },
  { id: "basic", name: "أساسي", monthly: 29, annual: 290, invoices: 100, products: 30, ocrPages: 10 },
  { id: "growth", name: "نمو", monthly: 49, annual: 490, invoices: 300, products: 100, ocrPages: 30 },
] as const;
export const OCR_TOP_UP = { pages: 50, price: 19, validityMonths: 12 } as const;
