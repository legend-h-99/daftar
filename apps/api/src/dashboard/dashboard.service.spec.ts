import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

// Helper to build a fresh mock PrismaService value for each test
function buildPrismaMock(overrides: Partial<{
  paidInvoices: any[];
  purchases: any[];
  expenses: any[];
  saleCost: number;
  unpaidInvoices: any[];
  lowStock: any[];
}> = {}) {
  const paidInvoices = overrides.paidInvoices ?? [];
  const purchases = overrides.purchases ?? [];
  const expenses = overrides.expenses ?? [];
  const saleCost = overrides.saleCost ?? 0;
  const unpaidInvoices = overrides.unpaidInvoices ?? [];
  const lowStock = overrides.lowStock ?? [];

  // invoice.findMany is called TWICE: first for PAID, then for UNPAID/PARTIAL.
  // We distinguish by returning different values based on call order.
  let invoiceFindManyCallCount = 0;
  return {
    invoice: {
      findMany: jest.fn().mockImplementation(() => {
        invoiceFindManyCallCount++;
        return Promise.resolve(
          invoiceFindManyCallCount === 1 ? paidInvoices : unpaidInvoices,
        );
      }),
      aggregate: jest.fn().mockResolvedValue({
        _count: { id: unpaidInvoices.length },
        _sum: {
          total: unpaidInvoices.length > 0
            ? unpaidInvoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0)
            : null,
          paidAmount: unpaidInvoices.length > 0
            ? unpaidInvoices.reduce((s: number, i: any) => s + (i.paidAmount ?? 0), 0)
            : null,
        },
      }),
    },
    purchase: {
      findMany: jest.fn().mockResolvedValue(purchases),
    },
    expense: {
      findMany: jest.fn().mockResolvedValue(expenses),
    },
    stockMovement: {
      findMany: jest.fn().mockResolvedValue(
        saleCost > 0
          ? [{ qty: -1, costAmount: saleCost, material: { unitPrice: saleCost } }]
          : [],
      ),
    },
    $queryRaw: jest.fn().mockResolvedValue(lowStock),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;

  async function buildService(prismaValue: any): Promise<DashboardService> {
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: prismaValue,
        },
      ],
    }).compile();
    return module.get(DashboardService);
  }

  it('returns zeros when no invoices/purchases/expenses exist', async () => {
    service = await buildService(buildPrismaMock());
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

  it('totalSales equals sum of PAID invoice totals', async () => {
    const paidInvoices = [{ total: 100 }, { total: 200 }, { total: 50 }];
    service = await buildService(buildPrismaMock({ paidInvoices }));
    const result = await service.summary('biz-1', '2026-01');
    expect(result.totalSales).toBe(350);
  });

  it('netProfit = sales − cost of goods sold − operating expenses', async () => {
    const paidInvoices = [{ total: 500 }];
    const purchases = [{ total: 150 }];
    const expenses = [{ amount: 75 }];
    service = await buildService(buildPrismaMock({
      paidInvoices,
      purchases,
      expenses,
      saleCost: 120,
    }));
    const result = await service.summary('biz-1', '2026-01');
    expect(result.totalPurchases).toBe(150);
    expect(result.costOfGoodsSold).toBe(120);
    expect(result.operatingExpenses).toBe(75);
    expect(result.totalExpenses).toBe(120 + 75);
    expect(result.netProfit).toBe(500 - 120 - 75); // 305
  });

  it('unpaid invoice appears in unpaidInvoices', async () => {
    const unpaidInvoices = [
      {
        id: 'inv-1',
        number: 42,
        total: 300,
        paidAmount: 0,
        dueDate: new Date('2026-02-01'),
        status: 'UNPAID',
        customer: { id: 'cust-1', name: 'عميل تجريبي' },
      },
    ];
    service = await buildService(buildPrismaMock({ unpaidInvoices }));
    const result = await service.summary('biz-1', '2026-01');
    expect(result.unpaidInvoices).toHaveLength(1);
    expect(result.unpaidInvoices[0].id).toBe('inv-1');
    expect(result.unpaidInvoices[0].customerName).toBe('عميل تجريبي');
    expect(result.unpaidInvoicesCount).toBe(1);
    expect(result.unpaidInvoicesTotal).toBe(300); // total - paidAmount
  });

  it('invalid month string throws BadRequestException', async () => {
    service = await buildService(buildPrismaMock());
    await expect(service.summary('biz-1', 'not-a-month')).rejects.toThrow(BadRequestException);
  });
});
