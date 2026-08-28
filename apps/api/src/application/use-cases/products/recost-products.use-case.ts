import { Inject, Injectable } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../ports/repositories/product.repository.port';
import { MATERIAL_REPOSITORY, IMaterialRepository } from '../../ports/repositories/material.repository.port';
import {
  computeRecipeCosts,
  applyMaterialPriceUpdates,
} from '../../../domain/services/recipe-cost.calculator';
import { IAtomicContext } from '../../ports/unit-of-work.port';

/**
 * Recalculates costs for every product whose recipe references the given
 * materials. Accepts an optional `IAtomicContext` so callers can keep price
 * changes and re-costing in the same atomic transaction.
 */
@Injectable()
export class RecostProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
    @Inject(MATERIAL_REPOSITORY) private readonly materialRepo: IMaterialRepository,
  ) {}

  async execute(
    businessId: string,
    materialIds: string[],
    ctx?: IAtomicContext,
  ): Promise<void> {
    const ids = [...new Set(materialIds)];
    if (ids.length === 0) return;

    const repo = ctx?.product ?? this.productRepo;
    const matRepo = ctx?.material ?? this.materialRepo;

    const materials = await matRepo.findManyByIds(ids);
    const priceById = new Map(materials.map((m) => [m.id, m.unitPrice]));

    const productIds = await repo.findProductIdsUsingMaterials(businessId, ids);

    for (const productId of productIds) {
      const product = await repo.findById(businessId, productId);
      if (!product) continue;

      const updatedItems = applyMaterialPriceUpdates(
        product.recipeItems.map((i) => ({
          materialId: i.materialId ?? undefined,
          name: i.name,
          unit: i.unit,
          unitPrice: i.unitPrice,
          quantityUsed: i.quantityUsed,
          type: i.type,
        })),
        priceById,
      );

      // Persist updated line prices
      for (let i = 0; i < product.recipeItems.length; i++) {
        const original = product.recipeItems[i];
        const updated = updatedItems[i];
        if (original.unitPrice !== updated.unitPrice) {
          await repo.updateRecipeLinePrice(original.id, updated.unitPrice, updated.quantityUsed);
        }
      }

      const costs = computeRecipeCosts(updatedItems, product.overheadCost, product.profitMargin);
      await repo.updateCosts(productId, costs);
    }
  }
}
