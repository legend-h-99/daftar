import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { OCR_PROVIDER, OcrProvider } from './ocr/ocr.provider';

const MAX_NUMBER_ASSIGN_RETRIES = 5;

type Tx = Prisma.TransactionClient;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
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
              let materialId = item.materialId;

              if (materialId) {
                const material = await tx.material.findFirst({
                  where: { id: materialId, businessId },
                });
                if (!material) {
                  throw new NotFoundException(`Material ${materialId} not found`);
                }
                const updated = await tx.material.update({
                  where: { id: materialId },
                  data: {
                    stockQty: { increment: item.quantity },
                    // Latest-cost refresh so the recipe calculator stays honest.
                    purchasePrice: lineTotal,
                    purchaseQty: item.quantity,
                    unitPrice: item.unitPrice,
                  },
                });
                await tx.stockMovement.create({
                  data: {
                    businessId,
                    materialId,
                    type: 'PURCHASE',
                    qty: item.quantity,
                    balanceAfter: updated.stockQty,
                    refType: 'purchase',
                    refId: purchase.id,
                  },
                });
              } else {
                // OCR/manual line without an id: match an existing material by
                // name+unit first (prevents duplicate "طحين" rows), otherwise
                // create it.
                const existing = await tx.material.findFirst({
                  where: { businessId, name: item.name.trim(), unit: item.unit },
                });
                const saved = existing
                  ? await tx.material.update({
                      where: { id: existing.id },
                      data: {
                        stockQty: { increment: item.quantity },
                        purchasePrice: lineTotal,
                        purchaseQty: item.quantity,
                        unitPrice: item.unitPrice,
                      },
                    })
                  : await tx.material.create({
                      data: {
                        businessId,
                        name: item.name.trim(),
                        unit: item.unit,
                        purchasePrice: lineTotal,
                        purchaseQty: item.quantity,
                        unitPrice: item.unitPrice,
                        stockQty: item.quantity,
                      },
                    });
                materialId = saved.id;
                await tx.stockMovement.create({
                  data: {
                    businessId,
                    materialId,
                    type: 'PURCHASE',
                    qty: item.quantity,
                    balanceAfter: saved.stockQty,
                    refType: 'purchase',
                    refId: purchase.id,
                  },
                });
              }

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

            await this.productsService.recostProductsUsingMaterials(tx, businessId, touchedMaterialIds);

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

  findAll(businessId: string) {
    return this.prisma.purchase.findMany({
      where: { businessId },
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
    const purchases = await this.prisma.purchase.findMany({
      where: { businessId },
      include: { supplier: { select: { name: true } } },
    });

    const bySupplier = new Map<string, { name: string; count: number; total: number }>();
    const byMonth = new Map<string, { month: string; count: number; total: number }>();

    for (const p of purchases) {
      const supplierName = p.supplier?.name ?? 'بدون مورد';
      const s = bySupplier.get(supplierName) ?? { name: supplierName, count: 0, total: 0 };
      s.count += 1;
      s.total += p.total;
      bySupplier.set(supplierName, s);

      const month = p.date.toISOString().slice(0, 7);
      const m = byMonth.get(month) ?? { month, count: 0, total: 0 };
      m.count += 1;
      m.total += p.total;
      byMonth.set(month, m);
    }

    return {
      bySupplier: [...bySupplier.values()].sort((a, b) => b.total - a.total),
      byMonth: [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)),
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

      const touched: string[] = [];
      for (const item of purchase.items) {
        if (!item.materialId) continue;
        const updated = await tx.material.update({
          where: { id: item.materialId },
          data: { stockQty: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            businessId,
            materialId: item.materialId,
            type: 'PURCHASE',
            qty: -item.quantity,
            balanceAfter: updated.stockQty,
            refType: 'purchase',
            refId: purchase.id,
            note: `عكس حذف فاتورة شراء رقم ${purchase.number}`,
          },
        });
        touched.push(item.materialId);
      }

      await tx.purchase.delete({ where: { id } });
      await this.productsService.recostProductsUsingMaterials(tx, businessId, touched);
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
