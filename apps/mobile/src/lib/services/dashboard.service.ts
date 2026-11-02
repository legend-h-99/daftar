import { apiClient } from '../api';

export interface DashboardSummary {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  month?: string;
}

export const dashboardService = {
  summary: async (month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`) => {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary', {
      params: month ? { month } : undefined,
    });
    for (const key of ['totalSales', 'totalExpenses', 'netProfit', 'unpaidInvoicesCount', 'unpaidInvoicesTotal'] as const) {
      if (typeof response.data[key] !== 'number' || !Number.isFinite(response.data[key])) {
        throw new Error('تعذر قراءة التقرير؛ بيانات الخادم غير مكتملة');
      }
    }
    return response;
  },
};
