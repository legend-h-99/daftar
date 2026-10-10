import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IExpenseRepository } from '../../application/ports/repositories/expense.repository.port';
import {
  Expense,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilter,
} from '../../domain/entities/expense.entity';
import { getMonthRange } from '../../common/utils/month-range';

const e = <T>(p: PromiseLike<T>): Promise<Expense> => p as unknown as Promise<Expense>;
const es = <T>(p: PromiseLike<T>): Promise<Expense[]> => p as unknown as Promise<Expense[]>;

@Injectable()
export class PrismaExpenseRepository implements IExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(businessId: string, id: string): Promise<Expense | null> {
    const r = await this.prisma.expense.findFirst({ where: { id, businessId } });
    return r as unknown as Expense | null;
  }

  findAll(businessId: string, filter: ExpenseFilter): Promise<Expense[]> {
    const limit = filter.limit ?? 50;
    const skip = filter.skip ?? 0;
    const range = filter.month ? getMonthRange(filter.month) : undefined;
    return es(
      this.prisma.expense.findMany({
        where: {
          businessId,
          ...(range && { date: { gte: range.start, lt: range.end } }),
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip,
      }),
    );
  }

  create(data: CreateExpenseData): Promise<Expense> {
    return e(this.prisma.expense.create({ data: data as never }));
  }

  update(id: string, data: UpdateExpenseData): Promise<Expense> {
    return e(this.prisma.expense.update({ where: { id }, data: data as never }));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.expense.delete({ where: { id } });
  }
}
