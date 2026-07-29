import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { OCR_PROVIDER, OcrProvider } from './ocr/ocr.provider';
import { getMonthRange } from '../common/utils/month-range';
import { FindPurchasesQueryDto } from './dto/find-purchases-query.dto';

const MAX_NUMBER_ASSIGN_RETRIES = 5;

type Tx = Prisma.TransactionClient;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
  ) {}

  /**
   * Extract a purchase draft from an invoice photo. Read-only: the draft is
   * returned for the user to review/edit; nothing touches the database until
   * they confirm and the client calls create().
   */
  async scan(businessId: string, imageBase64?: string) {
    const materials = await this.prisma.material.findMany({
      where: { businessId },
      select: { id: true, name: true, unit: true, unitPrice: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.ocr.extractPurchaseDraft(imageBase64, { materials });
  }

  /**
   * Create a purchase and apply it to inventory in ONE transaction:
   *  - sequential per-business numbering (same pattern as invoices)
   *  - lines with materialId increment that material's stock
   *  - lines without materialId auto-create the material (OCR flow)
   *  - every stock change is journaled as a PURCHASE StockMovement
   *  - the material's latest cost is refreshed from the purchase line, and
   *    every product recipe using it is re-costed via the products module
   *    (single source of truth for the calculator math).
   */
  async create(businessId: string, dto: CreatePurchaseDto) {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_NUMBER_ASSIGN_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const supplierId = await this.resolveSupplier(tx, businessId, dto);

            const agg = await tx.purchase.aggregate({
              where: { businessId },
              _max: { number: true },
            });
            const nextNumber = (agg._max.number ?? 0) + 1;

            const total = dto.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

            const purchase = await tx.purchase.create({
              data: {
                businessId,
                supplierId,
                number: nextNumber,
                date: dto.date ? new Date(dto.date) : new Date(),
                total: Math.round(total * 100) / 100,
                notes: dto.notes,
                source: dto.source ?? 'MANUAL',
              },
            });

            const touchedMaterialIds: string[] = [];

            for (const item of dto.items) {
              const lineTotal = item.quantity * item.unitPrice;
              const materialId = await this.inventoryService.applyPurchaseLine(
                tx,
                businessId,
                purchase.id,
                item,
              );

              touchedMaterialIds.push(materialId);
              await tx.purchaseItem.create({
                data: {
                  purchaseId: purchase.id,
                  materialId,
                  name: item.name,
                  unit: item.unit,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal,
                },
              });
            }

            await this.inventoryService.recostMaterials(tx, businessId, touchedMaterialIds);

            return tx.purchase.findUniqueOrThrow({
              where: { id: purchase.id },
              include: { items: true, supplier: true },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        lastError = error;
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  findAll(businessId: string, query: FindPurchasesQueryDto = {}) {
    const range = query.month ? getMonthRange(query.month) : undefined;
    return this.prisma.purchase.findMany({
      where: {
        businessId,
        ...(range && { date: { gte: range.start, lt: range.end } }),
      },
      include: { supplier: true, items: true },
      orderBy: { number: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: { supplier: true, items: true },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }
    return purchase;
  }

  /** Purchase totals grouped by supplier and by month, for the reports view. */
  async summary(businessId: string) {
    // bySupplier: delegate to DB via groupBy — supplierId groups correctly.
    // byMonth: Prisma groupBy on DateTime groups by exact timestamp, not month.
    //   Fallback: cap findMany at 500 rows and aggregate in JS (plan 013 note).
    const [bySupplierRaw, purchases] = await Promise.all([
      this.prisma.purchase.groupBy({
        by: ['supplierId'],
        where: { businessId },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 50,
      }),
      this.prisma.purchase.findMany({
        where: { businessId },
        select: { date: true, total: true },
        orderBy: { date: 'desc' },
        take: 500,
      }),
    ]);

    // Resolve supplier names in a single follow-up query
    const supplierIds = bySupplierRaw
      .map((r) => r.supplierId)
      .filter((id): id is string => id !== null);

    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    // Aggregate by month in JS (last 500 purchases, capped for memory safety)
    const byMonthMap = new Map<string, { month: string; count: number; total: number }>();
    for (const p of purchases) {
      const month = p.date.toISOString().slice(0, 7);
      const m = byMonthMap.get(month) ?? { month, count: 0, total: 0 };
      m.count += 1;
      m.total += p.total;
      byMonthMap.set(month, m);
    }

    return {
      bySupplier: bySupplierRaw.map((r) => ({
        name: r.supplierId ? (supplierMap.get(r.supplierId) ?? 'بدون مورد') : 'بدون مورد',
        count: r._count.id,
        total: r._sum.total ?? 0,
      })),
      byMonth: [...byMonthMap.values()].sort((a, b) => b.month.localeCompare(a.month)),
    };
  }

  /**
   * Delete a purchase and REVERSE its stock effect (negative PURCHASE
   * movements), keeping inventory and the ledger consistent.
   */
  async remove(businessId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { items: true },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }

      const touched = await this.inventoryService.reversePurchaseItems(
        tx,
        businessId,
        purchase,
        purchase.items,
      );

      await tx.purchase.delete({ where: { id } });
      await this.inventoryService.recostMaterials(tx, businessId, touched);
    });
    return { deleted: true };
  }

  private async resolveSupplier(
    tx: Tx,
    businessId: string,
    dto: CreatePurchaseDto,
  ): Promise<string | undefined> {
    if (dto.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, businessId },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      return supplier.id;
    }
    if (dto.supplierName?.trim()) {
      const name = dto.supplierName.trim();
      const existing = await tx.supplier.findFirst({ where: { businessId, name } });
      if (existing) return existing.id;
      const created = await tx.supplier.create({ data: { businessId, name } });
      return created.id;
    }
    return undefined;
  }
}
