import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, IUnitOfWork, IAtomicContext } from '../../ports/unit-of-work.port';
import { PURCHASE_REPOSITORY, IPurchaseRepository } from '../../ports/repositories/purchase.repository.port';
import { SUPPLIER_REPOSITORY, ISupplierRepository } from '../../ports/repositories/supplier.repository.port';
import { MaterialUnit } from '../../../domain/entities/material.entity';
import { PurchaseWithItems } from '../../../domain/entities/purchase.entity';
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
    @Inject(PURCHASE_REPOSITORY) private readonly purchaseRepo: IPurchaseRepository,
    @Inject(SUPPLIER_REPOSITORY) private readonly supplierRepo: ISupplierRepository,
    private readonly recostProducts: RecostProductsUseCase,
  ) {}

  async execute(businessId: string, cmd: CreatePurchaseCommand): Promise<PurchaseWithItems> {
    const supplierId = await this.resolveSupplier(businessId, cmd);
    let lastError: unknown;
    let purchaseId: string | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { id, touched } = await this.uow.executeSerializable(async (ctx) => {
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

          const touchedIds: string[] = [];
          for (const item of cmd.items) {
            const materialId = await this.applyPurchaseLine(ctx, businessId, purchase.id, item);
            await ctx.purchase.createItem({
              purchaseId: purchase.id,
              materialId,
              name: item.name,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
            });
            touchedIds.push(materialId);
          }

          return { id: purchase.id, touched: touchedIds };
        });

        purchaseId = id;
        await this.recostProducts.execute(businessId, touched);
        break;
      } catch (err: unknown) {
        lastError = err;
        if (!isUniqueConstraintError(err)) throw err;
      }
    }

    if (!purchaseId) throw lastError;

    const result = await this.purchaseRepo.findById(businessId, purchaseId);
    return result!;
  }

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
    businessId: string,
    cmd: CreatePurchaseCommand,
  ): Promise<string | undefined> {
    if (cmd.supplierId) return cmd.supplierId;
    if (cmd.supplierName?.trim()) {
      const name = cmd.supplierName.trim();
      const existing = await this.supplierRepo.findByName(businessId, name);
      if (existing) return existing.id;
      const created = await this.supplierRepo.create({ businessId, name });
      return created.id;
    }
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
