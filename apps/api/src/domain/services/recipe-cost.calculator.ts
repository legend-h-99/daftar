import { RecipeItemInput } from '../entities/recipe-item.entity';

export interface ComputedCosts {
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Single source of truth for recipe costing math.
 *
 *   lineCost      = unitPrice × quantityUsed
 *   rawCost       = Σ lineCost where type = RAW
 *   packagingCost = Σ lineCost where type = PACKAGING
 *   totalCost     = rawCost + packagingCost + overheadCost
 *   sellingPrice  = totalCost / (1 − profitMargin / 100)
 *                   (margin is % of selling price, not markup on cost)
 *
 * Pure function: no I/O, no side effects, no framework deps.
 */
export function computeRecipeCosts(
  items: RecipeItemInput[],
  overheadCost: number,
  profitMargin: number,
): ComputedCosts {
  const rawCost = items
    .filter((i) => i.type === 'RAW')
    .reduce((sum, i) => sum + i.unitPrice * i.quantityUsed, 0);

  const packagingCost = items
    .filter((i) => i.type === 'PACKAGING')
    .reduce((sum, i) => sum + i.unitPrice * i.quantityUsed, 0);

  const totalCost = rawCost + packagingCost + overheadCost;
  const divisor = 1 - profitMargin / 100;
  const sellingPrice = divisor > 0 ? totalCost / divisor : totalCost;

  return {
    rawCost: round2(rawCost),
    packagingCost: round2(packagingCost),
    totalCost: round2(totalCost),
    sellingPrice: round2(sellingPrice),
  };
}

/**
 * Given a list of recipe lines that reference specific materials, apply
 * updated unit prices and return a map of { materialId → newUnitPrice }
 * so callers know which line prices changed.
 */
export function applyMaterialPriceUpdates(
  items: RecipeItemInput[],
  priceById: Map<string, number>,
): RecipeItemInput[] {
  return items.map((i) => {
    if (!i.materialId) return i;
    const newPrice = priceById.get(i.materialId);
    return newPrice !== undefined ? { ...i, unitPrice: newPrice } : i;
  });
}
