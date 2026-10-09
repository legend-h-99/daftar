/**
 * Scale-test fixture generator — NOT part of the normal `prisma db seed` flow
 * (see package.json: `prisma.seed` still points at seed.ts).
 *
 * Creates ~1000 businesses/users and several thousand invoices/purchases/
 * expenses, so the pagination caps added in plans/013 and the dashboard cap
 * added in plans/003 can be exercised against real Postgres query plans
 * instead of mocked Prisma calls. All records use phone numbers under the
 * +9665900##### range so they never collide with the hand-authored demo
 * businesses in seed.ts (+96650000000#) and can be wiped independently by
 * re-running this script.
 *
 * Usage: `pnpm --filter api db:seed:scale`
 */
import {
  PrismaClient,
  Unit,
  InvoiceStatus,
  ExpenseCategory,
  PurchaseSource,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const PHONE_PREFIX = '+9665900';
const NORMAL_BUSINESSES = 979;
const HEAVY_BUSINESSES = 20;
// + 1 "mega" business below → 1000 businesses / users total.

const MATERIAL_NAMES: [string, Unit][] = [
  ['دقيق', Unit.KG],
  ['سكر', Unit.KG],
  ['زيت', Unit.LITER],
  ['بيض', Unit.PIECE],
  ['تغليف', Unit.PIECE],
];

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر'];
const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function insertBatched<T>(
  label: string,
  rows: T[],
  size: number,
  insert: (batch: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
  console.log(`  ${label}: ${rows.length} rows`);
}

type BusinessSpec = {
  businessId: string;
  userId: string;
  phone: string;
  index: number;
  supplierCount: number;
  customerCount: number;
  invoiceCount: number;
  purchaseCount: number;
  expenseCount: number;
  monthsSpread: number;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log('Wiping any previous scale-test businesses...');
  const existing = await prisma.business.findMany({
    where: { ownerPhone: { startsWith: PHONE_PREFIX } },
    select: { id: true },
  });
  if (existing.length) {
    const ids = existing.map((b) => b.id);
    await prisma.stockMovement.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.purchaseItem.deleteMany({ where: { purchase: { businessId: { in: ids } } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { businessId: { in: ids } } } });
    await prisma.purchase.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.invoice.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.expense.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.supplier.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.material.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.user.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
    console.log(`  removed ${existing.length} previous scale-test businesses`);
  }

  const specs: BusinessSpec[] = [];
  let idx = 0;
  for (let i = 0; i < NORMAL_BUSINESSES; i++, idx++) {
    specs.push({
      businessId: randomUUID(),
      userId: randomUUID(),
      phone: `${PHONE_PREFIX}${String(idx).padStart(6, '0')}`,
      index: idx,
      supplierCount: 2,
      customerCount: 3,
      invoiceCount: 3,
      purchaseCount: 2,
      expenseCount: 3,
      monthsSpread: 3,
    });
  }
  for (let i = 0; i < HEAVY_BUSINESSES; i++, idx++) {
    specs.push({
      businessId: randomUUID(),
      userId: randomUUID(),
      phone: `${PHONE_PREFIX}${String(idx).padStart(6, '0')}`,
      index: idx,
      supplierCount: 5,
      customerCount: 10,
      invoiceCount: 90, // exceeds the 50-row dashboard unpaid cap (plan 003)
      purchaseCount: 70, // exceeds the default list limit=50 (plan 013)
      expenseCount: 40,
      monthsSpread: 6,
    });
  }
  // One "mega" business: exercises the purchases/summary groupBy caps
  // (top 50 suppliers by total, last 24 months) from plan 013 Step 5.
  const mega: BusinessSpec = {
    businessId: randomUUID(),
    userId: randomUUID(),
    phone: `${PHONE_PREFIX}${String(idx).padStart(6, '0')}`,
    index: idx,
    supplierCount: 60, // > groupBy take:50
    customerCount: 60,
    invoiceCount: 700, // >> unpaidInvoicesLimitedTo=50
    purchaseCount: 700,
    expenseCount: 60,
    monthsSpread: 30, // > byMonth groupBy take:24
  };
  specs.push(mega);
  idx++;

  console.log(`Prepared ${specs.length} businesses (${NORMAL_BUSINESSES} normal, ${HEAVY_BUSINESSES} heavy, 1 mega).`);

  console.log('Inserting businesses + users...');
  await insertBatched(
    'businesses',
    specs.map((s) => ({
      id: s.businessId,
      name: `منشأة اختبار ${s.index + 1}`,
      ownerPhone: s.phone,
      vatEnabled: s.index % 2 === 0,
      vatNumber: s.index % 2 === 0 ? `3${String(s.index).padStart(14, '0')}` : null,
      city: pick(CITIES, s.index),
    })),
    500,
    (batch) => prisma.business.createMany({ data: batch }),
  );
  await insertBatched(
    'users',
    specs.map((s) => ({
      id: s.userId,
      phone: s.phone,
      name: `مستخدم اختبار ${s.index + 1}`,
      businessId: s.businessId,
    })),
    500,
    (batch) => prisma.user.createMany({ data: batch }),
  );

  console.log('Inserting suppliers, customers, materials...');
  const suppliers: { id: string; businessId: string; name: string; phone: string }[] = [];
  const customers: { id: string; businessId: string; name: string; phone: string }[] = [];
  const materials: {
    id: string;
    businessId: string;
    name: string;
    unit: Unit;
    purchasePrice: number;
    purchaseQty: number;
    unitPrice: number;
    stockQty: number;
    reorderLevel: number | null;
  }[] = [];

  for (const s of specs) {
    for (let i = 0; i < s.supplierCount; i++) {
      suppliers.push({
        id: randomUUID(),
        businessId: s.businessId,
        name: `مورد ${i + 1} - ${s.index + 1}`,
        phone: `055${String(s.index).padStart(6, '0')}${i}`,
      });
    }
    for (let i = 0; i < s.customerCount; i++) {
      customers.push({
        id: randomUUID(),
        businessId: s.businessId,
        name: `عميل ${i + 1} - ${s.index + 1}`,
        phone: `056${String(s.index).padStart(6, '0')}${i}`,
      });
    }
    for (let i = 0; i < MATERIAL_NAMES.length; i++) {
      const [name, unit] = MATERIAL_NAMES[i];
      const lowStock = i === 0; // first material of every business is low-stock
      materials.push({
        id: randomUUID(),
        businessId: s.businessId,
        name,
        unit,
        purchasePrice: 5 + i,
        purchaseQty: 10,
        unitPrice: 10 + i * 2,
        stockQty: lowStock ? 1 : 20,
        reorderLevel: lowStock ? 5 : null,
      });
    }
  }
  await insertBatched('suppliers', suppliers, 2000, (b) => prisma.supplier.createMany({ data: b }));
  await insertBatched('customers', customers, 2000, (b) => prisma.customer.createMany({ data: b }));
  await insertBatched('materials', materials, 2000, (b) => prisma.material.createMany({ data: b }));

  console.log('Inserting invoices + items...');
  const invoices: {
    id: string;
    businessId: string;
    customerId: string;
    number: number;
    status: InvoiceStatus;
    issueDate: Date;
    dueDate: Date | null;
    subtotal: number;
    vatAmount: number;
    total: number;
    paidAmount: number;
  }[] = [];
  const invoiceItems: {
    id: string;
    invoiceId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[] = [];

  const businessCustomers = new Map<string, string[]>();
  for (const c of customers) {
    const list = businessCustomers.get(c.businessId) ?? [];
    list.push(c.id);
    businessCustomers.set(c.businessId, list);
  }

  for (const s of specs) {
    const custIds = businessCustomers.get(s.businessId)!;
    for (let i = 0; i < s.invoiceCount; i++) {
      const status: InvoiceStatus =
        i % 5 === 0 ? InvoiceStatus.UNPAID : i % 5 === 1 ? InvoiceStatus.PARTIAL : InvoiceStatus.PAID;
      const unitPrice = 20 + (i % 10);
      const quantity = 1 + (i % 5);
      const subtotal = Math.round(unitPrice * quantity * 100) / 100;
      const paidAmount = status === InvoiceStatus.PAID ? subtotal : status === InvoiceStatus.PARTIAL ? subtotal / 2 : 0;
      const issueDate = daysAgo((i % (s.monthsSpread * 30)) + 1);
      const invoiceId = randomUUID();
      invoices.push({
        id: invoiceId,
        businessId: s.businessId,
        customerId: pick(custIds, i),
        number: i + 1,
        status,
        issueDate,
        dueDate: status === InvoiceStatus.PAID ? null : daysAgo(-14),
        subtotal,
        vatAmount: 0,
        total: subtotal,
        paidAmount,
      });
      invoiceItems.push({
        id: randomUUID(),
        invoiceId,
        name: `منتج ${(i % 5) + 1}`,
        unitPrice,
        quantity,
        lineTotal: subtotal,
      });
    }
  }
  await insertBatched('invoices', invoices, 2000, (b) => prisma.invoice.createMany({ data: b }));
  await insertBatched('invoice items', invoiceItems, 2000, (b) => prisma.invoiceItem.createMany({ data: b }));

  console.log('Inserting purchases + items...');
  const purchases: {
    id: string;
    businessId: string;
    supplierId: string;
    number: number;
    date: Date;
    total: number;
    source: PurchaseSource;
  }[] = [];
  const purchaseItems: {
    id: string;
    purchaseId: string;
    name: string;
    unit: Unit;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[] = [];

  const businessSuppliers = new Map<string, string[]>();
  for (const sup of suppliers) {
    const list = businessSuppliers.get(sup.businessId) ?? [];
    list.push(sup.id);
    businessSuppliers.set(sup.businessId, list);
  }

  for (const s of specs) {
    const supIds = businessSuppliers.get(s.businessId)!;
    for (let i = 0; i < s.purchaseCount; i++) {
      const [name, unit] = MATERIAL_NAMES[i % MATERIAL_NAMES.length];
      const unitPrice = 5 + (i % 8);
      const quantity = 1 + (i % 6);
      const total = Math.round(unitPrice * quantity * 100) / 100;
      const purchaseId = randomUUID();
      purchases.push({
        id: purchaseId,
        businessId: s.businessId,
        supplierId: pick(supIds, i),
        number: i + 1,
        date: daysAgo((i % (s.monthsSpread * 30)) + 1),
        total,
        source: PurchaseSource.MANUAL,
      });
      purchaseItems.push({
        id: randomUUID(),
        purchaseId,
        name,
        unit,
        quantity,
        unitPrice,
        lineTotal: total,
      });
    }
  }
  await insertBatched('purchases', purchases, 2000, (b) => prisma.purchase.createMany({ data: b }));
  await insertBatched('purchase items', purchaseItems, 2000, (b) => prisma.purchaseItem.createMany({ data: b }));

  console.log('Inserting expenses...');
  const expenses: {
    id: string;
    businessId: string;
    category: ExpenseCategory;
    amount: number;
    date: Date;
  }[] = [];
  for (const s of specs) {
    for (let i = 0; i < s.expenseCount; i++) {
      expenses.push({
        id: randomUUID(),
        businessId: s.businessId,
        category: pick(EXPENSE_CATEGORIES, i),
        amount: 50 + (i % 20) * 10,
        date: daysAgo((i % (s.monthsSpread * 30)) + 1),
      });
    }
  }
  await insertBatched('expenses', expenses, 2000, (b) => prisma.expense.createMany({ data: b }));

  console.log('\nDone.');
  console.log(`businesses=${specs.length} users=${specs.length}`);
  console.log(`invoices=${invoices.length} purchases=${purchases.length} expenses=${expenses.length}`);
  console.log(`Mega business id: ${mega.businessId} (phone ${mega.phone})`);
  console.log('\nNext: pnpm test:scale (behavior checks) or pnpm test:load (load test).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
