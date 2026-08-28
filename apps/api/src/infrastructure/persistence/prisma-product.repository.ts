import { Prisma } from '@prisma/client';
import { IProductRepository } from '../../application/ports/repositories/product.repository.port';
import {
  CreateProductData,
  Product,
  ProductWithRecipe,
  UpdateProductCostsData,
} from '../../domain/entities/product.entity';
import { RecipeItemInput } from '../../domain/entities/recipe-item.entity';

type Db = Prisma.TransactionClient;

export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly db: Db) {}

  async findById(businessId: string, id: string): Promise<ProductWithRecipe | null> {
    return this.db.product.findFirst({
      where: { id, businessId },
      include: { recipeItems: true },
    }) as Promise<ProductWithRecipe | null>;
  }

  async findAll(businessId: string, limit: number, skip: number): Promise<Product[]> {
    return this.db.product.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
  }

  async findManyByIds(businessId: string, ids: string[]): Promise<ProductWithRecipe[]> {
    return this.db.product.findMany({
      where: { id: { in: ids }, businessId },
      include: { recipeItems: true },
    }) as Promise<ProductWithRecipe[]>;
  }

  async findProductIdsUsingMaterials(businessId: string, materialIds: string[]): Promise<string[]> {
    const lines = await this.db.recipeItem.findMany({
      where: { materialId: { in: materialIds }, product: { businessId } },
      select: { productId: true },
      distinct: ['productId'],
    });
    return lines.map((l) => l.productId);
  }

  async create(data: CreateProductData, recipeItems: RecipeItemInput[]): Promise<ProductWithRecipe> {
    return this.db.product.create({
      data: {
        ...data,
        recipeItems: {
          create: recipeItems.map((i) => ({
            materialId: i.materialId,
            name: i.name,
            unit: i.unit,
            unitPrice: i.unitPrice,
            quantityUsed: i.quantityUsed,
            lineCost: i.unitPrice * i.quantityUsed,
            type: i.type,
          })),
        },
      },
      include: { recipeItems: true },
    }) as Promise<ProductWithRecipe>;
  }

  async update(
    id: string,
    data: Partial<CreateProductData>,
    recipeItems?: RecipeItemInput[],
  ): Promise<ProductWithRecipe> {
    if (recipeItems) {
      await this.db.recipeItem.deleteMany({ where: { productId: id } });
    }
    return this.db.product.update({
      where: { id },
      data: {
        ...data,
        ...(recipeItems
          ? {
              recipeItems: {
                create: recipeItems.map((i) => ({
                  materialId: i.materialId,
                  name: i.name,
                  unit: i.unit,
                  unitPrice: i.unitPrice,
                  quantityUsed: i.quantityUsed,
                  lineCost: i.unitPrice * i.quantityUsed,
                  type: i.type,
                })),
              },
            }
          : {}),
      },
      include: { recipeItems: true },
    }) as Promise<ProductWithRecipe>;
  }

  async updateCosts(id: string, costs: UpdateProductCostsData): Promise<void> {
    await this.db.product.update({ where: { id }, data: costs });
  }

  async updateRecipeLinePrice(
    recipeItemId: string,
    unitPrice: number,
    quantityUsed: number,
  ): Promise<void> {
    await this.db.recipeItem.update({
      where: { id: recipeItemId },
      data: { unitPrice, lineCost: unitPrice * quantityUsed },
    });
  }

  async remove(id: string): Promise<void> {
    await this.db.product.delete({ where: { id } });
  }
}
