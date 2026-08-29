import { MaterialUnit } from './material.entity';

export type RecipeItemType = 'RAW' | 'PACKAGING';

export interface RecipeItem {
  id: string;
  productId: string;
  materialId: string | null;
  name: string;
  unit: MaterialUnit;
  unitPrice: number;
  quantityUsed: number;
  lineCost: number;
  type: RecipeItemType;
}

export interface RecipeItemInput {
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  unitPrice: number;
  quantityUsed: number;
  type: RecipeItemType;
}
