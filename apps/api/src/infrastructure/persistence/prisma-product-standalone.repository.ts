import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaProductRepository } from './prisma-product.repository';
import { IProductRepository } from '../../application/ports/repositories/product.repository.port';
import {
  CreateProductData,
  Product,
  ProductWithRecipe,
  UpdateProductCostsData,
} from '../../domain/entities/product.entity';
import { RecipeItemInput } from '../../domain/entities/recipe-item.entity';

@Injectable()
export class PrismaProductStandaloneRepository implements IProductRepository {
  private readonly repo: PrismaProductRepository;

  constructor(prisma: PrismaService) {
    this.repo = new PrismaProductRepository(prisma as never);
  }

  findById(businessId: string, id: string): Promise<ProductWithRecipe | null> {
    return this.repo.findById(businessId, id);
  }

  findAll(businessId: string, limit: number, skip: number): Promise<Product[]> {
    return this.repo.findAll(businessId, limit, skip);
  }

  findManyByIds(businessId: string, ids: string[]): Promise<ProductWithRecipe[]> {
    return this.repo.findManyByIds(businessId, ids);
  }

  findProductIdsUsingMaterials(businessId: string, materialIds: string[]): Promise<string[]> {
    return this.repo.findProductIdsUsingMaterials(businessId, materialIds);
  }

  create(data: CreateProductData, recipeItems: RecipeItemInput[]): Promise<ProductWithRecipe> {
    return this.repo.create(data, recipeItems);
  }

  update(id: string, data: Partial<CreateProductData>, recipeItems?: RecipeItemInput[]): Promise<ProductWithRecipe> {
    return this.repo.update(id, data, recipeItems);
  }

  updateCosts(id: string, costs: UpdateProductCostsData): Promise<void> {
    return this.repo.updateCosts(id, costs);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }

  updateRecipeLinePrice(recipeItemId: string, unitPrice: number, quantityUsed: number): Promise<void> {
    return this.repo.updateRecipeLinePrice(recipeItemId, unitPrice, quantityUsed);
  }
}
