import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IDashboardQuery, DashboardSummary } from '../../application/ports/queries/dashboard.query.port';
import { getMonthRange } from '../../common/utils/month-range';

const UNPAID_CAP = 50;

@Injectable()
export class PrismaDashboardQuery implements IDashboardQuery {
  constructor(private readonly prisma: PrismaService) {}

  async summary(businessId: string, month?: string): Promise<DashboardSummary> {
    const range = getMonthRange(month);

    const [
      salesAgg,
      purchasesAgg,
      expensesAgg,
      cogsResult,
      unpaidInvoices,
      unpaidAggregate,
      lowStockMaterials,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          businessId,
          status: InvoiceStatus.PAID,
          issueDate: { gte: range.start, lt: range.end },
        },
        _sum: { total: true },
      }),
      this.prisma.purchase.aggregate({
        where: { businessId, date: { gte: range.start, lt: range.end } },
        _sum: { total: true },
      }),
      this.prisma.expense.aggregate({
        where: { businessId, date: { gte: range.start, lt: range.end } },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<{ cogs: number }[]>`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN sm."costAmount" IS NOT NULL THEN sm."costAmount"
              ELSE ABS(sm.qty) * m."unitPrice"
            END
          ), 0
        ) AS cogs
        FROM "StockMovement" sm
        JOIN "Material" m ON m.id = sm."materialId"
        WHERE sm."businessId" = ${businessId}
          AND sm.type = 'SALE'
          AND sm."createdAt" >= ${range.start}
          AND sm."createdAt" < ${range.end}
      `,
      this.prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
        },
        select: {
          id: true,
          number: true,
          total: true,
          dueDate: true,
          status: true,
          customer: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: UNPAID_CAP,
      }),
      this.prisma.invoice.aggregate({
        where: {
          businessId,
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
        },
        _count: { id: true },
        _sum: { total: true, paidAmount: true },
      }),
      this.prisma.$queryRaw<
        { id: string; name: string; unit: string; stockQty: number; reorderLevel: number }[]
      >`
        SELECT id, name, unit, "stockQty", "reorderLevel"
        FROM "Material"
        WHERE "businessId" = ${businessId}
          AND "reorderLevel" IS NOT NULL
          AND "stockQty" <= "reorderLevel"
        ORDER BY "stockQty" ASC
        LIMIT 10
      `,
    ]);

    const totalSales = salesAgg._sum.total ?? 0;
    const totalPurchases = purchasesAgg._sum.total ?? 0;
    const operatingExpenses = expensesAgg._sum.amount ?? 0;
    const costOfGoodsSold = Number(cogsResult[0]?.cogs ?? 0);
    const totalExpenses = operatingExpenses + costOfGoodsSold;
    const netProfit = totalSales - totalExpenses;
    const trueTotal = (unpaidAggregate._sum.total ?? 0) - (unpaidAggregate._sum.paidAmount ?? 0);

    return {
      month: range.month,
      totalSales,
      totalPurchases,
      costOfGoodsSold,
      operatingExpenses,
      totalExpenses,
      netProfit,
      unpaidInvoices: unpaidInvoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        customerName: inv.customer?.name ?? null,
        total: inv.total,
        dueDate: inv.dueDate,
        status: inv.status,
      })),
      unpaidInvoicesCount: unpaidAggregate._count.id,
      unpaidInvoicesTotal: trueTotal,
      unpaidInvoicesLimitedTo: UNPAID_CAP,
      lowStock: lowStockMaterials,
    };
  }
}
