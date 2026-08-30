import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let productsService: { recostProductsUsingMaterials: jest.Mock };

  beforeEach(() => {
    productsService = { recostProductsUsingMaterials: jest.fn() };
  });

  function buildService() {
    return new InventoryService({} as any, productsService as any);
  }

  it('consumeStockForSale aggregates recipe quantities and journals SALE movements', async () => {
    const tx = {
      recipeItem: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 'prod-1', materialId: 'mat-flour', quantityUsed: 2 },
          { productId: 'prod-1', materialId: 'mat-box', quantityUsed: 1 },
          { productId: 'prod-2', materialId: 'mat-flour', quantityUsed: 0.5 },
        ]),
      },
      material: {
        update: jest
          .fn()
          .mockResolvedValueOnce({ id: 'mat-flour', stockQty: 3 })
          .mockResolvedValueOnce({ id: 'mat-box', stockQty: 8 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    await buildService().consumeStockForSale(tx as any, 'biz-1', 'inv-1', [
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 4 },
    ]);

    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: 'mat-flour' },
      data: { stockQty: { decrement: 6 } },
    });
    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: 'mat-box' },
      data: { stockQty: { decrement: 2 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        materialId: 'mat-flour',
        type: 'SALE',
        qty: -6,
        refType: 'INVOICE',
        refId: 'inv-1',
      }),
    });
  });

  it('applyPurchaseLine rejects a material from another business', async () => {
    const tx = {
      material: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      buildService().applyPurchaseLine(tx as any, 'biz-1', 'purchase-1', {
        materialId: 'mat-other',
        name: 'Flour',
        unit: 'KG' as any,
        quantity: 1,
        unitPrice: 3,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('applyPurchaseLine increments an existing material and journals the purchase cost', async () => {
    const tx = {
      material: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mat-1', stockQty: 4 }),
        update: jest.fn().mockResolvedValue({ id: 'mat-1', stockQty: 7 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    await expect(
      buildService().applyPurchaseLine(tx as any, 'biz-1', 'purchase-1', {
        materialId: 'mat-1',
        name: 'Flour',
        unit: 'KG' as any,
        quantity: 3,
        unitPrice: 8,
      }),
    ).resolves.toBe('mat-1');

    expect(tx.material.update).toHaveBeenCalledWith({
      where: { id: 'mat-1' },
      data: {
        stockQty: { increment: 3 },
        purchasePrice: 24,
        purchaseQty: 3,
        unitPrice: 8,
      },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        materialId: 'mat-1',
        type: 'PURCHASE',
        qty: 3,
        balanceAfter: 7,
        costAmount: 24,
        refType: 'PURCHASE',
        refId: 'purchase-1',
      },
    });
  });

  it('recordAdjustment writes the signed delta from current to new quantity', async () => {
    const tx = {
      material: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mat-1', stockQty: 5 }),
        update: jest.fn().mockResolvedValue({ id: 'mat-1', stockQty: 8 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    await buildService().recordAdjustment(tx as any, 'biz-1', 'mat-1', 8, 'count');

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        materialId: 'mat-1',
        type: 'ADJUSTMENT',
        qty: 3,
        balanceAfter: 8,
        note: 'count',
      },
    });
  });
});
