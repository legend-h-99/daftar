export const DASHBOARD_QUERY = Symbol('DASHBOARD_QUERY');

export interface UnpaidInvoiceSummary {
  id: string;
  number: number;
  customerName: string | null;
  total: number;
  dueDate: Date | null;
  status: string;
}

export interface LowStockMaterial {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderLevel: number;
}

export interface DashboardSummary {
  month: string;
  totalSales: number;
  totalPurchases: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
  totalExpenses: number;
  netProfit: number;
  unpaidInvoices: UnpaidInvoiceSummary[];
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  unpaidInvoicesLimitedTo: number;
  lowStock: LowStockMaterial[];
}

export interface IDashboardQuery {
  summary(businessId: string, month?: string): Promise<DashboardSummary>;
}
