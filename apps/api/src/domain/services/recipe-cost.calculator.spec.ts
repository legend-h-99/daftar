import { applyMaterialPriceUpdates, computeRecipeCosts } from './recipe-cost.calculator';
import { RecipeItemInput } from '../entities/recipe-item.entity';

const line = (overrides: Partial<RecipeItemInput> = {}): RecipeItemInput => ({
  materialId: 'mat-1',
  name: 'Ingredient',
  unit: 'KG',
  unitPrice: 10,
  quantityUsed: 1,
  type: 'RAW',
  ...overrides,
});

describe('computeRecipeCosts', () => {
  it('returns zeros for an empty recipe with no overhead and no margin', () => {
    expect(computeRecipeCosts([], 0, 0)).toEqual({
      rawCost: 0,
      packagingCost: 0,
      totalCost: 0,
      sellingPrice: 0,
    });
  });

  it('multiplies unitPrice by quantityUsed for each line', () => {
    const result = computeRecipeCosts(
      [line({ unitPrice: 2.5, quantityUsed: 4, type: 'RAW' })],
      0,
      0,
    );
    expect(result.rawCost).toBe(10);
  });

  it('splits RAW and PACKAGING lines into their own sums', () => {
    const result = computeRecipeCosts(
      [
        line({ unitPrice: 10, quantityUsed: 2, type: 'RAW' }),
        line({ unitPrice: 3, quantityUsed: 5, type: 'RAW' }),
        line({ unitPrice: 0.5, quantityUsed: 6, type: 'PACKAGING' }),
      ],
      0,
      0,
    );
    expect(result.rawCost).toBe(35);
    expect(result.packagingCost).toBe(3);
    expect(result.totalCost).toBe(38);
  });

  it('adds overhead to totalCost but not to rawCost or packagingCost', () => {
    const result = computeRecipeCosts([line({ unitPrice: 10, quantityUsed: 1 })], 5, 0);
    expect(result.rawCost).toBe(10);
    expect(result.packagingCost).toBe(0);
    expect(result.totalCost).toBe(15);
  });

  it('treats margin as a share of the selling price, not a markup on cost', () => {
    // cost 70, margin 30% → price = 70 / 0.7 = 100 (markup would give 91)
    const result = computeRecipeCosts([line({ unitPrice: 70, quantityUsed: 1 })], 0, 30);
    expect(result.totalCost).toBe(70);
    expect(result.sellingPrice).toBe(100);
  });

  it('returns the total cost as the selling price when margin is 0', () => {
    const result = computeRecipeCosts([line({ unitPrice: 12, quantityUsed: 1 })], 3, 0);
    expect(result.sellingPrice).toBe(15);
  });

  it('doubles the cost when margin is 50%', () => {
    const result = computeRecipeCosts([line({ unitPrice: 20, quantityUsed: 1 })], 0, 50);
    expect(result.sellingPrice).toBe(40);
  });

  it('keeps a finite, large selling price at the DTO maximum margin of 99.99', () => {
    const result = computeRecipeCosts([line({ unitPrice: 1, quantityUsed: 1 })], 0, 99.99);
    expect(Number.isFinite(result.sellingPrice)).toBe(true);
    expect(result.sellingPrice).toBe(10000);
  });

  it('falls back to totalCost instead of dividing by zero when margin is 100', () => {
    const result = computeRecipeCosts([line({ unitPrice: 8, quantityUsed: 1 })], 2, 100);
    expect(result.sellingPrice).toBe(10);
  });

  it('rounds every reported figure to two decimals', () => {
    const result = computeRecipeCosts(
      [line({ unitPrice: 0.1, quantityUsed: 3, type: 'RAW' })],
      0,
      0,
    );
    // 0.1 * 3 = 0.30000000000000004 in floating point
    expect(result.rawCost).toBe(0.3);
    expect(result.totalCost).toBe(0.3);
  });

  it('rounds half-cent values up the way the rest of the app does', () => {
    const result = computeRecipeCosts([line({ unitPrice: 1.005, quantityUsed: 1 })], 0, 0);
    expect(result.rawCost).toBe(1.01);
  });
});

describe('applyMaterialPriceUpdates', () => {
  it('replaces unitPrice for lines whose materialId has a new price', () => {
    const items = [line({ materialId: 'mat-1', unitPrice: 10 })];
    const updated = applyMaterialPriceUpdates(items, new Map([['mat-1', 12.5]]));
    expect(updated[0].unitPrice).toBe(12.5);
  });

  it('keeps every other field of an updated line unchanged', () => {
    const items = [line({ materialId: 'mat-1', unitPrice: 10, quantityUsed: 3, type: 'PACKAGING' })];
    const [updated] = applyMaterialPriceUpdates(items, new Map([['mat-1', 4]]));
    expect(updated).toEqual({ ...items[0], unitPrice: 4 });
  });

  it('leaves lines without a materialId untouched', () => {
    const manual = line({ materialId: undefined, unitPrice: 7 });
    const [result] = applyMaterialPriceUpdates([manual], new Map([['mat-1', 99]]));
    expect(result).toBe(manual);
  });

  it('leaves lines whose material is missing from the price map untouched', () => {
    const items = [line({ materialId: 'mat-2', unitPrice: 6 })];
    const [result] = applyMaterialPriceUpdates(items, new Map([['mat-1', 99]]));
    expect(result).toBe(items[0]);
  });

  it('does not mutate the input lines', () => {
    const items = [line({ materialId: 'mat-1', unitPrice: 10 })];
    applyMaterialPriceUpdates(items, new Map([['mat-1', 20]]));
    expect(items[0].unitPrice).toBe(10);
  });

  it('accepts a new price of zero', () => {
    const items = [line({ materialId: 'mat-1', unitPrice: 10 })];
    const [result] = applyMaterialPriceUpdates(items, new Map([['mat-1', 0]]));
    expect(result.unitPrice).toBe(0);
  });
});
