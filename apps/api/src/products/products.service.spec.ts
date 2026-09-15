import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecipeItemType, Unit } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeItemDto } from './dto/recipe-item.dto';
import { CalculateProductDto } from './dto/calculate-product.dto';

// NOTE: create() and update() are excluded — they rely on $transaction which
// requires a full Prisma client and are better covered by integration tests.

type PrismaMock = {
  product: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
  };
  material: {
    count: jest.Mock;
  };
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaMock;

  const mockProduct = {
    id: 'prod-1',
    businessId: 'biz-1',
    name: 'كنافة',
    category: 'حلويات',
    overheadCost: 0,
    profitMargin: 30,
    rawCost: 10,
    packagingCost: 2,
    totalCost: 12,
    sellingPrice: 17.14,
    createdAt: new Date('2026-01-01'),
    recipeItems: [],
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: jest.fn().mockResolvedValue([mockProduct]),
              findFirst: jest.fn().mockResolvedValue(mockProduct),
              delete: jest.fn().mockResolvedValue(mockProduct),
            },
            material: {
              count: jest.fn().mockResolvedValue(0),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    prisma = module.get(PrismaService);
  });

  // ─── computeCosts() ───────────────────────────────────────────────────────

  describe('computeCosts()', () => {
    it('calculates rawCost, packagingCost, totalCost and sellingPrice with 30% profit margin', () => {
      const items: RecipeItemDto[] = [
        { name: 'جبن', unit: Unit.KG, unitPrice: 20, quantityUsed: 0.5, type: RecipeItemType.RAW },
        { name: 'سكر', unit: Unit.KG, unitPrice: 5, quantityUsed: 0.2, type: RecipeItemType.RAW },
        { name: 'علبة', unit: Unit.PIECE, unitPrice: 3, quantityUsed: 1, type: RecipeItemType.PACKAGING },
      ];

      const result = service.computeCosts(items, 0, 30);

      // rawCost = 20*0.5 + 5*0.2 = 10 + 1 = 11
      // packagingCost = 3*1 = 3
      // totalCost = 11 + 3 + 0 = 14
      // sellingPrice = 14 / (1 - 0.3) = 14 / 0.7 ≈ 20
      expect(result.rawCost).toBe(11);
      expect(result.packagingCost).toBe(3);
      expect(result.totalCost).toBe(14);
      expect(result.sellingPrice).toBe(20);
    });

    it('returns totalCost as sellingPrice when profitMargin is 100% (divisor = 0)', () => {
      const items: RecipeItemDto[] = [
        { name: 'طحين', unit: Unit.KG, unitPrice: 4, quantityUsed: 2, type: RecipeItemType.RAW },
      ];

      const result = service.computeCosts(items, 0, 100);

      // divisor = 1 - 100/100 = 0 → fallback: sellingPrice = totalCost
      expect(result.totalCost).toBe(8);
      expect(result.sellingPrice).toBe(8);
    });

    it('returns zeros for all fields when items array is empty and overheadCost is 0', () => {
      const result = service.computeCosts([], 0, 30);

      expect(result.rawCost).toBe(0);
      expect(result.packagingCost).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.sellingPrice).toBe(0);
    });

    it('includes overheadCost in totalCost and sellingPrice', () => {
      const items: RecipeItemDto[] = [
        { name: 'زبدة', unit: Unit.KG, unitPrice: 10, quantityUsed: 1, type: RecipeItemType.RAW },
      ];

      const result = service.computeCosts(items, 5, 0);

      // rawCost = 10, packagingCost = 0, overheadCost = 5 → totalCost = 15
      // profitMargin = 0 → divisor = 1 → sellingPrice = 15
      expect(result.rawCost).toBe(10);
      expect(result.packagingCost).toBe(0);
      expect(result.totalCost).toBe(15);
      expect(result.sellingPrice).toBe(15);
    });

    it('rounds results to exactly 2 decimal places', () => {
      const items: RecipeItemDto[] = [
        { name: 'حليب', unit: Unit.LITER, unitPrice: 3, quantityUsed: 0.333, type: RecipeItemType.RAW },
      ];

      // rawCost = 3 * 0.333 = 0.999 → rounds to 1.00
      // profitMargin = 33 → divisor = 0.67 → sellingPrice = 0.999 / 0.67 ≈ 1.49104...→ 1.49
      const result = service.computeCosts(items, 0, 33);

      expect(Number.isInteger(result.rawCost * 100)).toBe(true);
      expect(Number.isInteger(result.packagingCost * 100)).toBe(true);
      expect(Number.isInteger(result.totalCost * 100)).toBe(true);
      expect(Number.isInteger(result.sellingPrice * 100)).toBe(true);
    });

    it('handles mixed RAW and PACKAGING items summing each bucket independently', () => {
      const items: RecipeItemDto[] = [
        { name: 'دقيق', unit: Unit.KG, unitPrice: 2, quantityUsed: 3, type: RecipeItemType.RAW },
        { name: 'بيض', unit: Unit.PIECE, unitPrice: 1, quantityUsed: 4, type: RecipeItemType.RAW },
        { name: 'كرتون', unit: Unit.PIECE, unitPrice: 5, quantityUsed: 1, type: RecipeItemType.PACKAGING },
        { name: 'شريط', unit: Unit.PIECE, unitPrice: 0.5, quantityUsed: 2, type: RecipeItemType.PACKAGING },
      ];

      const result = service.computeCosts(items, 0, 0);

      // rawCost = 2*3 + 1*4 = 6 + 4 = 10
      // packagingCost = 5*1 + 0.5*2 = 5 + 1 = 6
      // totalCost = 16, sellingPrice = 16 (0% margin)
      expect(result.rawCost).toBe(10);
      expect(result.packagingCost).toBe(6);
      expect(result.totalCost).toBe(16);
      expect(result.sellingPrice).toBe(16);
    });
  });

  // ─── calculate() ──────────────────────────────────────────────────────────

  describe('calculate()', () => {
    it('delegates to computeCosts using dto fields and defaults overheadCost to 0', () => {
      const spy = jest.spyOn(service, 'computeCosts');

      const dto: CalculateProductDto = {
        recipeItems: [
          { name: 'سمن', unit: Unit.KG, unitPrice: 15, quantityUsed: 0.5, type: RecipeItemType.RAW },
        ],
        profitMargin: 20,
        // overheadCost intentionally omitted → should default to 0
      } as CalculateProductDto;

      const result = service.calculate(dto);

      expect(spy).toHaveBeenCalledWith(dto.recipeItems, 0, 20);
      // rawCost = 15*0.5 = 7.5, totalCost = 7.5, sellingPrice = 7.5 / 0.8 = 9.375 → 9.38
      expect(result.totalCost).toBe(7.5);
      expect(result.sellingPrice).toBe(9.38);
    });

    it('passes overheadCost through when provided', () => {
      const spy = jest.spyOn(service, 'computeCosts');

      const dto: CalculateProductDto = {
        recipeItems: [],
        profitMargin: 0,
        overheadCost: 50,
      } as CalculateProductDto;

      service.calculate(dto);

      expect(spy).toHaveBeenCalledWith([], 50, 0);
    });
  });

  // ─── findAll() ────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns products for the given businessId', async () => {
      const result = await service.findAll('biz-1', { limit: 20, skip: 0 });

      expect(result).toHaveLength(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz-1' } }),
      );
    });

    it('passes pagination (limit/skip) to prisma', async () => {
      await service.findAll('biz-1', { limit: 10, skip: 20 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });
  });

  // ─── findOne() ────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns the product when it exists', async () => {
      const result = await service.findOne('biz-1', 'prod-1');

      expect(result.id).toBe('prod-1');
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-1', businessId: 'biz-1' } }),
      );
    });

    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('calls prisma.product.delete and returns { deleted: true }', async () => {
      const result = await service.remove('biz-1', 'prod-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the product to remove does not exist', async () => {
      prisma.product.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.remove('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });
  });
});
