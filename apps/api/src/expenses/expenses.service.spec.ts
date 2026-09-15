import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpenseCategory } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { FindExpensesQueryDto } from './dto/find-expenses-query.dto';

type PrismaMock = {
  expense: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: PrismaMock;

  const mockExpense = {
    id: 'exp-1',
    businessId: 'biz-1',
    category: ExpenseCategory.RENT,
    amount: 2500,
    date: new Date('2026-01-15'),
    note: 'January office rent',
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: PrismaService,
          useValue: {
            expense: {
              create: jest.fn().mockResolvedValue(mockExpense),
              findMany: jest.fn().mockResolvedValue([mockExpense]),
              findFirst: jest.fn().mockResolvedValue(mockExpense),
              update: jest.fn().mockResolvedValue({ ...mockExpense, amount: 3000 }),
              delete: jest.fn().mockResolvedValue(mockExpense),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ExpensesService);
    prisma = module.get(PrismaService);
  });

  describe('create()', () => {
    it('calls prisma.expense.create with businessId and dto fields', async () => {
      const dto = {
        category: ExpenseCategory.RENT,
        amount: 2500,
        date: '2026-01-15',
        note: 'January office rent',
      };

      const result = await service.create('biz-1', dto);

      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz-1',
            category: ExpenseCategory.RENT,
            amount: 2500,
          }),
        }),
      );
      expect(result).toEqual(mockExpense);
    });
  });

  describe('findAll()', () => {
    it('returns expenses for the given businessId without month filter', async () => {
      const result = await service.findAll('biz-1', {} as FindExpensesQueryDto);

      expect(result).toHaveLength(1);
      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz-1' },
        }),
      );
    });

    it('filters by date range when a valid month is provided', async () => {
      const query = { month: '2026-01' } as FindExpensesQueryDto;

      await service.findAll('biz-1', query);

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz-1',
            date: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('throws BadRequestException for an invalid month format', () => {
      const query = { month: 'January-2026' } as FindExpensesQueryDto;

      expect(() => service.findAll('biz-1', query)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for a month value with invalid month number', () => {
      const query = { month: '2026-13' } as FindExpensesQueryDto;

      expect(() => service.findAll('biz-1', query)).toThrow(BadRequestException);
    });

    it('uses default limit and skip when not provided', async () => {
      await service.findAll('biz-1', {} as FindExpensesQueryDto);

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns the expense when found', async () => {
      const result = await service.findOne('biz-1', 'exp-1');

      expect(result).toEqual(mockExpense);
      expect(prisma.expense.findFirst).toHaveBeenCalledWith({
        where: { id: 'exp-1', businessId: 'biz-1' },
      });
    });

    it('throws NotFoundException when expense does not exist', async () => {
      prisma.expense.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates the expense with the provided fields', async () => {
      const dto = { amount: 3000 };

      const result = await service.update('biz-1', 'exp-1', dto);

      expect(prisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exp-1' },
          data: expect.objectContaining({ amount: 3000 }),
        }),
      );
      expect(result.amount).toBe(3000);
    });

    it('throws NotFoundException when updating a non-existent expense', async () => {
      prisma.expense.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.update('biz-1', 'nonexistent', { amount: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('falls back to existing values for fields not in dto', async () => {
      const dto = { amount: 3000 };

      await service.update('biz-1', 'exp-1', dto);

      expect(prisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: mockExpense.category,
            note: mockExpense.note,
          }),
        }),
      );
    });
  });

  describe('remove()', () => {
    it('deletes the expense and returns { deleted: true }', async () => {
      const result = await service.remove('biz-1', 'exp-1');

      expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'exp-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when removing a non-existent expense', async () => {
      prisma.expense.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.remove('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
