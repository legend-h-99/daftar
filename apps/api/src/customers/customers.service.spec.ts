import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationParams } from '../common/dto/pagination.dto';

type PrismaMock = {
  customer: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: PrismaMock;

  const mockCustomer = {
    id: 'cust-1',
    businessId: 'biz-1',
    name: 'أحمد العلي',
    phone: '+966501234567',
  };

  const defaultPagination: PaginationParams = { limit: 50, skip: 0 };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              create: jest.fn().mockResolvedValue(mockCustomer),
              findMany: jest.fn().mockResolvedValue([mockCustomer]),
              findFirst: jest.fn().mockResolvedValue(mockCustomer),
              update: jest.fn().mockResolvedValue({ ...mockCustomer, name: 'محمد الشمري' }),
              delete: jest.fn().mockResolvedValue(mockCustomer),
            },
          },
        },
      ],
    }).compile();

    service = module.get(CustomersService);
    prisma = module.get(PrismaService);
  });

  describe('create()', () => {
    it('calls prisma.customer.create with businessId and dto fields', async () => {
      const dto = { name: 'أحمد العلي', phone: '+966501234567' };

      const result = await service.create('biz-1', dto);

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { businessId: 'biz-1', name: dto.name, phone: dto.phone },
      });
      expect(result).toEqual(mockCustomer);
    });
  });

  describe('findAll()', () => {
    it('returns customers for the given businessId', async () => {
      const result = await service.findAll('biz-1', defaultPagination);

      expect(result).toHaveLength(1);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz-1' },
        }),
      );
    });

    it('passes limit and skip to the query', async () => {
      await service.findAll('biz-1', { limit: 10, skip: 20 });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it('orders results by createdAt descending', async () => {
      await service.findAll('biz-1', defaultPagination);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns the customer when found', async () => {
      const result = await service.findOne('biz-1', 'cust-1');

      expect(result).toEqual(mockCustomer);
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', businessId: 'biz-1' },
      });
    });

    it('throws NotFoundException when customer does not exist', async () => {
      prisma.customer.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates the customer with provided fields', async () => {
      const dto = { name: 'محمد الشمري' };

      const result = await service.update('biz-1', 'cust-1', dto);

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: expect.objectContaining({ name: 'محمد الشمري' }),
        }),
      );
      expect(result.name).toBe('محمد الشمري');
    });

    it('throws NotFoundException when updating a non-existent customer', async () => {
      prisma.customer.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.update('biz-1', 'nonexistent', { name: 'لا أحد' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('falls back to existing values for fields not in dto', async () => {
      const dto = { name: 'محمد الشمري' };

      await service.update('biz-1', 'cust-1', dto);

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: mockCustomer.phone }),
        }),
      );
    });
  });

  describe('remove()', () => {
    it('deletes the customer and returns { deleted: true }', async () => {
      const result = await service.remove('biz-1', 'cust-1');

      expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: 'cust-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when removing a non-existent customer', async () => {
      prisma.customer.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.remove('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
