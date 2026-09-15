import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationParams } from '../common/dto/pagination.dto';

type PrismaMock = {
  supplier: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: PrismaMock;

  const mockSupplier = {
    id: 'sup-1',
    businessId: 'biz-1',
    name: 'شركة التوريدات',
    phone: '+966509876543',
  };

  const defaultPagination: PaginationParams = { limit: 50, skip: 0 };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: PrismaService,
          useValue: {
            supplier: {
              create: jest.fn().mockResolvedValue(mockSupplier),
              findMany: jest.fn().mockResolvedValue([mockSupplier]),
              findFirst: jest.fn().mockResolvedValue(mockSupplier),
              update: jest.fn().mockResolvedValue({ ...mockSupplier, name: 'مورد الرياض' }),
              delete: jest.fn().mockResolvedValue(mockSupplier),
            },
          },
        },
      ],
    }).compile();

    service = module.get(SuppliersService);
    prisma = module.get(PrismaService);
  });

  describe('create()', () => {
    it('calls prisma.supplier.create with businessId and dto fields', async () => {
      const dto = { name: 'شركة التوريدات', phone: '+966509876543' };

      const result = await service.create('biz-1', dto);

      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: { businessId: 'biz-1', name: dto.name, phone: dto.phone },
      });
      expect(result).toEqual(mockSupplier);
    });
  });

  describe('findAll()', () => {
    it('returns suppliers for the given businessId', async () => {
      const result = await service.findAll('biz-1', defaultPagination);

      expect(result).toHaveLength(1);
      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz-1' },
        }),
      );
    });

    it('passes limit and skip to the query', async () => {
      await service.findAll('biz-1', { limit: 10, skip: 20 });

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it('orders results by createdAt descending', async () => {
      await service.findAll('biz-1', defaultPagination);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns the supplier when found', async () => {
      const result = await service.findOne('biz-1', 'sup-1');

      expect(result).toEqual(mockSupplier);
      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 'sup-1', businessId: 'biz-1' },
      });
    });

    it('throws NotFoundException when supplier does not exist', async () => {
      prisma.supplier.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates the supplier with provided fields', async () => {
      const dto = { name: 'مورد الرياض' };

      const result = await service.update('biz-1', 'sup-1', dto);

      expect(prisma.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sup-1' },
          data: expect.objectContaining({ name: 'مورد الرياض' }),
        }),
      );
      expect(result.name).toBe('مورد الرياض');
    });

    it('throws NotFoundException when updating a non-existent supplier', async () => {
      prisma.supplier.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.update('biz-1', 'nonexistent', { name: 'لا أحد' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('deletes the supplier and returns { deleted: true }', async () => {
      const result = await service.remove('biz-1', 'sup-1');

      expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: 'sup-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when removing a non-existent supplier', async () => {
      prisma.supplier.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.remove('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
