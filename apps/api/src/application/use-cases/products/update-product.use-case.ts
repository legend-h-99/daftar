import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../ports/repositories/product.repository.port';
import { ProductWithRecipe } from '../../../domain/entities/product.entity';
import { RecipeItemInput } from '../../../domain/entities/recipe-item.entity';
import { computeRecipeCosts } from '../../../domain/services/recipe-cost.calculator';

export interface UpdateProductCommand {
  name?: string;
  category?: string;
  overheadCost?: number;
  profitMargin?: number;
  recipeItems?: RecipeItemInput[];
}

@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
  ) {}

  async execute(businessId: string, id: string, cmd: UpdateProductCommand): Promise<ProductWithRecipe> {
    const existing = await this.productRepo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Product not found');

    const overheadCost = cmd.overheadCost ?? existing.overheadCost;
    const profitMargin = cmd.profitMargin ?? existing.profitMargin;

    const itemsForCalc: RecipeItemInput[] =
      cmd.recipeItems ??
      existing.recipeItems.map((i) => ({
        materialId: i.materialId ?? undefined,
        name: i.name,
        unit: i.unit,
        unitPrice: i.unitPrice,
        quantityUsed: i.quantityUsed,
        type: i.type,
      }));

    const costs = computeRecipeCosts(itemsForCalc, overheadCost, profitMargin);

    return this.productRepo.update(
      id,
      {
        name: cmd.name ?? existing.name,
        category: cmd.category ?? existing.category ?? undefined,
        overheadCost,
        profitMargin,
        ...costs,
      },
      cmd.recipeItems,
    );
  }
}
