import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { EXPENSE_REPOSITORY, IExpenseRepository } from '../../ports/repositories/expense.repository.port';
import { Expense, ExpenseFilter } from '../../../domain/entities/expense.entity';

@Injectable()
export class ExpenseCrudService {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly repo: IExpenseRepository,
  ) {}

  create(
    businessId: string,
    dto: { category: string; amount: number; date: string; note?: string | null },
  ): Promise<Expense> {
    return this.repo.create({
      businessId,
      category: dto.category,
      amount: dto.amount,
      date: new Date(dto.date),
      note: dto.note,
    });
  }

  findAll(businessId: string, filter: ExpenseFilter): Promise<Expense[]> {
    return this.repo.findAll(businessId, filter);
  }

  async update(
    businessId: string,
    id: string,
    dto: { category?: string; amount?: number; date?: string; note?: string | null },
  ): Promise<Expense> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Expense not found');
    return this.repo.update(id, {
      category: dto.category ?? existing.category,
      amount: dto.amount ?? existing.amount,
      date: dto.date ? new Date(dto.date) : existing.date,
      note: dto.note ?? existing.note,
    });
  }

  async remove(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Expense not found');
    await this.repo.remove(id);
    return { deleted: true };
  }
}
