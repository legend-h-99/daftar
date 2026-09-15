import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

// NOTE: create() and update() are excluded — they rely on $transaction which
// requires a full Prisma client and are better covered by integration tests.

type PrismaMock = {
  material: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
  };
  recipeItem: {
    count: jest.Mock;
  };
  purchaseItem: {
    count: jest.Mock;
  };
  stockMovement: {
    count: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

type InventoryMock = {
  recordOpeningBalance: jest.Mock;
  recostMaterials: jest.Mock;
};

describe('MaterialsService', () => {
  let service: MaterialsService;
  let prisma: PrismaMock;

  const mockMaterial = {
    id: 'mat-1',
    businessId: 'biz-1',
    name: 'جبن',
    unit: 'kg',
    purchasePrice: 100,
    purchaseQty: 10,
    unitPrice: 10,
    reorderLevel: 2,
    vatRate: 0,
    stockQty: 5,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const inventory: InventoryMock = {
      recordOpeningBalance: jest.fn(),
      recostMaterials: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        MaterialsService,
        {
          provide: PrismaService,
          useValue: {
            material: {
              findMany: jest.fn().mockResolvedValue([mockMaterial]),
              findFirst: jest.fn().mockResolvedValue(mockMaterial),
              delete: jest.fn().mockResolvedValue(mockMaterial),
            },
            recipeItem: {
              count: jest.fn().mockResolvedValue(0),
            },
            purchaseItem: {
              count: jest.fn().mockResolvedValue(0),
            },
            stockMovement: {
              count: jest.fn().mockResolvedValue(0),
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
              fn({
                stockMovement: { deleteMany: jest.fn() },
                material: { delete: jest.fn().mockResolvedValue(mockMaterial) },
              }),
            ),
          },
        },
        {
          provide: InventoryService,
          useValue: inventory,
        },
      ],
    }).compile();

    service = module.get(MaterialsService);
    prisma = module.get(PrismaService);
  });

  // ─── findAll() ────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns materials for the given businessId', async () => {
      const result = await service.findAll('biz-1', { limit: 20, skip: 0 });

      expect(result).toHaveLength(1);
      expect(prisma.material.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz-1' } }),
      );
    });

    it('passes pagination (limit/skip) to prisma', async () => {
      await service.findAll('biz-1', { limit: 10, skip: 30 });

      expect(prisma.material.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 30 }),
      );
    });
  });

  // ─── findOne() ────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns the material when it exists', async () => {
      const result = await service.findOne('biz-1', 'mat-1');

      expect(result.id).toBe('mat-1');
      expect(prisma.material.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mat-1', businessId: 'biz-1' } }),
      );
    });

    it('throws NotFoundException when material does not exist', async () => {
      prisma.material.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('succeeds and returns { deleted: true } when material has no refs', async () => {
      prisma.recipeItem.count = jest.fn().mockResolvedValue(0);
      prisma.purchaseItem.count = jest.fn().mockResolvedValue(0);
      prisma.stockMovement.count = jest.fn().mockResolvedValue(0);

      const result = await service.remove('biz-1', 'mat-1');

      expect(result).toEqual({ deleted: true });
    });

    it('throws BadRequestException when material is used in recipes (recipeRefs > 0)', async () => {
      prisma.recipeItem.count = jest.fn().mockResolvedValue(2);
      prisma.purchaseItem.count = jest.fn().mockResolvedValue(0);
      prisma.stockMovement.count = jest.fn().mockResolvedValue(0);

      await expect(service.remove('biz-1', 'mat-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when material is used in purchase invoices (purchaseRefs > 0)', async () => {
      prisma.recipeItem.count = jest.fn().mockResolvedValue(0);
      prisma.purchaseItem.count = jest.fn().mockResolvedValue(1);
      prisma.stockMovement.count = jest.fn().mockResolvedValue(0);

      await expect(service.remove('biz-1', 'mat-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with the Arabic error message when blocked', async () => {
      prisma.recipeItem.count = jest.fn().mockResolvedValue(1);
      prisma.purchaseItem.count = jest.fn().mockResolvedValue(0);
      prisma.stockMovement.count = jest.fn().mockResolvedValue(0);

      await expect(service.remove('biz-1', 'mat-1')).rejects.toThrow(
        'لا يمكن حذف الصنف لأنه مرتبط بوصفات منتجات أو فواتير شراء. عدّل كميته إلى صفر بدلًا من حذفه.',
      );
    });

    it('throws NotFoundException before checking refs when material does not exist', async () => {
      prisma.material.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.remove('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.recipeItem.count).not.toHaveBeenCalled();
      expect(prisma.purchaseItem.count).not.toHaveBeenCalled();
    });
  });
});
