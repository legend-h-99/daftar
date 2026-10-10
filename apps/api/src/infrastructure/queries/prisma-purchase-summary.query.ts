import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IPurchaseSummaryQuery,
  PurchaseSummary,
} from '../../application/ports/queries/purchase-summary.query.port';

@Injectable()
export class PrismaPurchaseSummaryQuery implements IPurchaseSummaryQuery {
  constructor(private readonly prisma: PrismaService) {}

  async summary(businessId: string): Promise<PurchaseSummary> {
    const [bySupplierRaw, byMonthRaw] = await Promise.all([
      this.prisma.purchase.groupBy({
        by: ['supplierId'],
        where: { businessId },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 50,
      }),
      this.prisma.$queryRaw<{ month: string; count: bigint; total: number }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
          COUNT(*)                                       AS count,
          SUM(total)                                     AS total
        FROM "Purchase"
        WHERE "businessId" = ${businessId}
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY DATE_TRUNC('month', date) DESC
        LIMIT 24
      `,
    ]);

    const supplierIds = bySupplierRaw
      .map((r) => r.supplierId)
      .filter((id): id is string => id !== null);

    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    return {
      bySupplier: bySupplierRaw.map((r) => ({
        name: r.supplierId ? (supplierMap.get(r.supplierId) ?? 'بدون مورد') : 'بدون مورد',
        count: r._count.id,
        total: r._sum.total ?? 0,
      })),
      byMonth: byMonthRaw.map((r) => ({
        month: r.month,
        count: Number(r.count),
        total: Number(r.total),
      })),
    };
  }
}
