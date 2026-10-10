import {
  Expense,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilter,
} from '../../../domain/entities/expense.entity';

export const EXPENSE_REPOSITORY = Symbol('EXPENSE_REPOSITORY');

export interface IExpenseRepository {
  findById(businessId: string, id: string): Promise<Expense | null>;
  findAll(businessId: string, filter: ExpenseFilter): Promise<Expense[]>;
  create(data: CreateExpenseData): Promise<Expense>;
  update(id: string, data: UpdateExpenseData): Promise<Expense>;
  remove(id: string): Promise<void>;
}
