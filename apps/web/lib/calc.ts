import { CalculateResult, RecipeItem } from "./types";

/**
 * Client-side mirror of the backend cost formulas. Keep these EXACTLY in
 * sync with the NestJS implementation so live calculation matches
 * POST /products/calculate.
 */

export function lineCost(item: Pick<RecipeItem, "unitPrice" | "quantityUsed">): number {
  return (item.unitPrice || 0) * (item.quantityUsed || 0);
}

export function calculateCosts(
  recipeItems: RecipeItem[],
  overheadCost: number | null | undefined,
  profitMargin: number,
): CalculateResult {
  const rawCost = recipeItems
    .filter((i) => i.type === "RAW")
    .reduce((sum, i) => sum + lineCost(i), 0);

  const packagingCost = recipeItems
    .filter((i) => i.type === "PACKAGING")
    .reduce((sum, i) => sum + lineCost(i), 0);

  const totalCost = rawCost + packagingCost + (overheadCost || 0);

  const margin = Math.min(Math.max(profitMargin || 0, 0), 99.99);
  const sellingPrice = margin >= 99.99 ? totalCost : totalCost / (1 - margin / 100);

  return { rawCost, packagingCost, totalCost, sellingPrice };
}
