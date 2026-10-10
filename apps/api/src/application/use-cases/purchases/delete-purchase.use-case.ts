import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UNIT_OF_WORK, IUnitOfWork, IAtomicContext } from '../../ports/unit-of-work.port';
import { PURCHASE_REPOSITORY, IPurchaseRepository } from '../../ports/repositories/purchase.repository.port';
import { RecostProductsUseCase } from '../products/recost-products.use-case';
import { PurchaseItem } from '../../../domain/entities/purchase.entity';

@Injectable()
export class DeletePurchaseUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(PURCHASE_REPOSITORY) private readonly purchaseRepo: IPurchaseRepository,
    private readonly recostProducts: RecostProductsUseCase,
  ) {}

  async execute(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const purchase = await this.purchaseRepo.findById(businessId, id);
    if (!purchase) throw new NotFoundException('Purchase not found');

    const touched = await this.uow.execute(async (ctx) => {
      return this.reversePurchaseItems(ctx, businessId, purchase.id, purchase.number, purchase.items);
    });

    await this.purchaseRepo.remove(id);
    await this.recostProducts.execute(businessId, touched);

    return { deleted: true };
  }

  private async reversePurchaseItems(
    ctx: IAtomicContext,
    businessId: string,
    purchaseId: string,
    purchaseNumber: number,
    items: PurchaseItem[],
  ): Promise<string[]> {
    const touched: string[] = [];

    for (const item of items) {
      if (!item.materialId) continue;
      const updated = await ctx.material.decrementStock(item.materialId, item.quantity);
      await ctx.stockMovement.create({
        businessId,
        materialId: item.materialId,
        type: 'PURCHASE',
        qty: -item.quantity,
        balanceAfter: updated.stockQty,
        refType: 'PURCHASE',
        refId: purchaseId,
        note: `عكس حذف فاتورة شراء رقم ${purchaseNumber}`,
      });
      touched.push(item.materialId);
    }

    return touched;
  }
}
