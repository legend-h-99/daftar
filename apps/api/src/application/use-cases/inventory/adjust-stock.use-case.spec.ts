import { NotFoundException } from '@nestjs/common';
import { AdjustStockUseCase } from './adjust-stock.use-case';
import { IUnitOfWork } from '../../ports/unit-of-work.port';
import { Material } from '../../../domain/entities/material.entity';

const BUSINESS_ID = 'biz-1';

const makeMaterial = (overrides: Partial<Material> = {}): Material => ({
  id: 'mat-1',
  businessId: BUSINESS_ID,
  name: 'Flour',
  unit: 'KG',
  stockQty: 10,
  unitPrice: 5,
  purchasePrice: 50,
  purchaseQty: 10,
  vatRate: 15,
  reorderLevel: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('AdjustStockUseCase', () => {
  let ctx: {
    material: { findById: jest.Mock; setStock: jest.Mock };
    stockMovement: { create: jest.Mock };
  };
  let useCase: AdjustStockUseCase;

  beforeEach(() => {
    ctx = {
      material: {
        findById: jest.fn().mockResolvedValue(makeMaterial()),
        setStock: jest.fn(async (_id: string, qty: number) => makeMaterial({ stockQty: qty })),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const uow = { execute: jest.fn((work: (c: unknown) => unknown) => work(ctx)) };
    useCase = new AdjustStockUseCase(uow as unknown as IUnitOfWork);
  });

  it('looks the material up within the requesting business', async () => {
    await useCase.execute(BUSINESS_ID, { materialId: 'mat-1', newQty: 4 });
    expect(ctx.material.findById).toHaveBeenCalledWith(BUSINESS_ID, 'mat-1');
  });

  it('sets the stock to the requested quantity and returns the updated material', async () => {
    const result = await useCase.execute(BUSINESS_ID, { materialId: 'mat-1', newQty: 4 });
    expect(ctx.material.setStock).toHaveBeenCalledWith('mat-1', 4);
    expect(result.stockQty).toBe(4);
  });

  it('records a negative ADJUSTMENT movement when stock goes down', async () => {
    await useCase.execute(BUSINESS_ID, { materialId: 'mat-1', newQty: 4 });
    expect(ctx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        materialId: 'mat-1',
        type: 'ADJUSTMENT',
        qty: -6,
        balanceAfter: 4,
      }),
    );
  });

  it('records a positive ADJUSTMENT movement when stock goes up', async () => {
    await useCase.execute(BUSINESS_ID, { materialId: 'mat-1', newQty: 15 });
    expect(ctx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADJUSTMENT', qty: 5, balanceAfter: 15 }),
    );
  });

  it('takes balanceAfter from the persisted material, not from the requested quantity', async () => {
    ctx.material.setStock.mockResolvedValueOnce(makeMaterial({ stockQty: 99 }));
    await useCase.execute(BUSINESS_ID, { materialId: 'mat-1', newQty: 4 });
    expect(ctx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ balanceAfter: 99 }),
    );
  });

  it('forwards the note onto the movement', async () => {
    await useCase.execute(BUSINESS_ID, { materialId: 'mat-1', newQty: 8, note: 'Spoilage' });
    expect(ctx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Spoilage' }),
    );
  });

  it('throws NotFound and writes nothing when the material does not belong to the business', async () => {
    ctx.material.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(BUSINESS_ID, { materialId: 'mat-404', newQty: 1 }),
    ).rejects.toThrow(new NotFoundException('Material not found'));

    expect(ctx.material.setStock).not.toHaveBeenCalled();
    expect(ctx.stockMovement.create).not.toHaveBeenCalled();
  });
});
