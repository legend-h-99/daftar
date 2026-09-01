import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, IUnitOfWork, IAtomicContext } from '../../ports/unit-of-work.port';
import { MaterialUnit } from '../../../domain/entities/material.entity';
import { RecostProductsUseCase } from '../products/recost-products.use-case';

export interface CreatePurchaseItemCommand {
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseCommand {
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  purchaseDate?: string;
  items: CreatePurchaseItemCommand[];
}

const MAX_RETRIES = 5;

@Injectable()
export class CreatePurchaseUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly recostProducts: RecostProductsUseCase,
  ) {}

  async execute(businessId: string, cmd: CreatePurchaseCommand) {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const touchedMaterialIds = await this.uow.executeSerializable(async (ctx) => {
          const supplierId = await this.resolveSupplier(ctx, businessId, cmd);
          const nextNumber = (await ctx.purchase.maxNumber(businessId)) + 1;
          const total = cmd.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

          const purchase = await ctx.purchase.create({
            businessId,
            supplierId,
            number: nextNumber,
            source: 'MANUAL',
            total,
            date: cmd.purchaseDate ? new Date(cmd.purchaseDate) : undefined,
            notes: cmd.notes,
          });

          const touched: string[] = [];
          for (const item of cmd.items) {
            const materialId = await this.applyPurchaseLine(
              ctx,
              businessId,
              purchase.id,
              item,
            );
            await ctx.purchase.createItem({
              purchaseId: purchase.id,
              materialId,
              name: item.name,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
            });
            touched.push(materialId);
          }

          return touched;
        });

        // Re-costing happens outside the serializable window (read-heavy, non-critical for numbering).
        await this.recostProducts.execute(businessId, touchedMaterialIds);

        return; // success
      } catch (err: unknown) {
        lastError = err;
        if (!isUniqueConstraintError(err)) throw err;
      }
    }
    throw lastError;
  }

  /**
   * Upserts a material from a purchase line and records a PURCHASE movement.
   * Returns the resolved materialId.
   */
  private async applyPurchaseLine(
    ctx: IAtomicContext,
    businessId: string,
    purchaseId: string,
    item: CreatePurchaseItemCommand,
  ): Promise<string> {
    const lineTotal = item.quantity * item.unitPrice;
    let material = item.materialId
      ? await ctx.material.findById(businessId, item.materialId)
      : await ctx.material.findByNameAndUnit(businessId, item.name.trim(), item.unit);

    if (material) {
      material = await ctx.material.incrementStock(material.id, item.quantity);
      await ctx.material.updatePricing(material.id, {
        unitPrice: item.unitPrice,
        purchasePrice: lineTotal,
        purchaseQty: item.quantity,
      });
    } else {
      material = await ctx.material.create({
        businessId,
        name: item.name.trim(),
        unit: item.unit,
        unitPrice: item.unitPrice,
        purchasePrice: lineTotal,
        purchaseQty: item.quantity,
        stockQty: item.quantity,
      });
    }

    await ctx.stockMovement.create({
      businessId,
      materialId: material.id,
      type: 'PURCHASE',
      qty: item.quantity,
      balanceAfter: material.stockQty,
      costAmount: lineTotal,
      refType: 'PURCHASE',
      refId: purchaseId,
    });

    return material.id;
  }

  private async resolveSupplier(
    ctx: IAtomicContext,
    businessId: string,
    cmd: CreatePurchaseCommand,
  ): Promise<string | undefined> {
    if (cmd.supplierId) return cmd.supplierId;
    // Supplier creation/lookup would go here if needed — no Prisma types leak in.
    return undefined;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === 'P2002'
  );
}
