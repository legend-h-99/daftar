import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { FindExpensesQueryDto } from './dto/find-expenses-query.dto';
import { getMonthRange } from '../common/utils/month-range';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        businessId,
        category: dto.category,
        amount: dto.amount,
        date: new Date(dto.date),
        note: dto.note,
      },
    });
  }

  findAll(businessId: string, query: FindExpensesQueryDto) {
    if (!query.month) {
      return this.prisma.expense.findMany({ where: { businessId }, orderBy: { date: 'desc' } });
    }

    let range: ReturnType<typeof getMonthRange>;
    try {
      range = getMonthRange(query.month);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    return this.prisma.expense.findMany({
      where: { businessId, date: { gte: range.start, lt: range.end } },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(businessId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.findOne(businessId, id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category ?? existing.category,
        amount: dto.amount ?? existing.amount,
        date: dto.date ? new Date(dto.date) : existing.date,
        note: dto.note ?? existing.note,
      },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    await this.prisma.expense.delete({ where: { id } });
    return { deleted: true };
  }
}
