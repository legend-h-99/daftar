import { RecipeItem } from './recipe-item.entity';

export interface Product {
  id: string;
  businessId: string;
  name: string;
  category: string | null;
  overheadCost: number;
  profitMargin: number;
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithRecipe extends Product {
  recipeItems: RecipeItem[];
}

export interface CreateProductData {
  businessId: string;
  name: string;
  category?: string;
  overheadCost: number;
  profitMargin: number;
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
}

export interface UpdateProductCostsData {
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
}
