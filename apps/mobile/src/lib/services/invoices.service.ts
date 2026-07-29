import { apiClient } from '../api';

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: InvoiceStatus;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  items: InvoiceItem[];
  notes?: string;
  createdAt: string;
  dueDate?: string;
}

export interface CreateInvoicePayload {
  customerId?: string;
  items: Array<{
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
  dueDate?: string;
}

export interface InvoicesListResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export const invoicesService = {
  list: (params?: { page?: number; limit?: number; status?: InvoiceStatus }) =>
    apiClient.get<InvoicesListResponse>('/invoices', { params }),

  get: (id: string) =>
    apiClient.get<Invoice>(`/invoices/${id}`),

  create: (payload: CreateInvoicePayload) =>
    apiClient.post<Invoice>('/invoices', payload),

  markPaid: (id: string, amount: number) =>
    apiClient.patch<Invoice>(`/invoices/${id}/pay`, { amount }),
};
