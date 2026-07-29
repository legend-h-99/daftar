import { apiClient } from '../api';

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  month: string; // ISO month string e.g. "2026-07"
}

export const dashboardService = {
  summary: (month?: string) =>
    apiClient.get<DashboardSummary>('/dashboard/summary', {
      params: month ? { month } : undefined,
    }),
};
