import { apiClient } from '../api';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category?: string;
  createdAt: string;
}

export interface CreateExpensePayload {
  amount: number;
  description: string;
  category?: string;
}

export const expensesService = {
  list: (params?: { month?: string }) =>
    apiClient.get<Expense[]>('/expenses', { params }),

  create: (payload: CreateExpensePayload) =>
    apiClient.post<Expense>('/expenses', payload),
};
