export interface Expense {
  id: string;
  businessId: string;
  category: string;
  amount: number;
  date: Date;
  note: string | null;
  createdAt: Date;
}

export interface CreateExpenseData {
  businessId: string;
  category: string;
  amount: number;
  date: Date;
  note?: string | null;
}

export interface UpdateExpenseData {
  category?: string;
  amount?: number;
  date?: Date;
  note?: string | null;
}

export interface ExpenseFilter {
  month?: string;
  limit?: number;
  skip?: number;
}
