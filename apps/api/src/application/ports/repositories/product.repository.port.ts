import {
  CreateProductData,
  Product,
  ProductWithRecipe,
  UpdateProductCostsData,
} from '../../../domain/entities/product.entity';
import { RecipeItemInput } from '../../../domain/entities/recipe-item.entity';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductPage {
  items: Product[];
  total: number;
}

export interface IProductRepository {
  findById(businessId: string, id: string): Promise<ProductWithRecipe | null>;
  findAll(businessId: string, limit: number, skip: number): Promise<Product[]>;
  findManyByIds(businessId: string, ids: string[]): Promise<ProductWithRecipe[]>;

  /** Returns product IDs whose recipe references any of the given materialIds. */
  findProductIdsUsingMaterials(businessId: string, materialIds: string[]): Promise<string[]>;

  create(data: CreateProductData, recipeItems: RecipeItemInput[]): Promise<ProductWithRecipe>;
  update(
    id: string,
    data: Partial<CreateProductData>,
    recipeItems?: RecipeItemInput[],
  ): Promise<ProductWithRecipe>;
  updateCosts(id: string, costs: UpdateProductCostsData): Promise<void>;
  remove(id: string): Promise<void>;

  /** Bulk-update a single recipe line's unit price and recompute its lineCost. */
  updateRecipeLinePrice(recipeItemId: string, unitPrice: number, quantityUsed: number): Promise<void>;
}
