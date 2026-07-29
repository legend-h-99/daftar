import {
  PrismaClient,
  RecipeItemType,
  Unit,
  InvoiceStatus,
  ExpenseCategory,
  PurchaseSource,
} from '@prisma/client';

const prisma = new PrismaClient();
const r2 = (n: number) => Math.round(n * 100) / 100;

function computeCosts(
  items: { unitPrice: number; quantityUsed: number; type: RecipeItemType }[],
  overheadCost: number,
  profitMargin: number,
) {
  const rawCost = items
    .filter((i) => i.type === RecipeItemType.RAW)
    .reduce((sum, i) => sum + i.unitPrice * i.quantityUsed, 0);
  const packagingCost = items
    .filter((i) => i.type === RecipeItemType.PACKAGING)
    .reduce((sum, i) => sum + i.unitPrice * i.quantityUsed, 0);
  const totalCost = rawCost + packagingCost + overheadCost;
  const sellingPrice =
    profitMargin >= 100 ? totalCost : totalCost / (1 - profitMargin / 100);
  return {
    rawCost: r2(rawCost),
    packagingCost: r2(packagingCost),
    totalCost: r2(totalCost),
    sellingPrice: r2(sellingPrice),
  };
}

type RI = { name: string; unit: Unit; unitPrice: number; quantityUsed: number; type: RecipeItemType };
type PI = { name: string; unit: Unit; quantity: number; unitPrice: number };
type II = { name: string; unitPrice: number; quantity: number };

async function clearBusiness(id: string) {
  await prisma.stockMovement.deleteMany({ where: { businessId: id } });
  await prisma.invoice.deleteMany({ where: { businessId: id } });
  await prisma.purchase.deleteMany({ where: { businessId: id } });
  await prisma.product.deleteMany({ where: { businessId: id } });
  await prisma.expense.deleteMany({ where: { businessId: id } });
  await prisma.customer.deleteMany({ where: { businessId: id } });
  await prisma.supplier.deleteMany({ where: { businessId: id } });
  await prisma.material.deleteMany({ where: { businessId: id } });
}

async function mkPurchases(
  bId: string,
  list: { num: number; supplierId: string | null; date: Date; items: PI[] }[],
) {
  for (const p of list) {
    const total = r2(p.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
    await prisma.purchase.create({
      data: {
        businessId: bId,
        number: p.num,
        supplierId: p.supplierId,
        date: p.date,
        total,
        source: PurchaseSource.MANUAL,
        items: {
          create: p.items.map((i) => ({
            name: i.name,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: r2(i.quantity * i.unitPrice),
          })),
        },
      },
    });
  }
}

async function mkInvoices(
  bId: string,
  list: {
    num: number;
    custId: string;
    date: Date;
    dueDate?: Date;
    status: InvoiceStatus;
    paid?: number;
    items: II[];
  }[],
) {
  for (const inv of list) {
    const lineTotals = inv.items.map((i) => r2(i.unitPrice * i.quantity));
    const subtotal = r2(lineTotals.reduce((s, v) => s + v, 0));
    await prisma.invoice.create({
      data: {
        businessId: bId,
        customerId: inv.custId,
        number: inv.num,
        issueDate: inv.date,
        ...(inv.dueDate ? { dueDate: inv.dueDate } : {}),
        status: inv.status,
        subtotal,
        vatAmount: 0,
        total: subtotal,
        paidAmount: inv.paid ?? 0,
        items: {
          create: inv.items.map((i, idx) => ({
            name: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: lineTotals[idx],
          })),
        },
      },
    });
  }
}

async function mkExpenses(
  bId: string,
  list: { date: Date; category: ExpenseCategory; amount: number; note?: string }[],
) {
  await prisma.expense.createMany({
    data: list.map((e) => ({ businessId: bId, ...e })),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  // Business 1 — مطبخ أم سلطان (unchanged: just recreate products)
  // ═══════════════════════════════════════════════════════════════════════════
  const ownerPhone = '+966500000001';
  const b1 = await prisma.business.upsert({
    where: { ownerPhone },
    update: {},
    create: {
      name: 'مطبخ أم سلطان',
      ownerPhone,
      vatEnabled: true,
      vatNumber: '300000000000003',
      city: 'الرياض',
    },
  });
  await prisma.user.upsert({
    where: { phone: ownerPhone },
    update: { businessId: b1.id },
    create: { phone: ownerPhone, name: 'أم سلطان', businessId: b1.id },
  });
  await clearBusiness(b1.id);

  type SeedRecipeItem = {
    name: string; unit: Unit; unitPrice: number; quantityUsed: number; type: RecipeItemType;
  };
  type SeedProduct = {
    name: string; category: string; profitMargin: number; overheadCost: number; items: SeedRecipeItem[];
  };

  const kabsaItems: SeedRecipeItem[] = [
    { name: 'دجاج', unit: Unit.PIECE, unitPrice: 10, quantityUsed: 1, type: RecipeItemType.RAW },
    { name: 'أرز', unit: Unit.KG, unitPrice: 4, quantityUsed: 0.6, type: RecipeItemType.RAW },
    { name: 'بهارات الكبسة', unit: Unit.KG, unitPrice: 20, quantityUsed: 0.004, type: RecipeItemType.RAW },
    { name: 'زيت', unit: Unit.LITER, unitPrice: 8, quantityUsed: 0.025, type: RecipeItemType.RAW },
    { name: 'بصل', unit: Unit.KG, unitPrice: 5.2, quantityUsed: 0.05, type: RecipeItemType.RAW },
    { name: 'طماطم', unit: Unit.KG, unitPrice: 7.8, quantityUsed: 0.08, type: RecipeItemType.RAW },
    { name: 'تغليف/صحن', unit: Unit.PIECE, unitPrice: 1, quantityUsed: 1, type: RecipeItemType.PACKAGING },
    { name: 'ملاعق بلاستيك', unit: Unit.PIECE, unitPrice: 0.04, quantityUsed: 2, type: RecipeItemType.PACKAGING },
  ];
  const cinnabonItems: SeedRecipeItem[] = [
    { name: 'طحين', unit: Unit.KG, unitPrice: 2.5, quantityUsed: 2.5, type: RecipeItemType.RAW },
    { name: 'حليب بودرة', unit: Unit.KG, unitPrice: 30, quantityUsed: 0.025, type: RecipeItemType.RAW },
    { name: 'زيت', unit: Unit.KG, unitPrice: 20, quantityUsed: 0.02, type: RecipeItemType.RAW },
    { name: 'سكر', unit: Unit.KG, unitPrice: 6, quantityUsed: 0.6, type: RecipeItemType.RAW },
    { name: 'بيكينج باودر', unit: Unit.KG, unitPrice: 60, quantityUsed: 0.006, type: RecipeItemType.RAW },
    { name: 'خميرة فورية', unit: Unit.KG, unitPrice: 30, quantityUsed: 0.002, type: RecipeItemType.RAW },
    { name: 'زبدة', unit: Unit.KG, unitPrice: 28, quantityUsed: 0.2, type: RecipeItemType.RAW },
    { name: 'قرفة ناعمة', unit: Unit.KG, unitPrice: 88, quantityUsed: 0.003, type: RecipeItemType.RAW },
  ];
  const b1Products: SeedProduct[] = [
    { name: 'كبسة دجاج', category: 'أطباق رئيسية', profitMargin: 45, overheadCost: 0, items: kabsaItems },
    { name: 'سينابون', category: 'حلويات', profitMargin: 60, overheadCost: 0, items: cinnabonItems },
  ];
  for (const p of b1Products) {
    const costs = computeCosts(p.items, p.overheadCost, p.profitMargin);
    await prisma.product.create({
      data: {
        businessId: b1.id,
        name: p.name,
        category: p.category,
        overheadCost: p.overheadCost,
        profitMargin: p.profitMargin,
        ...costs,
        recipeItems: {
          create: p.items.map((i) => ({
            name: i.name,
            unit: i.unit,
            unitPrice: i.unitPrice,
            quantityUsed: i.quantityUsed,
            lineCost: r2(i.unitPrice * i.quantityUsed),
            type: i.type,
          })),
        },
      },
    });
  }

  // --- B1 suppliers / materials / customers ---
  const [s1a, s1b] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b1.id, name: 'محل الفرحان للمواد الغذائية', phone: '0504567890' } }),
    prisma.supplier.create({ data: { businessId: b1.id, name: 'مزرعة الطائر الذهبي', phone: '0514567890' } }),
  ]);

  await prisma.material.createMany({
    data: [
      { businessId: b1.id, name: 'دجاج', unit: Unit.PIECE, purchasePrice: 8, purchaseQty: 10, unitPrice: 16, vatRate: 0, stockQty: 5, reorderLevel: 3 },
      { businessId: b1.id, name: 'أرز', unit: Unit.KG, purchasePrice: 3.5, purchaseQty: 5, unitPrice: 7, vatRate: 0, stockQty: 4 },
      { businessId: b1.id, name: 'بهارات الكبسة', unit: Unit.KG, purchasePrice: 18, purchaseQty: 0.5, unitPrice: 38, vatRate: 0, stockQty: 0.3 },
      { businessId: b1.id, name: 'زيت', unit: Unit.LITER, purchasePrice: 7, purchaseQty: 2, unitPrice: 14, vatRate: 15, stockQty: 1.5 },
      { businessId: b1.id, name: 'بصل', unit: Unit.KG, purchasePrice: 4, purchaseQty: 2, unitPrice: 8, vatRate: 0, stockQty: 1.2 },
      { businessId: b1.id, name: 'طماطم', unit: Unit.KG, purchasePrice: 6, purchaseQty: 2, unitPrice: 12, vatRate: 0, stockQty: 0.8 },
      { businessId: b1.id, name: 'طحين', unit: Unit.KG, purchasePrice: 2.5, purchaseQty: 5, unitPrice: 5, vatRate: 0, stockQty: 3.5 },
      { businessId: b1.id, name: 'سكر', unit: Unit.KG, purchasePrice: 5.5, purchaseQty: 2, unitPrice: 11, vatRate: 0, stockQty: 1.8 },
      { businessId: b1.id, name: 'زبدة', unit: Unit.KG, purchasePrice: 25, purchaseQty: 1, unitPrice: 50, vatRate: 0, stockQty: 0.5 },
      { businessId: b1.id, name: 'علب تغليف', unit: Unit.PIECE, purchasePrice: 0.5, purchaseQty: 50, unitPrice: 1, vatRate: 0, stockQty: 35 },
    ],
  });

  const [c1a, c1b, c1c, c1d] = await Promise.all([
    prisma.customer.create({ data: { businessId: b1.id, name: 'شركة الوليد للمناسبات', phone: '0504567891' } }),
    prisma.customer.create({ data: { businessId: b1.id, name: 'روضة أطفال الحياة', phone: '0514567891' } }),
    prisma.customer.create({ data: { businessId: b1.id, name: 'أم فيصل العتيبي', phone: '0524567891' } }),
    prisma.customer.create({ data: { businessId: b1.id, name: 'مطبخ الديوانية', phone: '0534567891' } }),
  ]);

  await mkPurchases(b1.id, [
    // July 2026 — إجمالي: 214 ر.س
    { num: 1, supplierId: s1a.id, date: new Date('2026-07-05'), items: [
      { name: 'دجاج', unit: Unit.PIECE, quantity: 10, unitPrice: 8 },
      { name: 'أرز', unit: Unit.KG, quantity: 5, unitPrice: 3.5 },
      { name: 'بصل', unit: Unit.KG, quantity: 2, unitPrice: 4 },
      { name: 'طماطم', unit: Unit.KG, quantity: 2, unitPrice: 6 },
      { name: 'بهارات الكبسة', unit: Unit.KG, quantity: 0.5, unitPrice: 18 },
    ]},
    { num: 2, supplierId: s1b.id, date: new Date('2026-07-12'), items: [
      { name: 'طحين', unit: Unit.KG, quantity: 5, unitPrice: 2.5 },
      { name: 'سكر', unit: Unit.KG, quantity: 2, unitPrice: 5.5 },
      { name: 'زبدة', unit: Unit.KG, quantity: 1, unitPrice: 25 },
      { name: 'زيت', unit: Unit.LITER, quantity: 2, unitPrice: 7 },
      { name: 'علب تغليف', unit: Unit.PIECE, quantity: 50, unitPrice: 0.5 },
    ]},
    // June 2026 — إجمالي: 139 ر.س
    { num: 3, supplierId: s1a.id, date: new Date('2026-06-04'), items: [
      { name: 'دجاج', unit: Unit.PIECE, quantity: 8, unitPrice: 8 },
      { name: 'أرز', unit: Unit.KG, quantity: 4, unitPrice: 3.5 },
      { name: 'بصل', unit: Unit.KG, quantity: 1.5, unitPrice: 4 },
      { name: 'طماطم', unit: Unit.KG, quantity: 1.5, unitPrice: 6 },
    ]},
    { num: 4, supplierId: s1b.id, date: new Date('2026-06-15'), items: [
      { name: 'طحين', unit: Unit.KG, quantity: 4, unitPrice: 2.5 },
      { name: 'سكر', unit: Unit.KG, quantity: 1.5, unitPrice: 5.5 },
      { name: 'زبدة', unit: Unit.KG, quantity: 0.5, unitPrice: 25 },
      { name: 'علب تغليف', unit: Unit.PIECE, quantity: 30, unitPrice: 0.5 },
    ]},
    // May 2026 — إجمالي: 131 ر.س
    { num: 5, supplierId: s1a.id, date: new Date('2026-05-06'), items: [
      { name: 'دجاج', unit: Unit.PIECE, quantity: 8, unitPrice: 8 },
      { name: 'أرز', unit: Unit.KG, quantity: 4, unitPrice: 3.5 },
      { name: 'طماطم', unit: Unit.KG, quantity: 2, unitPrice: 6 },
      { name: 'بهارات الكبسة', unit: Unit.KG, quantity: 0.3, unitPrice: 18 },
    ]},
    { num: 6, supplierId: s1b.id, date: new Date('2026-05-18'), items: [
      { name: 'طحين', unit: Unit.KG, quantity: 3, unitPrice: 2.5 },
      { name: 'سكر', unit: Unit.KG, quantity: 1, unitPrice: 5.5 },
      { name: 'زبدة', unit: Unit.KG, quantity: 0.5, unitPrice: 25 },
      { name: 'علب تغليف', unit: Unit.PIECE, quantity: 20, unitPrice: 0.5 },
    ]},
  ]);

  await mkInvoices(b1.id, [
    // July 2026 — مبيعات: 995 | مشتريات: 214 | مصاريف: 1,130 → خسارة −349
    { num: 1, custId: c1a.id, date: new Date('2026-07-04'), status: InvoiceStatus.PAID, paid: 350, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 10 }] },
    { num: 2, custId: c1b.id, date: new Date('2026-07-10'), status: InvoiceStatus.PAID, paid: 275, items: [{ name: 'سينابون', unitPrice: 55, quantity: 5 }] },
    { num: 3, custId: c1c.id, date: new Date('2026-07-17'), dueDate: new Date('2026-07-31'), status: InvoiceStatus.PARTIAL, paid: 120, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 6 }] },
    { num: 4, custId: c1d.id, date: new Date('2026-07-23'), dueDate: new Date('2026-08-08'), status: InvoiceStatus.UNPAID, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 3 }, { name: 'سينابون', unitPrice: 55, quantity: 1 }] },
    // June 2026 — مبيعات: 840 | مشتريات: 139 | مصاريف: 950 → خسارة −249
    { num: 5, custId: c1a.id, date: new Date('2026-06-06'), status: InvoiceStatus.PAID, paid: 280, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 8 }] },
    { num: 6, custId: c1b.id, date: new Date('2026-06-13'), status: InvoiceStatus.PAID, paid: 220, items: [{ name: 'سينابون', unitPrice: 55, quantity: 4 }] },
    { num: 7, custId: c1c.id, date: new Date('2026-06-19'), status: InvoiceStatus.PAID, paid: 175, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 5 }] },
    { num: 8, custId: c1d.id, date: new Date('2026-06-25'), status: InvoiceStatus.PAID, paid: 165, items: [{ name: 'سينابون', unitPrice: 55, quantity: 3 }] },
    // May 2026 — مبيعات: 730 | مشتريات: 131 | مصاريف: 1,025 → خسارة −426
    { num: 9, custId: c1a.id, date: new Date('2026-05-08'), status: InvoiceStatus.PAID, paid: 210, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 6 }] },
    { num: 10, custId: c1c.id, date: new Date('2026-05-15'), status: InvoiceStatus.PAID, paid: 140, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 4 }] },
    { num: 11, custId: c1b.id, date: new Date('2026-05-22'), status: InvoiceStatus.PAID, paid: 165, items: [{ name: 'سينابون', unitPrice: 55, quantity: 3 }] },
    { num: 12, custId: c1d.id, date: new Date('2026-05-28'), status: InvoiceStatus.PAID, paid: 215, items: [{ name: 'كبسة دجاج', unitPrice: 35, quantity: 3 }, { name: 'سينابون', unitPrice: 55, quantity: 2 }] },
  ]);

  await mkExpenses(b1.id, [
    // July — إجمالي: 1,130 ر.س
    { date: new Date('2026-07-01'), category: ExpenseCategory.RENT, amount: 600, note: 'إيجار المطبخ — الرياض' },
    { date: new Date('2026-07-06'), category: ExpenseCategory.UTILITIES, amount: 180, note: 'فاتورة الكهرباء والغاز' },
    { date: new Date('2026-07-12'), category: ExpenseCategory.PACKAGING, amount: 100, note: 'مستلزمات تغليف' },
    { date: new Date('2026-07-20'), category: ExpenseCategory.DELIVERY, amount: 120, note: 'توصيل طلبيات' },
    { date: new Date('2026-07-25'), category: ExpenseCategory.OTHER, amount: 130, note: 'مستلزمات متنوعة' },
    // June — إجمالي: 950 ر.س
    { date: new Date('2026-06-01'), category: ExpenseCategory.RENT, amount: 600 },
    { date: new Date('2026-06-05'), category: ExpenseCategory.UTILITIES, amount: 170 },
    { date: new Date('2026-06-18'), category: ExpenseCategory.PACKAGING, amount: 80 },
    { date: new Date('2026-06-22'), category: ExpenseCategory.DELIVERY, amount: 100 },
    // May — إجمالي: 1,025 ر.س
    { date: new Date('2026-05-01'), category: ExpenseCategory.RENT, amount: 600 },
    { date: new Date('2026-05-08'), category: ExpenseCategory.UTILITIES, amount: 165 },
    { date: new Date('2026-05-15'), category: ExpenseCategory.MARKETING, amount: 200, note: 'إعلانات تويتر وسناب' },
    { date: new Date('2026-05-20'), category: ExpenseCategory.PACKAGING, amount: 60 },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 2 — مخبزة بيت الخبز — جدة — +966500000002
  // ═══════════════════════════════════════════════════════════════════════════
  const phone2 = '+966500000002';
  const b2 = await prisma.business.upsert({
    where: { ownerPhone: phone2 },
    update: {},
    create: { name: 'مخبزة بيت الخبز', ownerPhone: phone2, vatEnabled: false, city: 'جدة' },
  });
  await prisma.user.upsert({
    where: { phone: phone2 },
    update: { businessId: b2.id },
    create: { phone: phone2, name: 'أم إبراهيم', businessId: b2.id },
  });
  await clearBusiness(b2.id);

  const [s2a, s2b] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b2.id, name: 'مصنع الدقيق الذهبي', phone: '0551234567' } }),
    prisma.supplier.create({ data: { businessId: b2.id, name: 'محل أبو محمود للألبان والبيض', phone: '0561234567' } }),
  ]);

  await prisma.material.createMany({
    data: [
      { businessId: b2.id, name: 'دقيق أبيض', unit: Unit.KG, purchasePrice: 2.2, purchaseQty: 25, unitPrice: 4.5, vatRate: 0, stockQty: 22, reorderLevel: 5 },
      { businessId: b2.id, name: 'سكر أبيض', unit: Unit.KG, purchasePrice: 3.5, purchaseQty: 10, unitPrice: 7, vatRate: 0, stockQty: 8, reorderLevel: 2 },
      { businessId: b2.id, name: 'خميرة فورية', unit: Unit.KG, purchasePrice: 28, purchaseQty: 1, unitPrice: 55, vatRate: 0, stockQty: 0.7, reorderLevel: 0.2 },
      { businessId: b2.id, name: 'زيت نباتي', unit: Unit.LITER, purchasePrice: 6.5, purchaseQty: 5, unitPrice: 13, vatRate: 15, stockQty: 4 },
      { businessId: b2.id, name: 'بيض بلدي', unit: Unit.PIECE, purchasePrice: 0.55, purchaseQty: 60, unitPrice: 1.1, vatRate: 0, stockQty: 45, reorderLevel: 10 },
      { businessId: b2.id, name: 'علب تغليف ورقية', unit: Unit.PIECE, purchasePrice: 0.5, purchaseQty: 100, unitPrice: 1, vatRate: 0, stockQty: 85 },
    ],
  });

  const timisRI: RI[] = [
    { name: 'دقيق أبيض', unit: Unit.KG, unitPrice: 4.5, quantityUsed: 0.5, type: RecipeItemType.RAW },
    { name: 'سكر أبيض', unit: Unit.KG, unitPrice: 7, quantityUsed: 0.03, type: RecipeItemType.RAW },
    { name: 'خميرة فورية', unit: Unit.KG, unitPrice: 55, quantityUsed: 0.005, type: RecipeItemType.RAW },
    { name: 'زيت نباتي', unit: Unit.LITER, unitPrice: 13, quantityUsed: 0.04, type: RecipeItemType.RAW },
    { name: 'علبة تغليف', unit: Unit.PIECE, unitPrice: 1, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const tamrRI: RI[] = [
    { name: 'دقيق أبيض', unit: Unit.KG, unitPrice: 4.5, quantityUsed: 0.3, type: RecipeItemType.RAW },
    { name: 'سكر أبيض', unit: Unit.KG, unitPrice: 7, quantityUsed: 0.15, type: RecipeItemType.RAW },
    { name: 'بيض بلدي', unit: Unit.PIECE, unitPrice: 1.1, quantityUsed: 3, type: RecipeItemType.RAW },
    { name: 'زيت نباتي', unit: Unit.LITER, unitPrice: 13, quantityUsed: 0.08, type: RecipeItemType.RAW },
    { name: 'علبة كرتون', unit: Unit.PIECE, unitPrice: 1.5, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [timisRI, 'خبز التميس', 'خبز', 50, 0],
    [tamrRI, 'كيكة التمر', 'حلويات', 55, 2],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b2.id,
        name, category: cat,
        overheadCost: overhead,
        profitMargin: margin,
        ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }

  const [c2a, c2b, c2c, c2d] = await Promise.all([
    prisma.customer.create({ data: { businessId: b2.id, name: 'روضة الأطفال الوردية' } }),
    prisma.customer.create({ data: { businessId: b2.id, name: 'سوبرماركت الحي', phone: '0571234567' } }),
    prisma.customer.create({ data: { businessId: b2.id, name: 'أم عبدالله الغامدية', phone: '0501234567' } }),
    prisma.customer.create({ data: { businessId: b2.id, name: 'مطعم الفيصل', phone: '0581234567' } }),
  ]);

  await mkPurchases(b2.id, [
    // July 2026
    { num: 1, supplierId: s2a.id, date: new Date('2026-07-03'), items: [{ name: 'دقيق أبيض', unit: Unit.KG, quantity: 25, unitPrice: 2.2 }, { name: 'سكر أبيض', unit: Unit.KG, quantity: 10, unitPrice: 3.5 }] },
    { num: 2, supplierId: s2b.id, date: new Date('2026-07-08'), items: [{ name: 'بيض بلدي', unit: Unit.PIECE, quantity: 60, unitPrice: 0.55 }, { name: 'خميرة فورية', unit: Unit.KG, quantity: 1, unitPrice: 28 }] },
    { num: 3, supplierId: null, date: new Date('2026-07-12'), items: [{ name: 'زيت نباتي', unit: Unit.LITER, quantity: 5, unitPrice: 6.5 }, { name: 'علب تغليف ورقية', unit: Unit.PIECE, quantity: 100, unitPrice: 0.5 }] },
    // June 2026
    { num: 4, supplierId: s2a.id, date: new Date('2026-06-04'), items: [{ name: 'دقيق أبيض', unit: Unit.KG, quantity: 20, unitPrice: 2.2 }, { name: 'سكر أبيض', unit: Unit.KG, quantity: 8, unitPrice: 3.5 }] },
    { num: 5, supplierId: s2b.id, date: new Date('2026-06-12'), items: [{ name: 'بيض بلدي', unit: Unit.PIECE, quantity: 50, unitPrice: 0.55 }] },
    { num: 6, supplierId: null, date: new Date('2026-06-18'), items: [{ name: 'خميرة فورية', unit: Unit.KG, quantity: 1, unitPrice: 28 }, { name: 'زيت نباتي', unit: Unit.LITER, quantity: 4, unitPrice: 6.5 }] },
    // May 2026
    { num: 7, supplierId: s2a.id, date: new Date('2026-05-06'), items: [{ name: 'دقيق أبيض', unit: Unit.KG, quantity: 30, unitPrice: 2.2 }, { name: 'سكر أبيض', unit: Unit.KG, quantity: 12, unitPrice: 3.5 }] },
    { num: 8, supplierId: s2b.id, date: new Date('2026-05-15'), items: [{ name: 'بيض بلدي', unit: Unit.PIECE, quantity: 80, unitPrice: 0.55 }, { name: 'خميرة فورية', unit: Unit.KG, quantity: 0.5, unitPrice: 28 }] },
  ]);

  await mkInvoices(b2.id, [
    // July 2026 — مبيعات: 1,015 ر.س | مشتريات: 233.5 | مصاريف: 530 → ربح +251.5
    { num: 1, custId: c2a.id, date: new Date('2026-07-05'), status: InvoiceStatus.PAID, paid: 60, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 30 }] },
    { num: 2, custId: c2b.id, date: new Date('2026-07-10'), dueDate: new Date('2026-07-25'), status: InvoiceStatus.UNPAID, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 60 }, { name: 'كيكة التمر', unitPrice: 35, quantity: 8 }] },
    { num: 3, custId: c2c.id, date: new Date('2026-07-12'), status: InvoiceStatus.PAID, paid: 140, items: [{ name: 'كيكة التمر', unitPrice: 35, quantity: 4 }] },
    { num: 4, custId: c2d.id, date: new Date('2026-07-18'), dueDate: new Date('2026-07-30'), status: InvoiceStatus.PARTIAL, paid: 120, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 120 }] },
    { num: 5, custId: c2b.id, date: new Date('2026-07-22'), status: InvoiceStatus.PAID, paid: 175, items: [{ name: 'كيكة التمر', unitPrice: 35, quantity: 5 }] },
    // June 2026 — مبيعات: 590 | مشتريات: 153.5 | مصاريف: 485 → ربح −48.5
    { num: 6, custId: c2a.id, date: new Date('2026-06-07'), status: InvoiceStatus.PAID, paid: 50, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 25 }] },
    { num: 7, custId: c2b.id, date: new Date('2026-06-14'), status: InvoiceStatus.PAID, paid: 275, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 50 }, { name: 'كيكة التمر', unitPrice: 35, quantity: 5 }] },
    { num: 8, custId: c2d.id, date: new Date('2026-06-20'), status: InvoiceStatus.PAID, paid: 160, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 80 }] },
    { num: 9, custId: c2c.id, date: new Date('2026-06-25'), status: InvoiceStatus.PAID, paid: 105, items: [{ name: 'كيكة التمر', unitPrice: 35, quantity: 3 }] },
    // May 2026 — مبيعات: 530 | مشتريات: 194 | مصاريف: 568 → خسارة −232
    { num: 10, custId: c2a.id, date: new Date('2026-05-10'), status: InvoiceStatus.PAID, paid: 40, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 20 }] },
    { num: 11, custId: c2b.id, date: new Date('2026-05-18'), status: InvoiceStatus.PAID, paid: 290, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 40 }, { name: 'كيكة التمر', unitPrice: 35, quantity: 6 }] },
    { num: 12, custId: c2d.id, date: new Date('2026-05-22'), status: InvoiceStatus.PAID, paid: 200, items: [{ name: 'خبز التميس', unitPrice: 2, quantity: 100 }] },
  ]);

  await mkExpenses(b2.id, [
    // July
    { date: new Date('2026-07-01'), category: ExpenseCategory.RENT, amount: 300, note: 'إيجار المطبخ المشترك' },
    { date: new Date('2026-07-06'), category: ExpenseCategory.UTILITIES, amount: 125, note: 'فاتورة الكهرباء' },
    { date: new Date('2026-07-10'), category: ExpenseCategory.PACKAGING, amount: 60, note: 'علب تغليف إضافية' },
    { date: new Date('2026-07-18'), category: ExpenseCategory.DELIVERY, amount: 45, note: 'توصيل طلبيات' },
    // June
    { date: new Date('2026-06-01'), category: ExpenseCategory.RENT, amount: 300 },
    { date: new Date('2026-06-05'), category: ExpenseCategory.UTILITIES, amount: 110 },
    { date: new Date('2026-06-12'), category: ExpenseCategory.PACKAGING, amount: 75 },
    // May
    { date: new Date('2026-05-01'), category: ExpenseCategory.RENT, amount: 300 },
    { date: new Date('2026-05-06'), category: ExpenseCategory.UTILITIES, amount: 118 },
    { date: new Date('2026-05-15'), category: ExpenseCategory.MARKETING, amount: 150, note: 'إعلانات واتساب' },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 3 — حلويات أم يوسف — مكة المكرمة — +966500000003
  // ═══════════════════════════════════════════════════════════════════════════
  const phone3 = '+966500000003';
  const b3 = await prisma.business.upsert({
    where: { ownerPhone: phone3 },
    update: {},
    create: { name: 'حلويات أم يوسف', ownerPhone: phone3, vatEnabled: false, city: 'مكة المكرمة' },
  });
  await prisma.user.upsert({
    where: { phone: phone3 },
    update: { businessId: b3.id },
    create: { phone: phone3, name: 'أم يوسف', businessId: b3.id },
  });
  await clearBusiness(b3.id);

  const [s3a, s3b] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b3.id, name: 'مزرعة الرحمة للتمور', phone: '0552345678' } }),
    prisma.supplier.create({ data: { businessId: b3.id, name: 'الشركة الذهبية للمواد الغذائية', phone: '0562345678' } }),
  ]);

  await prisma.material.createMany({
    data: [
      { businessId: b3.id, name: 'تمر مجدول', unit: Unit.KG, purchasePrice: 35, purchaseQty: 10, unitPrice: 75, vatRate: 0, stockQty: 6, reorderLevel: 2 },
      { businessId: b3.id, name: 'شوكولاتة داكنة', unit: Unit.KG, purchasePrice: 22, purchaseQty: 5, unitPrice: 45, vatRate: 0, stockQty: 3, reorderLevel: 1 },
      { businessId: b3.id, name: 'قشطة ثقيلة', unit: Unit.LITER, purchasePrice: 8, purchaseQty: 3, unitPrice: 18, vatRate: 0, stockQty: 2 },
      { businessId: b3.id, name: 'أكواب تغليف صغيرة', unit: Unit.PIECE, purchasePrice: 0.3, purchaseQty: 200, unitPrice: 0.8, vatRate: 0, stockQty: 165, reorderLevel: 50 },
      { businessId: b3.id, name: 'أكياس هدايا', unit: Unit.PIECE, purchasePrice: 1.5, purchaseQty: 50, unitPrice: 4, vatRate: 0, stockQty: 38 },
    ],
  });

  const chocDateRI: RI[] = [
    { name: 'تمر مجدول', unit: Unit.KG, unitPrice: 75, quantityUsed: 0.25, type: RecipeItemType.RAW },
    { name: 'شوكولاتة داكنة', unit: Unit.KG, unitPrice: 45, quantityUsed: 0.1, type: RecipeItemType.RAW },
    { name: 'كوب تغليف', unit: Unit.PIECE, unitPrice: 0.8, quantityUsed: 12, type: RecipeItemType.PACKAGING },
    { name: 'كيس هدية', unit: Unit.PIECE, unitPrice: 4, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const qishtaRI: RI[] = [
    { name: 'تمر مجدول', unit: Unit.KG, unitPrice: 75, quantityUsed: 0.15, type: RecipeItemType.RAW },
    { name: 'قشطة ثقيلة', unit: Unit.LITER, unitPrice: 18, quantityUsed: 0.1, type: RecipeItemType.RAW },
    { name: 'كوب تغليف', unit: Unit.PIECE, unitPrice: 0.8, quantityUsed: 8, type: RecipeItemType.PACKAGING },
    { name: 'كيس هدية', unit: Unit.PIECE, unitPrice: 4, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [chocDateRI, 'تمر بالشوكولاتة (12 حبة)', 'حلويات تمر', 60, 0],
    [qishtaRI, 'قشطة التمر (8 حبات)', 'حلويات تمر', 55, 0],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b3.id,
        name, category: cat,
        overheadCost: overhead,
        profitMargin: margin,
        ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }

  const [c3a, c3b, c3c, c3d] = await Promise.all([
    prisma.customer.create({ data: { businessId: b3.id, name: 'متجر هدايا العيد', phone: '0572345678' } }),
    prisma.customer.create({ data: { businessId: b3.id, name: 'أم محمد الهاشمية', phone: '0502345678' } }),
    prisma.customer.create({ data: { businessId: b3.id, name: 'مدرسة الأمانة الأهلية', phone: '0582345678' } }),
    prisma.customer.create({ data: { businessId: b3.id, name: 'فاطمة العمري', phone: '0512345678' } }),
  ]);

  await mkPurchases(b3.id, [
    // July 2026
    { num: 1, supplierId: s3a.id, date: new Date('2026-07-02'), items: [{ name: 'تمر مجدول', unit: Unit.KG, quantity: 10, unitPrice: 35 }, { name: 'قشطة ثقيلة', unit: Unit.LITER, quantity: 3, unitPrice: 8 }] },
    { num: 2, supplierId: s3b.id, date: new Date('2026-07-08'), items: [{ name: 'شوكولاتة داكنة', unit: Unit.KG, quantity: 5, unitPrice: 22 }, { name: 'أكواب تغليف صغيرة', unit: Unit.PIECE, quantity: 200, unitPrice: 0.3 }, { name: 'أكياس هدايا', unit: Unit.PIECE, quantity: 50, unitPrice: 1.5 }] },
    // June 2026
    { num: 3, supplierId: s3a.id, date: new Date('2026-06-03'), items: [{ name: 'تمر مجدول', unit: Unit.KG, quantity: 8, unitPrice: 35 }] },
    { num: 4, supplierId: s3b.id, date: new Date('2026-06-10'), items: [{ name: 'شوكولاتة داكنة', unit: Unit.KG, quantity: 4, unitPrice: 22 }, { name: 'أكواب تغليف صغيرة', unit: Unit.PIECE, quantity: 150, unitPrice: 0.3 }] },
    // May 2026
    { num: 5, supplierId: s3a.id, date: new Date('2026-05-05'), items: [{ name: 'تمر مجدول', unit: Unit.KG, quantity: 6, unitPrice: 35 }] },
    { num: 6, supplierId: s3b.id, date: new Date('2026-05-15'), items: [{ name: 'شوكولاتة داكنة', unit: Unit.KG, quantity: 3, unitPrice: 22 }, { name: 'أكواب تغليف صغيرة', unit: Unit.PIECE, quantity: 100, unitPrice: 0.3 }] },
  ]);

  await mkInvoices(b3.id, [
    // July 2026 — مبيعات: 4,585 | مشتريات: 619 | مصاريف: 2,435 → ربح +1,531
    { num: 1, custId: c3a.id, date: new Date('2026-07-04'), status: InvoiceStatus.PAID, paid: 1900, items: [{ name: 'تمر بالشوكولاتة', unitPrice: 95, quantity: 20 }] },
    { num: 2, custId: c3b.id, date: new Date('2026-07-09'), status: InvoiceStatus.PAID, paid: 640, items: [{ name: 'تمر بالشوكولاتة', unitPrice: 95, quantity: 5 }, { name: 'قشطة التمر', unitPrice: 55, quantity: 3 }] },
    { num: 3, custId: c3c.id, date: new Date('2026-07-14'), dueDate: new Date('2026-08-01'), status: InvoiceStatus.UNPAID, items: [{ name: 'قشطة التمر', unitPrice: 55, quantity: 30 }] },
    { num: 4, custId: c3d.id, date: new Date('2026-07-20'), status: InvoiceStatus.PAID, paid: 395, items: [{ name: 'تمر بالشوكولاتة', unitPrice: 95, quantity: 3 }, { name: 'قشطة التمر', unitPrice: 55, quantity: 2 }] },
    // June 2026 — مبيعات: 2,965 | مشتريات: 325 | مصاريف: 2,280 → ربح +360
    { num: 5, custId: c3a.id, date: new Date('2026-06-06'), status: InvoiceStatus.PAID, paid: 1425, items: [{ name: 'تمر بالشوكولاتة', unitPrice: 95, quantity: 15 }] },
    { num: 6, custId: c3b.id, date: new Date('2026-06-13'), status: InvoiceStatus.PAID, paid: 440, items: [{ name: 'قشطة التمر', unitPrice: 55, quantity: 8 }] },
    { num: 7, custId: c3c.id, date: new Date('2026-06-22'), status: InvoiceStatus.PAID, paid: 1100, items: [{ name: 'قشطة التمر', unitPrice: 55, quantity: 20 }] },
    // May 2026 — مبيعات: 2,240 | مشتريات: 276 | مصاريف: 2,200 → خسارة −236
    { num: 8, custId: c3a.id, date: new Date('2026-05-08'), status: InvoiceStatus.PAID, paid: 1140, items: [{ name: 'تمر بالشوكولاتة', unitPrice: 95, quantity: 12 }] },
    { num: 9, custId: c3d.id, date: new Date('2026-05-16'), status: InvoiceStatus.PAID, paid: 275, items: [{ name: 'قشطة التمر', unitPrice: 55, quantity: 5 }] },
    { num: 10, custId: c3c.id, date: new Date('2026-05-25'), status: InvoiceStatus.PAID, paid: 825, items: [{ name: 'قشطة التمر', unitPrice: 55, quantity: 15 }] },
  ]);

  await mkExpenses(b3.id, [
    // July
    { date: new Date('2026-07-01'), category: ExpenseCategory.RENT, amount: 500, note: 'إيجار المطبخ' },
    { date: new Date('2026-07-01'), category: ExpenseCategory.SALARIES, amount: 1500, note: 'أجر المساعدة' },
    { date: new Date('2026-07-10'), category: ExpenseCategory.MARKETING, amount: 350, note: 'إعلانات إنستغرام' },
    { date: new Date('2026-07-18'), category: ExpenseCategory.DELIVERY, amount: 85, note: 'توصيل الطلبيات' },
    // June
    { date: new Date('2026-06-01'), category: ExpenseCategory.RENT, amount: 500 },
    { date: new Date('2026-06-01'), category: ExpenseCategory.SALARIES, amount: 1500 },
    { date: new Date('2026-06-12'), category: ExpenseCategory.MARKETING, amount: 280, note: 'إعلانات إنستغرام' },
    // May
    { date: new Date('2026-05-01'), category: ExpenseCategory.RENT, amount: 500 },
    { date: new Date('2026-05-01'), category: ExpenseCategory.SALARIES, amount: 1500 },
    { date: new Date('2026-05-20'), category: ExpenseCategory.MARKETING, amount: 200 },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 4 — ورشة العود والبخور — الدمام — +966500000004
  // ═══════════════════════════════════════════════════════════════════════════
  const phone4 = '+966500000004';
  const b4 = await prisma.business.upsert({
    where: { ownerPhone: phone4 },
    update: {},
    create: { name: 'ورشة العود والبخور', ownerPhone: phone4, vatEnabled: true, vatNumber: '310000000000001', city: 'الدمام' },
  });
  await prisma.user.upsert({
    where: { phone: phone4 },
    update: { businessId: b4.id },
    create: { phone: phone4, name: 'أبو سعود العطار', businessId: b4.id },
  });
  await clearBusiness(b4.id);

  const [s4a, s4b] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b4.id, name: 'تاجر الراشد للعطور والأعواد', phone: '0553456789' } }),
    prisma.supplier.create({ data: { businessId: b4.id, name: 'مؤسسة الجوهرة للتعبئة والتغليف', phone: '0563456789' } }),
  ]);

  await prisma.material.createMany({
    data: [
      { businessId: b4.id, name: 'عود هندي', unit: Unit.GRAM, purchasePrice: 1.2, purchaseQty: 100, unitPrice: 2.5, vatRate: 15, stockQty: 45, reorderLevel: 20 },
      { businessId: b4.id, name: 'مسك أبيض', unit: Unit.GRAM, purchasePrice: 2, purchaseQty: 50, unitPrice: 4.5, vatRate: 15, stockQty: 20 },
      { businessId: b4.id, name: 'عنبر طبيعي', unit: Unit.GRAM, purchasePrice: 3.5, purchaseQty: 30, unitPrice: 8, vatRate: 15, stockQty: 10, reorderLevel: 5 },
      { businessId: b4.id, name: 'قوارير زجاج 10ml', unit: Unit.PIECE, purchasePrice: 4, purchaseQty: 20, unitPrice: 10, vatRate: 15, stockQty: 8 },
      { businessId: b4.id, name: 'قوارير زجاج 30ml', unit: Unit.PIECE, purchasePrice: 10, purchaseQty: 10, unitPrice: 25, vatRate: 15, stockQty: 3 },
      { businessId: b4.id, name: 'صناديق هدايا فاخرة', unit: Unit.PIECE, purchasePrice: 8, purchaseQty: 15, unitPrice: 20, vatRate: 15, stockQty: 7 },
    ],
  });

  const oudRI: RI[] = [
    { name: 'عود هندي', unit: Unit.GRAM, unitPrice: 1.2, quantityUsed: 3, type: RecipeItemType.RAW },
    { name: 'مسك أبيض', unit: Unit.GRAM, unitPrice: 2, quantityUsed: 2, type: RecipeItemType.RAW },
    { name: 'قارورة زجاج 10ml', unit: Unit.PIECE, unitPrice: 4, quantityUsed: 1, type: RecipeItemType.PACKAGING },
    { name: 'صندوق هدية', unit: Unit.PIECE, unitPrice: 8, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const muskRI: RI[] = [
    { name: 'مسك أبيض', unit: Unit.GRAM, unitPrice: 2, quantityUsed: 5, type: RecipeItemType.RAW },
    { name: 'عنبر طبيعي', unit: Unit.GRAM, unitPrice: 3.5, quantityUsed: 3, type: RecipeItemType.RAW },
    { name: 'قارورة زجاج 30ml', unit: Unit.PIECE, unitPrice: 10, quantityUsed: 1, type: RecipeItemType.PACKAGING },
    { name: 'صندوق هدية', unit: Unit.PIECE, unitPrice: 8, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [oudRI, 'دهن العود الخالص 10ml', 'دهون عطرية', 78, 5],
    [muskRI, 'تركيبة المسك والعنبر 30ml', 'تركيبات فاخرة', 75, 8],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b4.id,
        name, category: cat,
        overheadCost: overhead,
        profitMargin: margin,
        ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }

  const [c4a, c4b, c4c, c4d] = await Promise.all([
    prisma.customer.create({ data: { businessId: b4.id, name: 'خلود القحطاني', phone: '0503456789' } }),
    prisma.customer.create({ data: { businessId: b4.id, name: 'ميرة العمري', phone: '0513456789' } }),
    prisma.customer.create({ data: { businessId: b4.id, name: 'متجر هدية الوفاء', phone: '0573456789' } }),
    prisma.customer.create({ data: { businessId: b4.id, name: 'طلبية زواج يوليو', phone: '0583456789' } }),
  ]);

  await mkPurchases(b4.id, [
    // July 2026
    { num: 1, supplierId: s4a.id, date: new Date('2026-07-05'), items: [{ name: 'عود هندي', unit: Unit.GRAM, quantity: 100, unitPrice: 1.2 }, { name: 'مسك أبيض', unit: Unit.GRAM, quantity: 50, unitPrice: 2 }, { name: 'عنبر طبيعي', unit: Unit.GRAM, quantity: 30, unitPrice: 3.5 }] },
    { num: 2, supplierId: s4b.id, date: new Date('2026-07-10'), items: [{ name: 'قوارير زجاج 10ml', unit: Unit.PIECE, quantity: 20, unitPrice: 4 }, { name: 'قوارير زجاج 30ml', unit: Unit.PIECE, quantity: 10, unitPrice: 10 }, { name: 'صناديق هدايا فاخرة', unit: Unit.PIECE, quantity: 15, unitPrice: 8 }] },
    // June 2026
    { num: 3, supplierId: s4a.id, date: new Date('2026-06-08'), items: [{ name: 'عود هندي', unit: Unit.GRAM, quantity: 80, unitPrice: 1.2 }, { name: 'مسك أبيض', unit: Unit.GRAM, quantity: 40, unitPrice: 2 }] },
    { num: 4, supplierId: s4b.id, date: new Date('2026-06-15'), items: [{ name: 'قوارير زجاج 10ml', unit: Unit.PIECE, quantity: 15, unitPrice: 4 }, { name: 'قوارير زجاج 30ml', unit: Unit.PIECE, quantity: 8, unitPrice: 10 }] },
    // May 2026
    { num: 5, supplierId: s4a.id, date: new Date('2026-05-10'), items: [{ name: 'عود هندي', unit: Unit.GRAM, quantity: 60, unitPrice: 1.2 }, { name: 'عنبر طبيعي', unit: Unit.GRAM, quantity: 20, unitPrice: 3.5 }] },
    { num: 6, supplierId: s4b.id, date: new Date('2026-05-20'), items: [{ name: 'صناديق هدايا فاخرة', unit: Unit.PIECE, quantity: 10, unitPrice: 8 }] },
  ]);

  await mkInvoices(b4.id, [
    // July 2026 — مبيعات: 4,095 | مشتريات: 625 | مصاريف: 1,410 → ربح +2,060
    { num: 1, custId: c4a.id, date: new Date('2026-07-06'), status: InvoiceStatus.PAID, paid: 360, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 3 }] },
    { num: 2, custId: c4b.id, date: new Date('2026-07-11'), status: InvoiceStatus.PAID, paid: 390, items: [{ name: 'تركيبة المسك والعنبر 30ml', unitPrice: 195, quantity: 2 }] },
    { num: 3, custId: c4c.id, date: new Date('2026-07-15'), dueDate: new Date('2026-07-31'), status: InvoiceStatus.PARTIAL, paid: 800, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 8 }, { name: 'تركيبة المسك والعنبر 30ml', unitPrice: 195, quantity: 3 }] },
    { num: 4, custId: c4d.id, date: new Date('2026-07-22'), dueDate: new Date('2026-08-05'), status: InvoiceStatus.UNPAID, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 15 }] },
    // June 2026 — مبيعات: 1,545 | مشتريات: 316 | مصاريف: 1,275 → خسارة −46
    { num: 5, custId: c4a.id, date: new Date('2026-06-10'), status: InvoiceStatus.PAID, paid: 240, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 2 }] },
    { num: 6, custId: c4c.id, date: new Date('2026-06-18'), status: InvoiceStatus.PAID, paid: 1110, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 6 }, { name: 'تركيبة المسك والعنبر 30ml', unitPrice: 195, quantity: 2 }] },
    { num: 7, custId: c4b.id, date: new Date('2026-06-25'), status: InvoiceStatus.PAID, paid: 195, items: [{ name: 'تركيبة المسك والعنبر 30ml', unitPrice: 195, quantity: 1 }] },
    // May 2026 — مبيعات: 2,580 | مشتريات: 222 | مصاريف: 1,100 → ربح +1,258
    { num: 8, custId: c4c.id, date: new Date('2026-05-12'), status: InvoiceStatus.PAID, paid: 600, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 5 }] },
    { num: 9, custId: c4d.id, date: new Date('2026-05-22'), status: InvoiceStatus.PAID, paid: 1980, items: [{ name: 'دهن العود الخالص 10ml', unitPrice: 120, quantity: 10 }, { name: 'تركيبة المسك والعنبر 30ml', unitPrice: 195, quantity: 4 }] },
  ]);

  await mkExpenses(b4.id, [
    // July
    { date: new Date('2026-07-01'), category: ExpenseCategory.RENT, amount: 800, note: 'إيجار الورشة' },
    { date: new Date('2026-07-05'), category: ExpenseCategory.MARKETING, amount: 400, note: 'إعلانات سناب وإنستغرام' },
    { date: new Date('2026-07-15'), category: ExpenseCategory.DELIVERY, amount: 120, note: 'توصيل الطلبيات' },
    { date: new Date('2026-07-20'), category: ExpenseCategory.OTHER, amount: 90, note: 'مستلزمات متنوعة' },
    // June
    { date: new Date('2026-06-01'), category: ExpenseCategory.RENT, amount: 800 },
    { date: new Date('2026-06-08'), category: ExpenseCategory.MARKETING, amount: 380 },
    { date: new Date('2026-06-20'), category: ExpenseCategory.DELIVERY, amount: 95 },
    // May
    { date: new Date('2026-05-01'), category: ExpenseCategory.RENT, amount: 800 },
    { date: new Date('2026-05-10'), category: ExpenseCategory.MARKETING, amount: 300 },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 5 — خياطة الأناقة (خياطة منزلية فردية) — الرياض — +966500000005
  // مبيعات صغيرة · النتيجة: ربح بسيط
  // ═══════════════════════════════════════════════════════════════════════════
  const phone5 = '+966500000005';
  const b5 = await prisma.business.upsert({
    where: { ownerPhone: phone5 },
    update: {},
    create: { name: 'خياطة الأناقة', ownerPhone: phone5, vatEnabled: false, city: 'الرياض' },
  });
  await prisma.user.upsert({
    where: { phone: phone5 },
    update: { businessId: b5.id },
    create: { phone: phone5, name: 'أم ريان', businessId: b5.id },
  });
  await clearBusiness(b5.id);
  const [s5a] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b5.id, name: 'محل الأقمشة والخيوط', phone: '0552345678' } }),
  ]);
  await prisma.material.createMany({
    data: [
      { businessId: b5.id, name: 'قماش عباية (متر)', unit: Unit.PIECE, purchasePrice: 18, purchaseQty: 10, unitPrice: 35, vatRate: 0, stockQty: 6, reorderLevel: 3 },
      { businessId: b5.id, name: 'خيط بوليستر', unit: Unit.PIECE, purchasePrice: 2, purchaseQty: 20, unitPrice: 5, vatRate: 0, stockQty: 12 },
      { businessId: b5.id, name: 'كيس تغليف عباية', unit: Unit.PIECE, purchasePrice: 1, purchaseQty: 30, unitPrice: 2, vatRate: 0, stockQty: 18 },
    ],
  });
  const abayaRI: RI[] = [
    { name: 'قماش عباية (متر)', unit: Unit.PIECE, unitPrice: 35, quantityUsed: 3, type: RecipeItemType.RAW },
    { name: 'خيط بوليستر', unit: Unit.PIECE, unitPrice: 5, quantityUsed: 0.2, type: RecipeItemType.RAW },
    { name: 'كيس تغليف عباية', unit: Unit.PIECE, unitPrice: 2, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const tannoraRI: RI[] = [
    { name: 'قماش عباية (متر)', unit: Unit.PIECE, unitPrice: 35, quantityUsed: 1.5, type: RecipeItemType.RAW },
    { name: 'خيط بوليستر', unit: Unit.PIECE, unitPrice: 5, quantityUsed: 0.15, type: RecipeItemType.RAW },
    { name: 'كيس تغليف عباية', unit: Unit.PIECE, unitPrice: 2, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [abayaRI, 'عباية تفصيل', 'خياطة', 45, 25],
    [tannoraRI, 'تنورة تفصيل', 'خياطة', 45, 15],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b5.id, name, category: cat, overheadCost: overhead, profitMargin: margin, ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }
  const [c5a, c5b, c5c] = await Promise.all([
    prisma.customer.create({ data: { businessId: b5.id, name: 'نورة السبيعي', phone: '0502345678' } }),
    prisma.customer.create({ data: { businessId: b5.id, name: 'هيا الدوسري', phone: '0512345678' } }),
    prisma.customer.create({ data: { businessId: b5.id, name: 'ريم القرني', phone: '0532345678' } }),
  ]);
  await mkPurchases(b5.id, [
    { num: 1, supplierId: s5a.id, date: new Date('2026-07-05'), items: [{ name: 'قماش عباية (متر)', unit: Unit.PIECE, quantity: 6, unitPrice: 18 }, { name: 'خيط بوليستر', unit: Unit.PIECE, quantity: 10, unitPrice: 2 }] },
    { num: 2, supplierId: s5a.id, date: new Date('2026-06-06'), items: [{ name: 'قماش عباية (متر)', unit: Unit.PIECE, quantity: 4, unitPrice: 18 }] },
  ]);
  await mkInvoices(b5.id, [
    // July — مدفوع 480 · مشتريات 128 · مصاريف 125 → ربح +227
    { num: 1, custId: c5a.id, date: new Date('2026-07-08'), status: InvoiceStatus.PAID, paid: 360, items: [{ name: 'عباية تفصيل', unitPrice: 180, quantity: 2 }] },
    { num: 2, custId: c5b.id, date: new Date('2026-07-16'), status: InvoiceStatus.PAID, paid: 120, items: [{ name: 'تنورة تفصيل', unitPrice: 120, quantity: 1 }] },
    { num: 3, custId: c5c.id, date: new Date('2026-07-22'), dueDate: new Date('2026-08-05'), status: InvoiceStatus.UNPAID, items: [{ name: 'عباية تفصيل', unitPrice: 180, quantity: 1 }] },
    // June — مدفوع 360
    { num: 4, custId: c5a.id, date: new Date('2026-06-12'), status: InvoiceStatus.PAID, paid: 360, items: [{ name: 'عباية تفصيل', unitPrice: 180, quantity: 2 }] },
  ]);
  await mkExpenses(b5.id, [
    { date: new Date('2026-07-03'), category: ExpenseCategory.MARKETING, amount: 60, note: 'إعلان انستقرام' },
    { date: new Date('2026-07-12'), category: ExpenseCategory.DELIVERY, amount: 40, note: 'توصيل الطلبات' },
    { date: new Date('2026-07-20'), category: ExpenseCategory.PACKAGING, amount: 25, note: 'أكياس تغليف' },
    { date: new Date('2026-06-05'), category: ExpenseCategory.MARKETING, amount: 50 },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 6 — صابون الطبيعة (صناعة صابون منزلية) — بريدة — +966500000006
  // مبيعات صغيرة · النتيجة: تقريبًا تعادل
  // ═══════════════════════════════════════════════════════════════════════════
  const phone6 = '+966500000006';
  const b6 = await prisma.business.upsert({
    where: { ownerPhone: phone6 },
    update: {},
    create: { name: 'صابون الطبيعة', ownerPhone: phone6, vatEnabled: false, city: 'بريدة' },
  });
  await prisma.user.upsert({
    where: { phone: phone6 },
    update: { businessId: b6.id },
    create: { phone: phone6, name: 'أم لؤي', businessId: b6.id },
  });
  await clearBusiness(b6.id);
  const [s6a] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b6.id, name: 'مورد الزيوت الطبيعية', phone: '0553456789' } }),
  ]);
  await prisma.material.createMany({
    data: [
      { businessId: b6.id, name: 'زيت زيتون', unit: Unit.LITER, purchasePrice: 22, purchaseQty: 3, unitPrice: 40, vatRate: 0, stockQty: 2, reorderLevel: 1 },
      { businessId: b6.id, name: 'صودا كاوية', unit: Unit.KG, purchasePrice: 12, purchaseQty: 2, unitPrice: 24, vatRate: 0, stockQty: 1 },
      { businessId: b6.id, name: 'زيت لافندر عطري', unit: Unit.ML, purchasePrice: 0.4, purchaseQty: 100, unitPrice: 1, vatRate: 0, stockQty: 55 },
      { businessId: b6.id, name: 'علبة كرتون للصابون', unit: Unit.PIECE, purchasePrice: 0.8, purchaseQty: 60, unitPrice: 2, vatRate: 0, stockQty: 30 },
    ],
  });
  const soapRI: RI[] = [
    { name: 'زيت زيتون', unit: Unit.LITER, unitPrice: 40, quantityUsed: 0.1, type: RecipeItemType.RAW },
    { name: 'صودا كاوية', unit: Unit.KG, unitPrice: 24, quantityUsed: 0.02, type: RecipeItemType.RAW },
    { name: 'زيت لافندر عطري', unit: Unit.ML, unitPrice: 1, quantityUsed: 3, type: RecipeItemType.RAW },
    { name: 'علبة كرتون للصابون', unit: Unit.PIECE, unitPrice: 2, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const scrubRI: RI[] = [
    { name: 'زيت زيتون', unit: Unit.LITER, unitPrice: 40, quantityUsed: 0.06, type: RecipeItemType.RAW },
    { name: 'صودا كاوية', unit: Unit.KG, unitPrice: 24, quantityUsed: 0.015, type: RecipeItemType.RAW },
    { name: 'علبة كرتون للصابون', unit: Unit.PIECE, unitPrice: 2, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [soapRI, 'صابونة اللافندر', 'عناية', 55, 1],
    [scrubRI, 'مقشّر القهوة', 'عناية', 60, 1.5],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b6.id, name, category: cat, overheadCost: overhead, profitMargin: margin, ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }
  const [c6a, c6b, c6c] = await Promise.all([
    prisma.customer.create({ data: { businessId: b6.id, name: 'ريم القحطاني', phone: '0503456780' } }),
    prisma.customer.create({ data: { businessId: b6.id, name: 'هند العلي', phone: '0513456780' } }),
    prisma.customer.create({ data: { businessId: b6.id, name: 'ركن عافية (بازار)', phone: '0523456780' } }),
  ]);
  await mkPurchases(b6.id, [
    { num: 1, supplierId: s6a.id, date: new Date('2026-07-06'), items: [{ name: 'زيت زيتون', unit: Unit.LITER, quantity: 3, unitPrice: 22 }, { name: 'صودا كاوية', unit: Unit.KG, quantity: 2, unitPrice: 12 }, { name: 'علبة كرتون للصابون', unit: Unit.PIECE, quantity: 40, unitPrice: 0.8 }] },
    { num: 2, supplierId: s6a.id, date: new Date('2026-06-08'), items: [{ name: 'زيت زيتون', unit: Unit.LITER, quantity: 2, unitPrice: 22 }] },
  ]);
  await mkInvoices(b6.id, [
    // July — مدفوع 336 · مشتريات 122 · مصاريف 220 → تعادل (−6)
    { num: 1, custId: c6a.id, date: new Date('2026-07-09'), status: InvoiceStatus.PAID, paid: 270, items: [{ name: 'صابونة اللافندر', unitPrice: 15, quantity: 18 }] },
    { num: 2, custId: c6b.id, date: new Date('2026-07-17'), status: InvoiceStatus.PAID, paid: 66, items: [{ name: 'مقشّر القهوة', unitPrice: 22, quantity: 3 }] },
    { num: 3, custId: c6c.id, date: new Date('2026-07-24'), dueDate: new Date('2026-08-08'), status: InvoiceStatus.UNPAID, items: [{ name: 'صابونة اللافندر', unitPrice: 15, quantity: 15 }] },
    // June — مدفوع 300
    { num: 4, custId: c6a.id, date: new Date('2026-06-14'), status: InvoiceStatus.PAID, paid: 300, items: [{ name: 'صابونة اللافندر', unitPrice: 15, quantity: 20 }] },
  ]);
  await mkExpenses(b6.id, [
    { date: new Date('2026-07-02'), category: ExpenseCategory.MARKETING, amount: 90, note: 'إعلان سناب' },
    { date: new Date('2026-07-14'), category: ExpenseCategory.DELIVERY, amount: 50, note: 'شحن للعملاء' },
    { date: new Date('2026-07-19'), category: ExpenseCategory.PACKAGING, amount: 40, note: 'ستيكرات وتغليف' },
    { date: new Date('2026-07-25'), category: ExpenseCategory.OTHER, amount: 40, note: 'مستلزمات متنوعة' },
    { date: new Date('2026-06-04'), category: ExpenseCategory.MARKETING, amount: 70 },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 7 — شموع ولمسات (صناعة شموع منزلية) — الخبر — +966500000007
  // مبيعات صغيرة · النتيجة: خسارة بسيطة (شراء مواد مقدّمًا)
  // ═══════════════════════════════════════════════════════════════════════════
  const phone7 = '+966500000007';
  const b7 = await prisma.business.upsert({
    where: { ownerPhone: phone7 },
    update: {},
    create: { name: 'شموع ولمسات', ownerPhone: phone7, vatEnabled: false, city: 'الخبر' },
  });
  await prisma.user.upsert({
    where: { phone: phone7 },
    update: { businessId: b7.id },
    create: { phone: phone7, name: 'أم تالا', businessId: b7.id },
  });
  await clearBusiness(b7.id);
  const [s7a] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b7.id, name: 'محل الشمع والعطور', phone: '0554567890' } }),
  ]);
  await prisma.material.createMany({
    data: [
      { businessId: b7.id, name: 'شمع صويا', unit: Unit.KG, purchasePrice: 18, purchaseQty: 5, unitPrice: 34, vatRate: 0, stockQty: 3, reorderLevel: 1 },
      { businessId: b7.id, name: 'عطر شمع فانيلا', unit: Unit.ML, purchasePrice: 0.5, purchaseQty: 100, unitPrice: 1.2, vatRate: 0, stockQty: 60 },
      { businessId: b7.id, name: 'فتائل قطنية', unit: Unit.PIECE, purchasePrice: 0.3, purchaseQty: 100, unitPrice: 1, vatRate: 0, stockQty: 70 },
      { businessId: b7.id, name: 'كوب زجاج للشمعة', unit: Unit.PIECE, purchasePrice: 3.5, purchaseQty: 30, unitPrice: 8, vatRate: 0, stockQty: 14, reorderLevel: 6 },
    ],
  });
  const bigCandleRI: RI[] = [
    { name: 'شمع صويا', unit: Unit.KG, unitPrice: 34, quantityUsed: 0.25, type: RecipeItemType.RAW },
    { name: 'عطر شمع فانيلا', unit: Unit.ML, unitPrice: 1.2, quantityUsed: 20, type: RecipeItemType.RAW },
    { name: 'فتائل قطنية', unit: Unit.PIECE, unitPrice: 1, quantityUsed: 1, type: RecipeItemType.RAW },
    { name: 'كوب زجاج للشمعة', unit: Unit.PIECE, unitPrice: 8, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const smallCandleRI: RI[] = [
    { name: 'شمع صويا', unit: Unit.KG, unitPrice: 34, quantityUsed: 0.12, type: RecipeItemType.RAW },
    { name: 'عطر شمع فانيلا', unit: Unit.ML, unitPrice: 1.2, quantityUsed: 10, type: RecipeItemType.RAW },
    { name: 'فتائل قطنية', unit: Unit.PIECE, unitPrice: 1, quantityUsed: 1, type: RecipeItemType.RAW },
    { name: 'كوب زجاج للشمعة', unit: Unit.PIECE, unitPrice: 8, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [bigCandleRI, 'شمعة الفانيلا الكبيرة', 'شموع', 50, 2],
    [smallCandleRI, 'شمعة العنبر الصغيرة', 'شموع', 45, 1.5],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b7.id, name, category: cat, overheadCost: overhead, profitMargin: margin, ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }
  const [c7a, c7b, c7c] = await Promise.all([
    prisma.customer.create({ data: { businessId: b7.id, name: 'أفنان العتيبي', phone: '0504567800' } }),
    prisma.customer.create({ data: { businessId: b7.id, name: 'ركن ديكوري (بازار)', phone: '0514567800' } }),
    prisma.customer.create({ data: { businessId: b7.id, name: 'سارة المطيري', phone: '0524567800' } }),
  ]);
  await mkPurchases(b7.id, [
    { num: 1, supplierId: s7a.id, date: new Date('2026-07-07'), items: [{ name: 'شمع صويا', unit: Unit.KG, quantity: 5, unitPrice: 18 }, { name: 'عطر شمع فانيلا', unit: Unit.ML, quantity: 100, unitPrice: 0.5 }, { name: 'كوب زجاج للشمعة', unit: Unit.PIECE, quantity: 30, unitPrice: 3.5 }] },
    { num: 2, supplierId: s7a.id, date: new Date('2026-06-10'), items: [{ name: 'شمع صويا', unit: Unit.KG, quantity: 3, unitPrice: 18 }] },
  ]);
  await mkInvoices(b7.id, [
    // July — مدفوع 264 · مشتريات 245 · مصاريف 130 → خسارة −111
    { num: 1, custId: c7a.id, date: new Date('2026-07-11'), status: InvoiceStatus.PAID, paid: 180, items: [{ name: 'شمعة الفانيلا الكبيرة', unitPrice: 45, quantity: 4 }] },
    { num: 2, custId: c7b.id, date: new Date('2026-07-18'), status: InvoiceStatus.PAID, paid: 84, items: [{ name: 'شمعة العنبر الصغيرة', unitPrice: 28, quantity: 3 }] },
    { num: 3, custId: c7c.id, date: new Date('2026-07-25'), dueDate: new Date('2026-08-09'), status: InvoiceStatus.UNPAID, items: [{ name: 'شمعة الفانيلا الكبيرة', unitPrice: 45, quantity: 3 }] },
    // June — مدفوع 225
    { num: 4, custId: c7a.id, date: new Date('2026-06-13'), status: InvoiceStatus.PAID, paid: 225, items: [{ name: 'شمعة الفانيلا الكبيرة', unitPrice: 45, quantity: 5 }] },
  ]);
  await mkExpenses(b7.id, [
    { date: new Date('2026-07-04'), category: ExpenseCategory.MARKETING, amount: 80, note: 'تصوير وإعلان' },
    { date: new Date('2026-07-15'), category: ExpenseCategory.PACKAGING, amount: 30, note: 'علب هدايا' },
    { date: new Date('2026-07-21'), category: ExpenseCategory.DELIVERY, amount: 20 },
    { date: new Date('2026-06-06'), category: ExpenseCategory.MARKETING, amount: 90 },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Business 8 — بُنّ الديار (تحميص قهوة منزلي فردي) — الرياض — +966500000008
  // مبيعات صغيرة · النتيجة: ربح بسيط
  // ═══════════════════════════════════════════════════════════════════════════
  const phone8 = '+966500000008';
  const b8 = await prisma.business.upsert({
    where: { ownerPhone: phone8 },
    update: {},
    create: { name: 'بُنّ الديار', ownerPhone: phone8, vatEnabled: false, city: 'الرياض' },
  });
  await prisma.user.upsert({
    where: { phone: phone8 },
    update: { businessId: b8.id },
    create: { phone: phone8, name: 'أبو سعد', businessId: b8.id },
  });
  await clearBusiness(b8.id);
  const [s8a] = await Promise.all([
    prisma.supplier.create({ data: { businessId: b8.id, name: 'مورد البن الأخضر', phone: '0555678901' } }),
  ]);
  await prisma.material.createMany({
    data: [
      { businessId: b8.id, name: 'بن أخضر إثيوبي', unit: Unit.KG, purchasePrice: 45, purchaseQty: 3, unitPrice: 85, vatRate: 0, stockQty: 2, reorderLevel: 1 },
      { businessId: b8.id, name: 'بن أخضر كولومبي', unit: Unit.KG, purchasePrice: 40, purchaseQty: 3, unitPrice: 78, vatRate: 0, stockQty: 1.5, reorderLevel: 1 },
      { businessId: b8.id, name: 'كيس تغليف بصمّام 250غ', unit: Unit.PIECE, purchasePrice: 1.2, purchaseQty: 50, unitPrice: 3, vatRate: 0, stockQty: 30 },
    ],
  });
  const ethRI: RI[] = [
    { name: 'بن أخضر إثيوبي', unit: Unit.KG, unitPrice: 85, quantityUsed: 0.3, type: RecipeItemType.RAW },
    { name: 'كيس تغليف بصمّام 250غ', unit: Unit.PIECE, unitPrice: 3, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  const colRI: RI[] = [
    { name: 'بن أخضر كولومبي', unit: Unit.KG, unitPrice: 78, quantityUsed: 0.3, type: RecipeItemType.RAW },
    { name: 'كيس تغليف بصمّام 250غ', unit: Unit.PIECE, unitPrice: 3, quantityUsed: 1, type: RecipeItemType.PACKAGING },
  ];
  for (const [ri, name, cat, margin, overhead] of [
    [ethRI, 'بن إثيوبي محمّص 250غ', 'قهوة', 45, 3],
    [colRI, 'بن كولومبي محمّص 250غ', 'قهوة', 45, 3],
  ] as [RI[], string, string, number, number][]) {
    const costs = computeCosts(ri, overhead, margin);
    await prisma.product.create({
      data: {
        businessId: b8.id, name, category: cat, overheadCost: overhead, profitMargin: margin, ...costs,
        recipeItems: { create: ri.map((i) => ({ name: i.name, unit: i.unit, unitPrice: i.unitPrice, quantityUsed: i.quantityUsed, lineCost: r2(i.unitPrice * i.quantityUsed), type: i.type })) },
      },
    });
  }
  const [c8a, c8b, c8c] = await Promise.all([
    prisma.customer.create({ data: { businessId: b8.id, name: 'سعود المطيري', phone: '0505678901' } }),
    prisma.customer.create({ data: { businessId: b8.id, name: 'ركن قهوة (سوق)', phone: '0515678901' } }),
    prisma.customer.create({ data: { businessId: b8.id, name: 'فيصل الحربي', phone: '0525678901' } }),
  ]);
  await mkPurchases(b8.id, [
    { num: 1, supplierId: s8a.id, date: new Date('2026-07-04'), items: [{ name: 'بن أخضر إثيوبي', unit: Unit.KG, quantity: 3, unitPrice: 45 }, { name: 'كيس تغليف بصمّام 250غ', unit: Unit.PIECE, quantity: 50, unitPrice: 1.2 }] },
    { num: 2, supplierId: s8a.id, date: new Date('2026-06-07'), items: [{ name: 'بن أخضر كولومبي', unit: Unit.KG, quantity: 3, unitPrice: 40 }] },
  ]);
  await mkInvoices(b8.id, [
    // July — مدفوع 430 · مشتريات 195 · مصاريف 115 → ربح +120
    { num: 1, custId: c8a.id, date: new Date('2026-07-08'), status: InvoiceStatus.PAID, paid: 330, items: [{ name: 'بن إثيوبي محمّص 250غ', unitPrice: 55, quantity: 6 }] },
    { num: 2, custId: c8b.id, date: new Date('2026-07-16'), status: InvoiceStatus.PAID, paid: 100, items: [{ name: 'بن كولومبي محمّص 250غ', unitPrice: 50, quantity: 2 }] },
    { num: 3, custId: c8c.id, date: new Date('2026-07-23'), dueDate: new Date('2026-08-07'), status: InvoiceStatus.UNPAID, items: [{ name: 'بن إثيوبي محمّص 250غ', unitPrice: 55, quantity: 4 }] },
    // June — مدفوع 385
    { num: 4, custId: c8a.id, date: new Date('2026-06-11'), status: InvoiceStatus.PAID, paid: 385, items: [{ name: 'بن إثيوبي محمّص 250غ', unitPrice: 55, quantity: 7 }] },
  ]);
  await mkExpenses(b8.id, [
    { date: new Date('2026-07-03'), category: ExpenseCategory.MARKETING, amount: 60, note: 'إعلان انستقرام' },
    { date: new Date('2026-07-14'), category: ExpenseCategory.DELIVERY, amount: 30, note: 'توصيل' },
    { date: new Date('2026-07-20'), category: ExpenseCategory.PACKAGING, amount: 25, note: 'ملصقات' },
    { date: new Date('2026-06-05'), category: ExpenseCategory.MARKETING, amount: 55 },
  ]);

  console.log('✓ Business 1 — مطبخ أم سلطان (+966500000001)');
  console.log('✓ Business 2 — مخبزة بيت الخبز (+966500000002)');
  console.log('✓ Business 3 — حلويات أم يوسف (+966500000003)');
  console.log('✓ Business 4 — ورشة العود والبخور (+966500000004)');
  console.log('✓ Business 5 — خياطة الأناقة (+966500000005)');
  console.log('✓ Business 6 — صابون الطبيعة (+966500000006)');
  console.log('✓ Business 7 — شموع ولمسات (+966500000007)');
  console.log('✓ Business 8 — بُنّ الديار (+966500000008)');
  console.log('\nتسجيل الدخول عبر POST /api/auth/otp/request بأي رقم أعلاه. رمز OTP يظهر في الاستجابة (وضع تجريبي).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
