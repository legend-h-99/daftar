import { Inject, Injectable } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../ports/repositories/product.repository.port';
import { ProductWithRecipe } from '../../../domain/entities/product.entity';
import { RecipeItemInput } from '../../../domain/entities/recipe-item.entity';
import { computeRecipeCosts } from '../../../domain/services/recipe-cost.calculator';

export interface CreateProductCommand {
  name: string;
  category?: string;
  overheadCost?: number;
  profitMargin: number;
  recipeItems: RecipeItemInput[];
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
  ) {}

  async execute(businessId: string, cmd: CreateProductCommand): Promise<ProductWithRecipe> {
    const overheadCost = cmd.overheadCost ?? 0;
    const costs = computeRecipeCosts(cmd.recipeItems, overheadCost, cmd.profitMargin);

    return this.productRepo.create(
      {
        businessId,
        name: cmd.name,
        category: cmd.category,
        overheadCost,
        profitMargin: cmd.profitMargin,
        ...costs,
      },
      cmd.recipeItems,
    );
  }
}
