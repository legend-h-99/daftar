import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Builds a PrismaService mock aligned with the optimised DashboardService:
 *   - invoice.aggregate  × 2  (paid totals + unpaid totals)
 *   - purchase.aggregate × 1
 *   - expense.aggregate  × 1
 *   - $queryRaw          × 2  (COGS JOIN query + low-stock query)
 *   - invoice.findMany   × 1  (capped unpaid list for display)
 */
function buildPrismaMock(overrides: Partial<{
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  saleCogs: number;
  unpaidInvoices: any[];
  lowStock: any[];
}> = {}) {
  const totalSales      = overrides.totalSales      ?? 0;
  const totalPurchases  = overrides.totalPurchases  ?? 0;
  const totalExpenses   = overrides.totalExpenses   ?? 0;
  const saleCogs        = overrides.saleCogs        ?? 0;
  const unpaidInvoices  = overrides.unpaidInvoices  ?? [];
  const lowStock        = overrides.lowStock        ?? [];

  const unpaidTotal     = unpaidInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const unpaidPaid      = unpaidInvoices.reduce((s, i) => s + (i.paidAmount ?? 0), 0);

  // invoice.aggregate is called twice: once for PAID sums, once for UNPAID/PARTIAL sums
  let aggregateCallCount = 0;
  const invoiceAggregate = jest.fn().mockImplementation(() => {
    aggregateCallCount++;
    if (aggregateCallCount === 1) {
      // First call: PAID invoice totals
      return Promise.resolve({ _sum: { total: totalSales || null } });
    }
    // Second call: UNPAID/PARTIAL aggregate
    return Promise.resolve({
      _count: { id: unpaidInvoices.length },
      _sum: {
        total: unpaidTotal || null,
        paidAmount: unpaidPaid || null,
      },
    });
  });

  // $queryRaw is called twice: COGS JOIN query first, low-stock query second
  let queryRawCallCount = 0;
  const queryRaw = jest.fn().mockImplementation(() => {
    queryRawCallCount++;
    if (queryRawCallCount === 1) {
      // COGS result
      return Promise.resolve([{ cogs: saleCogs }]);
    }
    // Low-stock result
    return Promise.resolve(lowStock);
  });

  return {
    invoice: {
      aggregate: invoiceAggregate,
      findMany: jest.fn().mockResolvedValue(unpaidInvoices),
    },
    purchase: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { total: totalPurchases || null },
      }),
    },
    expense: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: totalExpenses || null },
      }),
    },
    $queryRaw: queryRaw,
  };
}

describe('DashboardService', () => {
  async function buildService(prismaValue: any): Promise<DashboardService> {
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaValue },
      ],
    }).compile();
    return module.get(DashboardService);
  }

  it('returns zeros when no data exists', async () => {
    const service = await buildService(buildPrismaMock());
    const result = await service.summary('biz-1', '2026-01');

    expect(result.totalSales).toBe(0);
    expect(result.totalPurchases).toBe(0);
    expect(result.costOfGoodsSold).toBe(0);
    expect(result.operatingExpenses).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.unpaidInvoices).toHaveLength(0);
    expect(result.unpaidInvoicesCount).toBe(0);
    expect(result.unpaidInvoicesTotal).toBe(0);
  });

  it('totalSales equals the aggregate sum of PAID invoices', async () => {
    const service = await buildService(buildPrismaMock({ totalSales: 350 }));
    const result = await service.summary('biz-1', '2026-01');
    expect(result.totalSales).toBe(350);
  });

  it('netProfit = sales − COGS − operating expenses', async () => {
    const service = await buildService(buildPrismaMock({
      totalSales:     500,
      totalPurchases: 150,
      totalExpenses:  75,
      saleCogs:       120,
    }));
    const result = await service.summary('biz-1', '2026-01');

    expect(result.totalPurchases).toBe(150);
    expect(result.costOfGoodsSold).toBe(120);
    expect(result.operatingExpenses).toBe(75);
    expect(result.totalExpenses).toBe(195);   // 120 + 75
    expect(result.netProfit).toBe(305);        // 500 − 120 − 75
  });

  it('unpaid invoice appears in unpaidInvoices list with customerName', async () => {
    const unpaidInvoices = [
      {
        id: 'inv-1',
        number: 42,
        total: 300,
        paidAmount: 0,
        dueDate: new Date('2026-02-01'),
        status: 'UNPAID',
        customer: { name: 'عميل تجريبي' },
      },
    ];
    const service = await buildService(buildPrismaMock({ unpaidInvoices }));
    const result = await service.summary('biz-1', '2026-01');

    expect(result.unpaidInvoices).toHaveLength(1);
    expect(result.unpaidInvoices[0].id).toBe('inv-1');
    expect(result.unpaidInvoices[0].customerName).toBe('عميل تجريبي');
    expect(result.unpaidInvoicesCount).toBe(1);
    expect(result.unpaidInvoicesTotal).toBe(300);
  });

  it('partial invoice outstanding = total − paidAmount', async () => {
    const unpaidInvoices = [
      { id: 'inv-2', number: 5, total: 400, paidAmount: 100,
        dueDate: null, status: 'PARTIAL', customer: null },
    ];
    const service = await buildService(buildPrismaMock({ unpaidInvoices }));
    const result = await service.summary('biz-1', '2026-01');
    // trueTotal = sum(total) − sum(paidAmount) = 400 − 100 = 300
    expect(result.unpaidInvoicesTotal).toBe(300);
  });

  it('low-stock materials are passed through', async () => {
    const lowStock = [
      { id: 'm-1', name: 'طحين', unit: 'KG', stockQty: 1, reorderLevel: 5 },
    ];
    const service = await buildService(buildPrismaMock({ lowStock }));
    const result = await service.summary('biz-1', '2026-01');
    expect(result.lowStock).toHaveLength(1);
    expect(result.lowStock[0].name).toBe('طحين');
  });

  it('invalid month string throws BadRequestException', async () => {
    const service = await buildService(buildPrismaMock());
    await expect(service.summary('biz-1', 'not-a-month'))
      .rejects.toThrow(BadRequestException);
  });
});
