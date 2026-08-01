import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

type Tx = Prisma.TransactionClient;

interface PurchaseStockLine {
  materialId?: string;
  name: string;
  unit: Unit;
  quantity: number;
  unitPrice: number;
}

interface SaleStockLine {
  productId?: string | null;
  quantity: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  /** Stock overview: every material with its live quantity and low-stock flag. */
  async list(businessId: string) {
    const materials = await this.prisma.material.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
    return materials.map((m) => ({
      ...m,
      lowStock: m.reorderLevel !== null && m.stockQty <= m.reorderLevel,
    }));
  }

  /** Append-only movement ledger, newest first. */
  movements(businessId: string, materialId?: string) {
    return this.prisma.stockMovement.findMany({
      where: { businessId, materialId },
      include: { material: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Manual stock adjustment (e.g. after a physical count). Records the delta
   * as an ADJUSTMENT movement so the ledger always explains the balance.
   */
  async adjust(businessId: string, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      return this.recordAdjustment(tx, businessId, dto.materialId, dto.newQty, dto.note);
    });
  }

  async recordOpeningBalance(
    tx: Tx,
    businessId: string,
    materialId: string,
    initialQty: number,
  ) {
    if (initialQty <= 0) return;
    await tx.stockMovement.create({
      data: {
        businessId,
        materialId,
        type: 'ADJUSTMENT',
        qty: initialQty,
        balanceAfter: initialQty,
        note: 'رصيد افتتاحي',
      },
    });
  }

  async recordAdjustment(
    tx: Tx,
    businessId: string,
    materialId: string,
    newQty: number,
    note?: string,
  ) {
    const material = await tx.material.findFirst({
      where: { id: materialId, businessId },
    });
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    const delta = newQty - material.stockQty;
    const updated = await tx.material.update({
      where: { id: material.id },
      data: { stockQty: newQty },
    });

    await tx.stockMovement.create({
      data: {
        businessId,
        materialId: material.id,
        type: 'ADJUSTMENT',
        qty: delta,
        balanceAfter: updated.stockQty,
        note,
      },
    });

    return updated;
  }

  async applyPurchaseLine(
    tx: Tx,
    businessId: string,
    purchaseId: string,
    item: PurchaseStockLine,
  ): Promise<string> {
    const lineTotal = item.quantity * item.unitPrice;
    let materialId = item.materialId;
    let stockQtyAfter: number;

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
          purchasePrice: lineTotal,
          purchaseQty: item.quantity,
          unitPrice: item.unitPrice,
        },
      });
      stockQtyAfter = updated.stockQty;
    } else {
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
      stockQtyAfter = saved.stockQty;
    }

    await tx.stockMovement.create({
      data: {
        businessId,
        materialId,
        type: 'PURCHASE',
        qty: item.quantity,
        balanceAfter: stockQtyAfter,
        costAmount: lineTotal,
        refType: 'purchase',
        refId: purchaseId,
      },
    });

    return materialId;
  }

  async reversePurchaseItems(
    tx: Tx,
    businessId: string,
    purchase: { id: string; number: number },
    items: { materialId: string | null; quantity: number }[],
  ): Promise<string[]> {
    const touched: string[] = [];
    for (const item of items) {
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
          costAmount: null,
          refType: 'purchase',
          refId: purchase.id,
          note: `عكس حذف فاتورة شراء رقم ${purchase.number}`,
        },
      });
      touched.push(item.materialId);
    }
    return touched;
  }

  async consumeStockForSale(
    tx: Tx,
    businessId: string,
    invoiceId: string,
    items: SaleStockLine[],
  ): Promise<void> {
    const productIds = [
      ...new Set(items.filter((i) => i.productId).map((i) => i.productId as string)),
    ];
    if (productIds.length === 0) return;

    const recipeLines = await tx.recipeItem.findMany({
      where: {
        productId: { in: productIds },
        materialId: { not: null },
        product: { businessId },
      },
      select: {
        productId: true,
        materialId: true,
        quantityUsed: true,
        material: { select: { unitPrice: true } },
      },
    });
    if (recipeLines.length === 0) return;

    const consumedByMaterial = new Map<string, { qty: number; unitPrice: number }>();
    for (const item of items) {
      if (!item.productId) continue;
      for (const line of recipeLines) {
        if (line.productId !== item.productId || !line.materialId) continue;
        const used = line.quantityUsed * item.quantity;
        const current = consumedByMaterial.get(line.materialId) ?? {
          qty: 0,
          unitPrice: line.material?.unitPrice ?? 0,
        };
        current.qty += used;
        current.unitPrice = line.material?.unitPrice ?? current.unitPrice;
        consumedByMaterial.set(line.materialId, current);
      }
    }

    for (const [materialId, consumed] of consumedByMaterial) {
      const { qty, unitPrice } = consumed;
      if (qty <= 0) continue;
      const updated = await tx.material.update({
        where: { id: materialId },
        data: { stockQty: { decrement: qty } },
      });
      await tx.stockMovement.create({
        data: {
          businessId,
          materialId,
          type: 'SALE',
          qty: -qty,
          balanceAfter: updated.stockQty,
          costAmount: qty * unitPrice,
          refType: 'invoice',
          refId: invoiceId,
        },
      });
    }
  }

  recostMaterials(tx: Tx, businessId: string, materialIds: string[]) {
    return this.productsService.recostProductsUsingMaterials(tx, businessId, materialIds);
  }
}
