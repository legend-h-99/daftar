import { PrismaDashboardQuery } from '../infrastructure/queries/prisma-dashboard.query';
import { PrismaService } from '../prisma/prisma.service';

it('reports sales before VAT across payment statuses, separately from collections', async () => {
  const aggregate = jest.fn()
    .mockResolvedValueOnce({ _sum: { subtotal: 100 } })
    .mockResolvedValueOnce({ _sum: { total: 115, paidAmount: 0 }, _count: { id: 1 } });
  const prisma = {
    invoice: { aggregate, findMany: jest.fn().mockResolvedValue([]) },
    purchase: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 } }) },
    expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10 } }) },
    $queryRaw: jest.fn().mockResolvedValueOnce([{ cogs: 60 }]).mockResolvedValueOnce([]),
  };
  const result = await new PrismaDashboardQuery(prisma as unknown as PrismaService).summary('business-a', '2026-11');
  expect(result).toMatchObject({ totalSales: 100, costOfGoodsSold: 60, operatingExpenses: 10, netProfit: 30 });
  expect(aggregate.mock.calls[0][0].where).not.toHaveProperty('status');
  expect(aggregate.mock.calls[0][0]._sum).toEqual({ subtotal: true });
});
