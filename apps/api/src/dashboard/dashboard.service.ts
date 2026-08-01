import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getMonthRange } from '../common/utils/month-range';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(businessId: string, month?: string) {
    let range: ReturnType<typeof getMonthRange>;
    try {
      range = getMonthRange(month);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const UNPAID_CAP = 50;

    const [paidInvoices, purchases, expenses, saleMovements, unpaidInvoices, unpaidAggregate, lowStockMaterials] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: {
            businessId,
            status: InvoiceStatus.PAID,
            issueDate: { gte: range.start, lt: range.end },
          },
          select: { total: true },
        }),
        this.prisma.purchase.findMany({
          where: { businessId, date: { gte: range.start, lt: range.end } },
          select: { total: true },
        }),
        this.prisma.expense.findMany({
          where: { businessId, date: { gte: range.start, lt: range.end } },
          select: { amount: true },
        }),
        this.prisma.stockMovement.findMany({
          where: {
            businessId,
            type: 'SALE',
            createdAt: { gte: range.start, lt: range.end },
          },
          select: {
            qty: true,
            costAmount: true,
            material: { select: { unitPrice: true } },
          },
        }),
        // Capped list for display
        this.prisma.invoice.findMany({
          where: {
            businessId,
            status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
          },
          include: { customer: true },
          orderBy: { dueDate: 'asc' },
          take: UNPAID_CAP,
        }),
        // True totals — not capped
        this.prisma.invoice.aggregate({
          where: {
            businessId,
            status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
          },
          _count: { id: true },
          _sum: { total: true, paidAmount: true },
        }),
        // Low-stock alert: materials at or below their reorder level.
        this.prisma.$queryRaw<
          { id: string; name: string; unit: string; stockQty: number; reorderLevel: number }[]
        >`SELECT id, name, unit, "stockQty", "reorderLevel"
          FROM "Material"
          WHERE "businessId" = ${businessId}
            AND "reorderLevel" IS NOT NULL
            AND "stockQty" <= "reorderLevel"
          ORDER BY "stockQty" ASC
          LIMIT 10`,
      ]);

    const totalSales = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    const operatingExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const costOfGoodsSold = saleMovements.reduce(
      (sum, movement) =>
        sum + (movement.costAmount ?? Math.abs(movement.qty) * movement.material.unitPrice),
      0,
    );
    const totalExpenses = operatingExpenses + costOfGoodsSold;
    const netProfit = totalSales - totalExpenses;

    const unpaidInvoicesFormatted = unpaidInvoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer?.name ?? null,
      total: inv.total,
      dueDate: inv.dueDate,
      status: inv.status,
    }));

    const trueTotal = (unpaidAggregate._sum.total ?? 0) - (unpaidAggregate._sum.paidAmount ?? 0);
    const trueCount = unpaidAggregate._count.id;

    return {
      month: range.month,
      totalSales,
      totalPurchases,
      costOfGoodsSold,
      operatingExpenses,
      totalExpenses,
      netProfit,
      unpaidInvoices: unpaidInvoicesFormatted,
      unpaidInvoicesCount: trueCount,
      unpaidInvoicesTotal: trueTotal,
      unpaidInvoicesLimitedTo: UNPAID_CAP,
      lowStock: lowStockMaterials,
    };
  }
}
